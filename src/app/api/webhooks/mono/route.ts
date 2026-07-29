import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, mandates, webhookEvents } from "@/db/schema";
import { getEnv } from "@/lib/env";
import { uid } from "@/lib/ids";
import { logEvent } from "@/lib/ledger";
import { applyDebitResult } from "@/lib/debit-engine";

export const dynamic = "force-dynamic";

// Mono webhook receiver. Verification is a shared-secret header equality
// check (mono-webhook-secret), per Mono docs; there is no HMAC scheme.
// Dedupe on event_id: Mono retries with the same id for up to 48h.

type MonoEvent = {
  event: string;
  event_id?: string;
  timestamp?: string;
  data: Record<string, unknown>;
};

export async function POST(request: Request) {
  const secret = getEnv("MONO_WEBHOOK_SECRET");
  const header = request.headers.get("mono-webhook-secret");
  if (!header || header !== secret) {
    return Response.json({ message: "Unauthorized request." }, { status: 401 });
  }

  let payload: MonoEvent;
  try {
    payload = (await request.json()) as MonoEvent;
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }
  if (!payload?.event) return Response.json({ message: "Missing event" }, { status: 400 });

  const db = getDb();
  const eventId = payload.event_id ?? `${payload.event}:${JSON.stringify(payload.data).slice(0, 80)}`;

  // Dedupe: the unique (provider, event_id) index rejects replays
  try {
    await db.insert(webhookEvents).values({
      id: uid(),
      provider: "mono",
      eventId,
      event: payload.event,
      payload,
      status: "received",
      receivedAt: new Date(),
    });
  } catch {
    return Response.json({ message: "Already processed" });
  }

  try {
    await handleMonoEvent(db, payload);
    await db
      .update(webhookEvents)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(webhookEvents.eventId, eventId));
  } catch (err) {
    await db
      .update(webhookEvents)
      .set({ status: "error", error: err instanceof Error ? err.message : String(err) })
      .where(eq(webhookEvents.eventId, eventId));
    // Ack anyway: our webhook_events row preserves the payload for replay,
    // and a non-200 would trigger Mono's 48h retry storm.
  }
  return Response.json({ message: "Webhook received" });
}

async function handleMonoEvent(db: ReturnType<typeof getDb>, payload: MonoEvent) {
  const data = payload.data ?? {};

  switch (payload.event) {
    case "mono.events.account_updated": {
      const account = data.account as { _id?: string } | undefined;
      const meta = data.meta as { data_status?: string } | undefined;
      if (account?._id && meta?.data_status) {
        await db
          .update(customers)
          .set({ dataStatus: meta.data_status, updatedAt: new Date() })
          .where(eq(customers.monoAccountId, account._id));
      }
      break;
    }

    case "mono.events.account_income": {
      const accountId = data.account as string | undefined;
      if (accountId) {
        const customer = (
          await db.select().from(customers).where(eq(customers.monoAccountId, accountId)).limit(1)
        )[0];
        await logEvent(db, {
          type: "salary_detected",
          customerId: customer?.id,
          actor: "webhook",
          message: "Mono income analysis result received (corroborates in-house detection)",
          data,
        });
      }
      break;
    }

    case "events.mandates.approved":
    case "events.mandates.rejected":
    case "events.mandates.expired":
    case "events.mandates.created": {
      const monoMandateId = data.id as string | undefined;
      if (!monoMandateId) break;
      const mandate = (
        await db.select().from(mandates).where(eq(mandates.monoMandateId, monoMandateId)).limit(1)
      )[0];
      if (!mandate) break;
      const statusMap: Record<string, "initiated" | "approved" | "rejected" | "expired"> = {
        "events.mandates.created": "initiated",
        "events.mandates.approved": "approved",
        "events.mandates.rejected": "rejected",
        "events.mandates.expired": "expired",
      };
      const status = statusMap[payload.event];
      const now = new Date();
      await db
        .update(mandates)
        .set({
          status,
          statusMessage: (data.message as string) ?? null,
          nibssCode: (data.nibss_code as string) ?? mandate.nibssCode,
          approvedAt: status === "approved" ? now : mandate.approvedAt,
        })
        .where(eq(mandates.id, mandate.id));
      if (status === "approved") {
        await db
          .update(customers)
          .set({ stage: "active", updatedAt: now })
          .where(eq(customers.id, mandate.customerId));
      }
      await logEvent(db, {
        type: "mandate_event",
        customerId: mandate.customerId,
        actor: "webhook",
        message: `Mandate ${status}: ${(data.message as string) ?? payload.event}`,
        data: { monoMandateId, event: payload.event },
      });
      break;
    }

    case "events.mandates.ready": {
      const monoMandateId = data.id as string | undefined;
      if (!monoMandateId) break;
      const mandate = (
        await db.select().from(mandates).where(eq(mandates.monoMandateId, monoMandateId)).limit(1)
      )[0];
      if (!mandate) break;
      await db
        .update(mandates)
        .set({ readyToDebit: true, readyAt: new Date(), status: "approved" })
        .where(eq(mandates.id, mandate.id));
      await logEvent(db, {
        type: "mandate_event",
        customerId: mandate.customerId,
        actor: "webhook",
        message: "Mandate is now ready for debiting (NIBSS waiting period over)",
        data: { monoMandateId },
      });
      break;
    }

    case "events.mandate.action.cancel": {
      const monoMandateId = (data.mandate as string) ?? null;
      if (!monoMandateId) break;
      const mandate = (
        await db.select().from(mandates).where(eq(mandates.monoMandateId, monoMandateId)).limit(1)
      )[0];
      if (!mandate) break;
      await db
        .update(mandates)
        .set({
          status: "cancelled",
          cancelledAt: new Date(),
          readyToDebit: false,
          statusMessage: (data.message as string) ?? null,
        })
        .where(eq(mandates.id, mandate.id));
      await logEvent(db, {
        type: "mandate_event",
        customerId: mandate.customerId,
        actor: "webhook",
        message: `Mandate cancelled: ${(data.message as string) ?? "no reason given"}`,
        data: { monoMandateId },
      });
      break;
    }

    case "events.mandates.debit.successful":
    case "events.mandates.debit.failed":
    case "events.mandates.debit.processing": {
      const reference = data.reference_number as string | undefined;
      if (!reference) break;
      const status =
        payload.event === "events.mandates.debit.successful"
          ? "successful"
          : payload.event === "events.mandates.debit.failed"
            ? "failed"
            : "processing";
      await applyDebitResult(db, reference, {
        status,
        responseCode: (data.response_code as string) ?? null,
        message: (data.message as string) ?? null,
        sessionId: (data.session_id as string) ?? null,
        feeKobo: (data.fee as number) ?? null,
      });
      break;
    }

    default:
      // account_connected arrives before our token exchange completes;
      // account_unlinked and others are recorded in webhook_events already.
      break;
  }
}
