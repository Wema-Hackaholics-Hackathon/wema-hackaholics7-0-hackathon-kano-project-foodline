import { and, eq, inArray, lte, sql } from "drizzle-orm";
import type { Db } from "@/db";
import {
  customers,
  debitAttempts,
  inflowEvents,
  installments,
  loans,
  mandates,
} from "@/db/schema";
import { monoReference, uid } from "./ids";
import { formatNaira } from "./money";
import { addDays, nextDateWithDay, todayLagos } from "./dates";
import { logEvent } from "./ledger";
import { getConfig, type LendingConfig } from "./settings";
import { matchesSalarySignature } from "./underwriting";
import { debitMandate, MonoError } from "./mono";

// The collections engine. Trigger paths:
//  1. processInflow: a credit lands on the linked account (webhook or demo
//     simulation) and matches the salary signature -> debit due installments.
//  2. runSweep: fallback pass for missed salaries, retries, overdue marking.
// Every decision (including "do nothing") is written to the ledger.

export type DebitOutcome = {
  attempted: boolean;
  status?: "successful" | "processing" | "failed";
  message: string;
  installmentId?: string;
};

type LoanRow = typeof loans.$inferSelect;
type InstallmentRow = typeof installments.$inferSelect;
type MandateRow = typeof mandates.$inferSelect;

