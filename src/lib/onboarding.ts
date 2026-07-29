import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { bankTransactions, customers, mandates, salaryDetections, users } from "@/db/schema";
import { monoReference, uid } from "./ids";
import { formatNaira } from "./money";
import { logEvent } from "./ledger";
import { getConfig } from "./settings";
import { computeLimit, detectSalary, mandateTerms, type SalaryDetection } from "./underwriting";
import {
  createMandate,
  createMonoCustomer,
  exchangeToken,
  getAccount,
  getTransactions,
  triggerIncomeAnalysis,
} from "./mono";

// Onboarding pipeline: link account -> verify salary -> confirm + limit ->
// standing mandate. Demo and live share every step below the Mono calls.

export async function linkMonoAccount(
  db: Db,
  customerId: string,
  code: string
): Promise<{ accountName: string; bankName: string; accountNumber: string }> {
  const accountId = await exchangeToken(code);
  const details = await getAccount(accountId);
  const acct = details.account;

  await db
    .update(customers)
    .set({
      monoAccountId: accountId,
      accountName: acct.name,
      accountNumber: acct.account_number,
      bankName: acct.institution.name,
      bankCode: acct.institution.bank_code,
      dataStatus: details.meta.data_status,
      stage: "verify_salary",
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));

  await cacheTransactions(db, customerId, accountId);

  // Kick off Mono's own income analysis as corroboration (async, webhook)
  try {
    await triggerIncomeAnalysis(accountId, 6);
  } catch {
    // non-fatal: our in-house detection is the primary signal
  }

  await logEvent(db, {
    type: "salary_detected",
    customerId,
    message: `Salary account linked: ${acct.institution.name} ••${acct.account_number.slice(-4)} (${acct.name})`,
    data: { dataStatus: details.meta.data_status },
  });

  return {
    accountName: acct.name,
    bankName: acct.institution.name,
    accountNumber: acct.account_number,
  };
}

export async function cacheTransactions(
  db: Db,
  customerId: string,
  monoAccountId: string
): Promise<number> {
  const txs = await getTransactions(monoAccountId, { realTime: true });
  if (txs.length === 0) return 0;
  await db.delete(bankTransactions).where(eq(bankTransactions.customerId, customerId));
  // D1 bind-parameter budget: insert in chunks
  const chunk = 20;
  for (let i = 0; i < txs.length; i += chunk) {
    await db.insert(bankTransactions).values(
      txs.slice(i, i + chunk).map((t) => ({
        id: uid(),
        customerId,
        monoTxId: t.id,
        narration: t.narration,
        amountKobo: t.amount,
        type: t.type,
        balanceKobo: t.balance,
        date: t.date,
        category: t.category,
      }))
    );
  }
  return txs.length;
}

/** Run detection on cached transactions and persist the full working */
export async function runSalaryVerification(
  db: Db,
  customerId: string
): Promise<SalaryDetection> {
  const config = await getConfig(db);
  const txs = await db
    .select()
    .from(bankTransactions)
    .where(eq(bankTransactions.customerId, customerId));

  const detection = detectSalary(
    txs.map((t) => ({
      id: t.id,
      narration: t.narration,
      amountKobo: t.amountKobo,
      type: t.type,
      date: t.date,
    })),
    config
  );

  await db.insert(salaryDetections).values({
    id: uid(),
    customerId,
    eligible: detection.eligible,
    avgAmountKobo: detection.avgAmountKobo,
    monthsFound: detection.monthsFound,
    payDayOfMonth: detection.payDayOfMonth,
    employerGuess: detection.employerGuess,
    nextPayDate: detection.nextPayDate,
    evidence: detection.evidence,
    reasons: detection.reasons,
    configSnapshot: config,
    createdAt: new Date(),
  });

  await logEvent(db, {
    type: "eligibility_check",
    customerId,
    message: detection.eligible
      ? `Eligible: ${detection.monthsFound} consecutive salary months averaging ${formatNaira(detection.avgAmountKobo!)}`
      : `Not eligible: ${detection.reasons
          .filter((r) => !r.passed)
          .map((r) => r.detail)
          .join("; ")}`,
    data: { reasons: detection.reasons, evidence: detection.evidence },
  });

  if (detection.eligible) {
    await db
      .update(customers)
      .set({
        salaryAmountKobo: detection.avgAmountKobo,
        salaryMonths: detection.monthsFound,
        salaryDayOfMonth: detection.payDayOfMonth,
        salaryEmployerGuess: detection.employerGuess,
        nextPayDate: detection.nextPayDate,
        salaryVerifiedAt: new Date(),
        stage: "confirm_salary",
        updatedAt: new Date(),
      })
      .where(eq(customers.id, customerId));
  }
  return detection;
}

