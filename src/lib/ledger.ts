import type { Db } from "@/db";
import { ledgerEvents } from "@/db/schema";
import { uid } from "./ids";

export type LedgerType =
  | "salary_detected"
  | "eligibility_check"
  | "limit_calculated"
  | "mandate_created"
  | "mandate_event"
  | "order_issued"
  | "order_redeemed"
  | "order_expired"
  | "loan_created"
  | "loan_repaid"
  | "debit_decision"
  | "debit_attempt"
  | "debit_result"
  | "inflow_observed"
  | "settlement_initiated"
  | "settlement_result"
  | "config_change"
  | "demo_action";

/**
 * The auditable decision trail. Every automated decision writes here so the
 * "how do you decide?" question has a showable answer in /admin/ledger.
 */
export async function logEvent(
  db: Db,
  entry: {
    type: LedgerType;
    message: string;
    customerId?: string;
    loanId?: string;
    orderId?: string;
    actor?: string;
    data?: unknown;
  }
): Promise<void> {
  await db.insert(ledgerEvents).values({
    id: uid(),
    type: entry.type,
    message: entry.message,
    customerId: entry.customerId ?? null,
    loanId: entry.loanId ?? null,
    orderId: entry.orderId ?? null,
    actor: entry.actor ?? "system",
    data: entry.data ?? null,
    createdAt: new Date(),
  });
}