async function activeMandateFor(db: Db, customerId: string): Promise<MandateRow | null> {
  const rows = await db
    .select()
    .from(mandates)
    .where(and(eq(mandates.customerId, customerId), eq(mandates.status, "approved")))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Attempt to debit one installment under the customer's standing mandate.
 * Demo mandates settle instantly without calling Mono; the code path is
 * otherwise identical.
 */
export async function attemptDebit(
  db: Db,
  loan: LoanRow,
  installment: InstallmentRow,
  mandate: MandateRow,
  trigger: "salary_detected" | "fallback_schedule" | "retry" | "manual" | "demo",
  config: LendingConfig
): Promise<DebitOutcome> {
  if (!mandate.readyToDebit && !mandate.isDemo) {
    await logEvent(db, {
      type: "debit_decision",
      customerId: loan.customerId,
      loanId: loan.id,
      message: `Skipped debit of installment ${installment.seq}: mandate approved but not yet ready to debit (NIBSS waiting period)`,
      data: { installmentId: installment.id, mandateId: mandate.id, trigger },
    });
    return { attempted: false, message: "Mandate not yet ready to debit" };
  }

  if (installment.attempts >= config.maxRetries) {
    await logEvent(db, {
      type: "debit_decision",
      customerId: loan.customerId,
      loanId: loan.id,
      message: `Skipped debit of installment ${installment.seq}: retry limit reached (${installment.attempts}/${config.maxRetries})`,
      data: { installmentId: installment.id, trigger },
    });
    return { attempted: false, message: "Retry limit reached" };
  }

  const reference = monoReference("fdb");
  const now = new Date();
  const attemptId = uid();
  await db.insert(debitAttempts).values({
    id: attemptId,
    installmentId: installment.id,
    loanId: loan.id,
    reference,
    amountKobo: installment.amountKobo,
    status: "processing",
    trigger,
    createdAt: now,
  });
  await db
    .update(installments)
    .set({
      status: "processing",
      attempts: installment.attempts + 1,
      lastAttemptAt: now,
    })
    .where(eq(installments.id, installment.id));
  await logEvent(db, {
    type: "debit_attempt",
    customerId: loan.customerId,
    loanId: loan.id,
    message: `Debit attempt ${installment.attempts + 1} for installment ${installment.seq} of ${formatNaira(installment.amountKobo)} (trigger: ${trigger.replace(/_/g, " ")})`,
    data: { reference, installmentId: installment.id, mandateId: mandate.id },
  });

  if (mandate.isDemo) {
    await applyDebitResult(db, reference, {
      status: "successful",
      responseCode: "00",
      message: "Account debited successfully (demo)",
      sessionId: `demo-${Date.now()}`,
      feeKobo: 0,
    });
    return {
      attempted: true,
      status: "successful",
      message: "Installment collected",
      installmentId: installment.id,
    };
  }

  try {
    const result = await debitMandate(mandate.monoMandateId!, {
      amountKobo: installment.amountKobo,
      reference,
      narration: `Foodline repayment ${installment.seq}/${loan.installmentsCount}`,
    });
    const status = result.status === "successful" ? "successful" : "processing";
    await applyDebitResult(db, reference, {
      status,
      responseCode: result.response_code,
      message: result.message ?? null,
      sessionId: result.session_id ?? null,
      feeKobo: result.fee ?? null,
    });
    return { attempted: true, status, message: result.message ?? status, installmentId: installment.id };
  } catch (err) {
    const mono = err instanceof MonoError ? err : null;
    await applyDebitResult(db, reference, {
      status: "failed",
      responseCode: mono?.responseCode ?? null,
      message: mono?.message ?? (err instanceof Error ? err.message : "Unknown error"),
      sessionId: null,
      feeKobo: null,
    });
    return {
      attempted: true,
      status: "failed",
      message: mono?.message ?? "Debit failed",
      installmentId: installment.id,
    };
  }
}

/**
 * Final (or interim) result of a debit, from the synchronous API response or
 * from a mandates.debit.* webhook. Idempotent per reference + status.
 */
export async function applyDebitResult(
  db: Db,
  reference: string,
  result: {
    status: "successful" | "processing" | "failed";
    responseCode?: string | null;
    message?: string | null;
    sessionId?: string | null;
    feeKobo?: number | null;
  }
): Promise<void> {
  const attempt = (
    await db.select().from(debitAttempts).where(eq(debitAttempts.reference, reference)).limit(1)
  )[0];
  if (!attempt) return;
  if (attempt.status === "successful") return; // already settled

  const now = new Date();
  await db
    .update(debitAttempts)
    .set({
      status: result.status,
      responseCode: result.responseCode ?? null,
      message: result.message ?? null,
      monoSessionId: result.sessionId ?? null,
      feeKobo: result.feeKobo ?? null,
      resolvedAt: result.status === "processing" ? null : now,
    })
    .where(eq(debitAttempts.id, attempt.id));

  const installment = (
    await db.select().from(installments).where(eq(installments.id, attempt.installmentId)).limit(1)
  )[0];
  if (!installment) return;
  const loan = (await db.select().from(loans).where(eq(loans.id, attempt.loanId)).limit(1))[0];

  if (result.status === "successful") {
    await db
      .update(installments)
      .set({ status: "paid", paidAt: now })
      .where(eq(installments.id, installment.id));
    const remaining = await db
      .select({ n: sql<number>`count(*)` })
      .from(installments)
      .where(
        and(
          eq(installments.loanId, attempt.loanId),
          inArray(installments.status, ["scheduled", "processing", "failed", "overdue"])
        )
      );
    const allPaid = (remaining[0]?.n ?? 1) === 0;
    if (allPaid && loan) {
      await db
        .update(loans)
        .set({ status: "repaid", updatedAt: now })
        .where(eq(loans.id, loan.id));
      await logEvent(db, {
        type: "loan_repaid",
        customerId: loan.customerId,
        loanId: loan.id,
        message: `Loan fully repaid: ${formatNaira(loan.totalRepayableKobo)} over ${loan.installmentsCount} installment(s)`,
      });
    }
    await logEvent(db, {
      type: "debit_result",
      customerId: loan?.customerId,
      loanId: attempt.loanId,
      message: `Installment ${installment.seq} of ${formatNaira(attempt.amountKobo)} collected successfully`,
      data: { reference, responseCode: result.responseCode, sessionId: result.sessionId },
    });
  } else if (result.status === "failed") {
    await db
      .update(installments)
      .set({ status: "failed" })
      .where(eq(installments.id, installment.id));
    await logEvent(db, {
      type: "debit_result",
      customerId: loan?.customerId,
      loanId: attempt.loanId,
      message: `Debit of installment ${installment.seq} failed: ${result.message ?? "no reason given"} (will retry per policy)`,
      data: { reference, responseCode: result.responseCode },
    });
  }
}

/**
 * A credit hit the customer's linked account. If it matches the verified
 * salary signature, collect every due installment across their loans.
 */
export async function processInflow(
  db: Db,
  customerId: string,
  inflow: { amountKobo: number; narration: string | null; date: string; source: "webhook" | "poll" | "demo" }
): Promise<{ matched: boolean; outcomes: DebitOutcome[] }> {
  const config = await getConfig(db);
  const customer = (
    await db.select().from(customers).where(eq(customers.id, customerId)).limit(1)
  )[0];
  if (!customer) return { matched: false, outcomes: [] };

  const inflowId = uid();
  await db.insert(inflowEvents).values({
    id: inflowId,
    customerId,
    amountKobo: inflow.amountKobo,
    narration: inflow.narration,
    date: inflow.date,
    source: inflow.source,
    createdAt: new Date(),
  });

  let matched = false;
  let matchDetail = "no verified salary on file";
  if (customer.salaryAmountKobo && customer.nextPayDate) {
    const res = matchesSalarySignature(
      { amountKobo: inflow.amountKobo, date: inflow.date },
      { salaryAmountKobo: customer.salaryAmountKobo, nextPayDate: customer.nextPayDate },
      config
    );
    matched = res.matches;
    matchDetail = res.detail;
  }

  await logEvent(db, {
    type: "inflow_observed",
    customerId,
    message: matched
      ? `Salary credit detected: ${formatNaira(inflow.amountKobo)} (${matchDetail})`
      : `Credit observed but not matched as salary: ${formatNaira(inflow.amountKobo)} (${matchDetail})`,
    data: { inflowId, source: inflow.source },
  });

  if (!matched) return { matched: false, outcomes: [] };

  await db
    .update(inflowEvents)
    .set({ matchedSalary: true, processedAt: new Date() })
    .where(eq(inflowEvents.id, inflowId));

  // The salary that landed is this cycle's payday: advance the expectation
  if (customer.salaryDayOfMonth) {
    await db
      .update(customers)
      .set({
        nextPayDate: nextDateWithDay(inflow.date.slice(0, 10), customer.salaryDayOfMonth),
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));
  }

  const outcomes: DebitOutcome[] = [];
  if (config.debitTrigger === "salary_detection") {
    outcomes.push(
      ...(await collectDueInstallments(db, customerId, "salary_detected", config, inflow.date.slice(0, 10)))
    );
  } else {
    await logEvent(db, {
      type: "debit_decision",
      customerId,
      message: "Salary detected but debit trigger mode is fixed-date; scheduler will collect on due date",
    });
  }
  return { matched: true, outcomes };
}

/** Collect every installment that is due (or overdue/failed) for a customer */
export async function collectDueInstallments(
  db: Db,
  customerId: string,
  trigger: "salary_detected" | "fallback_schedule" | "retry" | "manual" | "demo",
  config: LendingConfig,
  asOfDate?: string
): Promise<DebitOutcome[]> {
  const mandate = await activeMandateFor(db, customerId);
  if (!mandate) {
    await logEvent(db, {
      type: "debit_decision",
      customerId,
      message: "No approved mandate on file; cannot debit",
    });
    return [{ attempted: false, message: "No approved mandate" }];
  }

  const customerLoans = await db
    .select()
    .from(loans)
    .where(and(eq(loans.customerId, customerId), inArray(loans.status, ["active", "overdue"])));

  // Allow collection slightly ahead of the due date: salary may land early.
  // When a salary credit triggers this, the credit's date anchors the horizon
  // so an installment scheduled for that payday is collected.
  const horizon = addDays(asOfDate ?? todayLagos(), 3);
  const outcomes: DebitOutcome[] = [];
  for (const loan of customerLoans) {
    const due = await db
      .select()
      .from(installments)
      .where(
        and(
          eq(installments.loanId, loan.id),
          inArray(installments.status, ["scheduled", "failed", "overdue"]),
          lte(installments.dueDate, horizon)
        )
      )
      .orderBy(installments.seq);
    for (const inst of due) {
      outcomes.push(await attemptDebit(db, loan, inst, mandate, trigger, config));
    }
  }
  if (outcomes.length === 0) {
    await logEvent(db, {
      type: "debit_decision",
      customerId,
      message: "Salary detected but no installment is due yet; nothing to collect",
    });
  }
  return outcomes;
}

/**
 * Fallback sweep (admin button or external scheduler): collects installments
 * whose due date passed without a salary trigger, retries failed debits after
 * the retry interval, and marks stale installments overdue.
 */
export async function runSweep(db: Db): Promise<{
  attempted: number;
  succeeded: number;
  failed: number;
  markedOverdue: number;
}> {
  const config = await getConfig(db);
  const today = todayLagos();
  const stats = { attempted: 0, succeeded: 0, failed: 0, markedOverdue: 0 };

  // Mark overdue: past due + grace and out of retries
  const overdueCutoff = addDays(today, -config.graceDays);
  const stale = await db
    .select({ inst: installments, loan: loans })
    .from(installments)
    .innerJoin(loans, eq(installments.loanId, loans.id))
    .where(
      and(
        inArray(installments.status, ["scheduled", "failed"]),
        lte(installments.dueDate, overdueCutoff)
      )
    );
  for (const { inst, loan } of stale) {
    if (inst.attempts >= config.maxRetries) {
      await db.update(installments).set({ status: "overdue" }).where(eq(installments.id, inst.id));
      await db.update(loans).set({ status: "overdue", updatedAt: new Date() }).where(eq(loans.id, loan.id));
      stats.markedOverdue++;
      await logEvent(db, {
        type: "debit_decision",
        customerId: loan.customerId,
        loanId: loan.id,
        message: `Installment ${inst.seq} marked overdue: ${config.maxRetries} attempts exhausted and ${config.graceDays} grace day(s) passed`,
      });
    }
  }

  // Fallback + retry collection
  const fallbackCutoff = addDays(today, -config.fallbackDebitDays);
  const candidates = await db
    .select({ inst: installments, loan: loans })
    .from(installments)
    .innerJoin(loans, eq(installments.loanId, loans.id))
    .where(
      and(
        inArray(installments.status, ["scheduled", "failed"]),
        inArray(loans.status, ["active", "overdue"]),
        lte(installments.dueDate, fallbackCutoff)
      )
    )
    .orderBy(installments.dueDate);

  for (const { inst, loan } of candidates) {
    if (inst.attempts >= config.maxRetries) continue;
    // Respect the retry interval between attempts
    if (
      inst.lastAttemptAt &&
      Date.now() - inst.lastAttemptAt.getTime() < config.retryIntervalDays * 86_400_000
    ) {
      continue;
    }
    const mandate = await activeMandateFor(db, loan.customerId);
    if (!mandate) continue;
    const trigger = inst.attempts > 0 ? "retry" : "fallback_schedule";
    const outcome = await attemptDebit(db, loan, inst, mandate, trigger, config);
    if (outcome.attempted) {
      stats.attempted++;
      if (outcome.status === "successful") stats.succeeded++;
      if (outcome.status === "failed") stats.failed++;
    }
  }
  return stats;
}

/** Outstanding exposure for a customer: unpaid installments on open loans */
export async function outstandingKobo(db: Db, customerId: string): Promise<number> {
  const rows = await db
    .select({ total: sql<number>`coalesce(sum(${installments.amountKobo}), 0)` })
    .from(installments)
    .innerJoin(loans, eq(installments.loanId, loans.id))
    .where(
      and(
        eq(loans.customerId, customerId),
        inArray(loans.status, ["active", "overdue"]),
        inArray(installments.status, ["scheduled", "processing", "failed", "overdue"])
      )
    );
  return rows[0]?.total ?? 0;
}

export async function availableCreditKobo(db: Db, customerId: string): Promise<number> {
  const customer = (
    await db
      .select({ limit: customers.creditLimitKobo })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1)
  )[0];
  if (!customer) return 0;
  const outstanding = await outstandingKobo(db, customerId);
  return Math.max(0, customer.limit - outstanding);
}
