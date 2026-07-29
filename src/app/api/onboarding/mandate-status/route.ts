import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, mandates } from "@/db/schema";
import { apiUser } from "@/lib/session";
import { getMandate } from "@/lib/mono";
import { logEvent } from "@/lib/ledger";

export const dynamic = "force-dynamic";

type MandateStatus = (typeof mandates.$inferSelect)["status"];

const KNOWN_STATUSES: MandateStatus[] = [
  "initiated",
  "approved",
  "rejected",
  "cancelled",
  "expired",
];

// Polled by the mandate authorization screen while the customer makes their
// N50 NIBSS transfer. Refreshes the local mandate row from Mono and flips the
// customer to active the moment the bank approves.
export async function GET() {
  const user = await apiUser("customer");
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const row = (
    await db
      .select()
      .from(mandates)
      .where(eq(mandates.customerId, user.id))
      .orderBy(desc(mandates.createdAt))
      .limit(1)
  )[0];
  if (!row) return Response.json({ error: "No mandate found" }, { status: 404 });

  let status: MandateStatus = row.status;
  let readyToDebit = row.readyToDebit;

  const shouldRefresh =
    status === "initiated" || (status === "approved" && !readyToDebit);
  if (shouldRefresh && row.monoMandateId) {
    try {
      const remote = await getMandate(row.monoMandateId);
      const remoteStatus = KNOWN_STATUSES.includes(remote.status as MandateStatus)
        ? (remote.status as MandateStatus)
        : status;
      const remoteReady = Boolean(remote.ready_to_debit);

      if (remoteStatus !== status || remoteReady !== readyToDebit) {
        const now = new Date();
        await db
          .update(mandates)
          .set({
            status: remoteStatus,
            readyToDebit: remoteReady,
            nibssCode: remote.nibss_code ?? row.nibssCode,
            approvedAt: remoteStatus === "approved" && !row.approvedAt ? now : row.approvedAt,
            readyAt: remoteReady && !row.readyAt ? now : row.readyAt,
            cancelledAt:
              (remoteStatus === "cancelled" || remoteStatus === "expired") && !row.cancelledAt
                ? now
                : row.cancelledAt,
          })
          .where(eq(mandates.id, row.id));

        if (remoteStatus === "approved") {
          await db
            .update(customers)
            .set({ stage: "active", updatedAt: now })
            .where(eq(customers.id, user.id));
        }
        if (remoteStatus !== status) {
          await logEvent(db, {
            type: "mandate_event",
            customerId: user.id,
            message: `Mandate ${row.reference} moved to ${remoteStatus}${remoteReady ? ", ready to debit" : ""}`,
            data: { monoMandateId: row.monoMandateId, from: status, to: remoteStatus },
          });
        }
        status = remoteStatus;
        readyToDebit = remoteReady;
      }
    } catch {
      // Mono briefly unreachable: report what we know, the next poll retries
    }
  }

  return Response.json({ status, readyToDebit });
}
