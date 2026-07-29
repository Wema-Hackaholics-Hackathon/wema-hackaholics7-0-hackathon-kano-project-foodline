import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { orders, settlements, webhookEvents } from "@/db/schema";
import { uid } from "@/lib/ids";
import { logEvent } from "@/lib/ledger";
import { verifyPaystackSignature } from "@/lib/paystack";

export const dynamic = "force-dynamic";

// Paystack webhook receiver. Signature: HMAC-SHA512 of the RAW body with the
// secret key, hex, in x-paystack-signature.

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-paystack-signature");
  if (!(await verifyPaystackSignature(rawBody, signature))) {
    return Response.json({ message: "Invalid signature" }, { status: 401 });
  }

  let payload: { event: string; data: Record<string, unknown> };
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return Response.json({ message: "Invalid JSON" }, { status: 400 });
  }
  if (!payload?.event) return Response.json({ message: "Missing event" }, { status: 400 });

  const db = getDb();
  const reference = (payload.data?.reference as string) ?? "";
  // Paystack has no event id; derive one so retries dedupe
  const eventId = `${payload.event}:${reference}`;
  try {
    await db.insert(webhookEvents).values({
      id: uid(),
      provider: "paystack",
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
    if (
      ["transfer.success", "transfer.failed", "transfer.reversed"].includes(payload.event) &&
      reference
    ) {
      const settlement = (
        await db.select().from(settlements).where(eq(settlements.reference, reference)).limit(1)
      )[0];
      if (settlement) {
        const now = new Date();
        if (payload.event === "transfer.success" && settlement.status !== "success") {
          await db
            .update(settlements)
            .set({ status: "success", settledAt: now })
            .where(eq(settlements.id, settlement.id));
          await db
            .update(orders)
            .set({ status: "settled" })
            .where(eq(orders.id, settlement.orderId));
        } else if (payload.event === "transfer.failed") {
          await db
            .update(settlements)
            .set({
              status: "failed",
              failureReason: (payload.data?.reason as string) ?? "Transfer failed",
            })
            .where(eq(settlements.id, settlement.id));
        } else if (payload.event === "transfer.reversed") {
          await db
            .update(settlements)
            .set({ status: "reversed" })
            .where(eq(settlements.id, settlement.id));
        }
        await logEvent(db, {
          type: "settlement_result",
          orderId: settlement.orderId,
          actor: "webhook",
          message: `Paystack ${payload.event} for settlement ${reference}`,
          data: { reference },
        });
      }
    }
    await db
      .update(webhookEvents)
      .set({ status: "processed", processedAt: new Date() })
      .where(eq(webhookEvents.eventId, eventId));
  } catch (err) {
    await db
      .update(webhookEvents)
      .set({ status: "error", error: err instanceof Error ? err.message : String(err) })
      .where(eq(webhookEvents.eventId, eventId));
  }
  return Response.json({ message: "Webhook received" });
}
