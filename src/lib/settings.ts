import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { settings } from "@/db/schema";

// Every lending parameter is adjustable from /admin/lending with no redeploy.

export type InstallmentPlan = {
  installments: number;
  /** margin in basis points, e.g. 450 = 4.5% */
  marginBps: number;
};

export type LendingConfig = {
  /** credit limit as % of verified monthly salary */
  limitPercent: number;
  minLimitKobo: number;
  maxLimitKobo: number;
  /** consecutive salary months required for eligibility */
  minSalaryMonths: number;
  /** amounts must sit within +/- this % of the stream average */
  tolerancePct: number;
  /** verified salary must be at least this much per month */
  salaryFloorKobo: number;
  installmentPlans: InstallmentPlan[];
  /** what fires an installment debit */
  debitTrigger: "salary_detection" | "fixed_date";
  /** days past due date before the fallback debit fires anyway */
  fallbackDebitDays: number;
  /** days between retries of a failed debit */
  retryIntervalDays: number;
  /** maximum debit attempts per installment */
  maxRetries: number;
  /** days after final retry before an installment is marked overdue */
  graceDays: number;
  /** how long an unredeemed Foodline Card stays valid */
  cardExpiryHours: number;
  /** standing mandate cap = limit x this multiplier (covers margin) */
  mandateCapMultiplier: number;
  /** mandate validity in months */
  mandateMonths: number;
  demoMode: boolean;
};

export const DEFAULT_CONFIG: LendingConfig = {
  limitPercent: 30,
  minLimitKobo: 2_000_000, // ₦20,000
  maxLimitKobo: 50_000_000, // ₦500,000
  minSalaryMonths: 3,
  tolerancePct: 15,
  salaryFloorKobo: 5_000_000, // ₦50,000
  installmentPlans: [
    { installments: 1, marginBps: 250 },
    { installments: 2, marginBps: 400 },
    { installments: 3, marginBps: 550 },
    { installments: 4, marginBps: 700 },
  ],
  debitTrigger: "salary_detection",
  fallbackDebitDays: 3,
  retryIntervalDays: 2,
  maxRetries: 3,
  graceDays: 7,
  cardExpiryHours: 72,
  mandateCapMultiplier: 1.1,
  mandateMonths: 12,
  demoMode: true,
};

const CONFIG_KEY = "lending_config";

export async function getConfig(db: Db): Promise<LendingConfig> {
  const row = (
    await db.select().from(settings).where(eq(settings.key, CONFIG_KEY)).limit(1)
  )[0];
  if (!row) return DEFAULT_CONFIG;
  return { ...DEFAULT_CONFIG, ...(row.value as Partial<LendingConfig>) };
}

export async function updateConfig(
  db: Db,
  patch: Partial<LendingConfig>,
  updatedBy: string
): Promise<LendingConfig> {
  const current = await getConfig(db);
  const next = { ...current, ...patch };
  await db
    .insert(settings)
    .values({ key: CONFIG_KEY, value: next, updatedAt: new Date(), updatedBy })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: next, updatedAt: new Date(), updatedBy },
    });
  return next;
}