/** Customer confirmed the detected salary: compute and assign the limit */
export async function assignLimit(db: Db, customerId: string): Promise<number> {
  const config = await getConfig(db);
  const customer = (
    await db.select().from(customers).where(eq(customers.id, customerId)).limit(1)
  )[0];
  if (!customer?.salaryAmountKobo) throw new Error("Salary not verified");

  const limit = computeLimit(customer.salaryAmountKobo, config);
  await db
    .update(customers)
    .set({ creditLimitKobo: limit, stage: "limit_assigned", updatedAt: new Date() })
    .where(eq(customers.id, customerId));

  await logEvent(db, {
    type: "limit_calculated",
    customerId,
    message: `Credit limit set to ${formatNaira(limit)}: ${config.limitPercent}% of verified salary ${formatNaira(customer.salaryAmountKobo)}, clamped to [${formatNaira(config.minLimitKobo)}, ${formatNaira(config.maxLimitKobo)}], floored to clean ₦1,000`,
    data: {
      salaryAmountKobo: customer.salaryAmountKobo,
      limitPercent: config.limitPercent,
      minLimitKobo: config.minLimitKobo,
      maxLimitKobo: config.maxLimitKobo,
      resultKobo: limit,
    },
  });
  return limit;
}

export type MandateSetupResult = {
  mandateId: string;
  status: string;
  transferDestinations: unknown;
  amountCapKobo: number;
  autoApproved: boolean;
};

/** Create the standing variable e-mandate that funds every future purchase */
export async function createStandingMandate(db: Db, customerId: string): Promise<MandateSetupResult> {
  const config = await getConfig(db);
  const customer = (
    await db.select().from(customers).where(eq(customers.id, customerId)).limit(1)
  )[0];
  const user = (await db.select().from(users).where(eq(users.id, customerId)).limit(1))[0];
  if (!customer || !user) throw new Error("Customer not found");
  if (!customer.creditLimitKobo) throw new Error("No credit limit assigned");
  if (!customer.accountNumber || !customer.bankNipCode && !customer.bankCode) {
    throw new Error("No linked bank account");
  }

  // Ensure a Mono DD customer exists
  let monoCustomerId = customer.monoCustomerId;
  if (!monoCustomerId) {
    const [firstName, ...rest] = user.name.trim().split(/\s+/);
    monoCustomerId = await createMonoCustomer({
      firstName,
      lastName: rest.join(" ") || firstName,
      email: user.email,
      phone: user.phone ?? "08000000000",
      bvn: customer.bvn,
      address: customer.address ?? "Lagos, Nigeria",
    });
    await db
      .update(customers)
      .set({ monoCustomerId, updatedAt: new Date() })
      .where(eq(customers.id, customerId));
  }

  const terms = mandateTerms(customer.creditLimitKobo, config);
  const reference = monoReference("fmd");
  const mandate = await createMandate({
    customerId: monoCustomerId,
    amountCapKobo: terms.amountCapKobo,
    reference,
    accountNumber: customer.accountNumber,
    bankCode: customer.bankCode!,
    description: "Foodline foodstuff credit line repayments",
    startDate: terms.startDate,
    endDate: terms.endDate,
  });

  const autoApproved = mandate.status === "approved" || mandate.approved === true;
  const now = new Date();
  const mandateRowId = uid();
  await db.insert(mandates).values({
    id: mandateRowId,
    customerId,
    monoMandateId: mandate.id,
    reference,
    status: autoApproved ? "approved" : "initiated",
    readyToDebit: Boolean(mandate.ready_to_debit),
    amountCapKobo: terms.amountCapKobo,
    startDate: terms.startDate,
    endDate: terms.endDate,
    nibssCode: mandate.nibss_code,
    transferDestinations: mandate.transfer_destinations ?? null,
    accountName: mandate.account_name,
    accountNumber: mandate.account_number,
    bankName: mandate.bank,
    createdAt: now,
    approvedAt: autoApproved ? now : null,
  });

  if (autoApproved) {
    await db
      .update(customers)
      .set({ stage: "active", updatedAt: now })
      .where(eq(customers.id, customerId));
  }

  await logEvent(db, {
    type: "mandate_created",
    customerId,
    message: `Standing mandate created for up to ${formatNaira(terms.amountCapKobo)} (${config.mandateMonths} months, ref ${reference})${autoApproved ? "; auto-approved in sandbox" : "; awaiting N50 NIBSS authorization"}`,
    data: { monoMandateId: mandate.id, terms },
  });

  return {
    mandateId: mandateRowId,
    status: autoApproved ? "approved" : "initiated",
    transferDestinations: mandate.transfer_destinations ?? null,
    amountCapKobo: terms.amountCapKobo,
    autoApproved,
  };
}
