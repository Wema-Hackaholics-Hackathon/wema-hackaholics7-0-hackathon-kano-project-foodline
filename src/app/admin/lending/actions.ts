"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { apiUser } from "@/lib/session";
import { formatNaira, parseNairaToKobo } from "@/lib/money";
import { getConfig, updateConfig, type InstallmentPlan, type LendingConfig } from "@/lib/settings";
import { logEvent } from "@/lib/ledger";

export type ConfigState = { errors: Record<string, string>; saved: boolean };

function intField(
  form: FormData,
  name: string,
  errors: Record<string, string>,
  opts: { min: number; max: number; label: string }
): number | null {
  const raw = String(form.get(name) ?? "").trim();
  const value = Number(raw);
  if (raw === "" || !Number.isFinite(value) || !Number.isInteger(value)) {
    errors[name] = `${opts.label} must be a whole number.`;
    return null;
  }
  if (value < opts.min || value > opts.max) {
    errors[name] = `${opts.label} must be between ${opts.min} and ${opts.max}.`;
    return null;
  }
  return value;
}

function nairaField(
  form: FormData,
  name: string,
  errors: Record<string, string>,
  label: string
): number | null {
  const raw = String(form.get(name) ?? "").trim();
  const kobo = parseNairaToKobo(raw);
  if (kobo === null) {
    errors[name] = `${label} must be an amount, for example 50,000.`;
    return null;
  }
  return kobo;
}

export async function saveLendingConfig(
  _prev: ConfigState,
  form: FormData
): Promise<ConfigState> {
  const admin = await apiUser("admin");
  if (!admin) return { errors: { form: "Your session expired. Sign in again." }, saved: false };

  const db = getDb();
  const current = await getConfig(db);
  const errors: Record<string, string> = {};

  const limitPercent = intField(form, "limitPercent", errors, {
    min: 1,
    max: 100,
    label: "Limit percentage",
  });
  const minLimitKobo = nairaField(form, "minLimitKobo", errors, "Minimum limit");
  const maxLimitKobo = nairaField(form, "maxLimitKobo", errors, "Maximum limit");
  const minSalaryMonths = intField(form, "minSalaryMonths", errors, {
    min: 1,
    max: 12,
    label: "Minimum salary months",
  });
  const tolerancePct = intField(form, "tolerancePct", errors, {
    min: 1,
    max: 100,
    label: "Tolerance",
  });
  const salaryFloorKobo = nairaField(form, "salaryFloorKobo", errors, "Salary floor");
  const fallbackDebitDays = intField(form, "fallbackDebitDays", errors, {
    min: 0,
    max: 30,
    label: "Fallback debit days",
  });
  const retryIntervalDays = intField(form, "retryIntervalDays", errors, {
    min: 1,
    max: 30,
    label: "Retry interval",
  });
  const maxRetries = intField(form, "maxRetries", errors, { min: 1, max: 10, label: "Max retries" });
  const graceDays = intField(form, "graceDays", errors, { min: 0, max: 60, label: "Grace period" });
  const cardExpiryHours = intField(form, "cardExpiryHours", errors, {
    min: 1,
    max: 720,
    label: "Card expiry",
  });
  const mandateMonths = intField(form, "mandateMonths", errors, {
    min: 1,
    max: 36,
    label: "Mandate validity",
  });

  const capRaw = Number(String(form.get("mandateCapMultiplier") ?? "").trim());
  let mandateCapMultiplier: number | null = null;
  if (!Number.isFinite(capRaw) || capRaw < 1 || capRaw > 3) {
    errors.mandateCapMultiplier = "Mandate cap multiplier must be between 1 and 3.";
  } else {
    mandateCapMultiplier = Math.round(capRaw * 100) / 100;
  }

  const debitTriggerRaw = String(form.get("debitTrigger") ?? "");
  const debitTrigger: LendingConfig["debitTrigger"] =
    debitTriggerRaw === "fixed_date" ? "fixed_date" : "salary_detection";

  // Repayment plans arrive as parallel arrays
  const planCounts = form.getAll("planInstallments").map((v) => Number(String(v)));
  const planMargins = form.getAll("planMargin").map((v) => Number(String(v)));
  const plans: InstallmentPlan[] = [];
  const seen = new Set<number>();
  for (let i = 0; i < planCounts.length; i++) {
    const n = planCounts[i];
    const marginPct = planMargins[i];
    if (!Number.isInteger(n) || n < 1 || n > 12) {
      errors.plans = "Each plan needs a whole number of installments between 1 and 12.";
      break;
    }
    if (!Number.isFinite(marginPct) || marginPct < 0 || marginPct > 100) {
      errors.plans = "Each margin must be a percentage between 0 and 100.";
      break;
    }
    if (seen.has(n)) {
      errors.plans = `You have two plans with ${n} installment(s). Each plan needs a different count.`;
      break;
    }
    seen.add(n);
    plans.push({ installments: n, marginBps: Math.round(marginPct * 100) });
  }
  if (!errors.plans && plans.length === 0) {
    errors.plans = "Keep at least one repayment plan.";
  }

  if (minLimitKobo !== null && maxLimitKobo !== null && minLimitKobo >= maxLimitKobo) {
    errors.maxLimitKobo = "The maximum limit must be above the minimum limit.";
  }

  if (Object.keys(errors).length > 0) return { errors, saved: false };

  const next: LendingConfig = {
    ...current,
    limitPercent: limitPercent!,
    minLimitKobo: minLimitKobo!,
    maxLimitKobo: maxLimitKobo!,
    minSalaryMonths: minSalaryMonths!,
    tolerancePct: tolerancePct!,
    salaryFloorKobo: salaryFloorKobo!,
    installmentPlans: plans.sort((a, b) => a.installments - b.installments),
    debitTrigger,
    fallbackDebitDays: fallbackDebitDays!,
    retryIntervalDays: retryIntervalDays!,
    maxRetries: maxRetries!,
    graceDays: graceDays!,
    cardExpiryHours: cardExpiryHours!,
    mandateCapMultiplier: mandateCapMultiplier!,
    mandateMonths: mandateMonths!,
    demoMode: form.get("demoMode") === "on",
  };

  // Name every change so the ledger reads like an audit trail
  const money = new Set(["minLimitKobo", "maxLimitKobo", "salaryFloorKobo"]);
  const changes: string[] = [];
  for (const key of Object.keys(next) as (keyof LendingConfig)[]) {
    const before = current[key];
    const after = next[key];
    const beforeStr = JSON.stringify(before);
    const afterStr = JSON.stringify(after);
    if (beforeStr === afterStr) continue;
    if (key === "installmentPlans") {
      changes.push(
        `repayment plans ${(before as InstallmentPlan[])
          .map((p) => `${p.installments}x@${p.marginBps / 100}%`)
          .join(", ")} -> ${(after as InstallmentPlan[])
          .map((p) => `${p.installments}x@${p.marginBps / 100}%`)
          .join(", ")}`
      );
    } else if (money.has(key)) {
      changes.push(`${key} ${formatNaira(before as number)} -> ${formatNaira(after as number)}`);
    } else {
      changes.push(`${key} ${String(before)} -> ${String(after)}`);
    }
  }

  await updateConfig(db, next, `admin:${admin.id}`);
  await logEvent(db, {
    type: "config_change",
    actor: `admin:${admin.id}`,
    message:
      changes.length > 0
        ? `Lending configuration updated: ${changes.join("; ")}`
        : "Lending configuration saved with no changes",
    data: { changes },
  });

  revalidatePath("/admin/lending");
  revalidatePath("/admin");
  return { errors: {}, saved: true };
}
