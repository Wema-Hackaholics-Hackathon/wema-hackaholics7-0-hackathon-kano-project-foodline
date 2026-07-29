import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { BadgeCheck, ChevronDown, CircleAlert, SearchX } from "lucide-react";
import { getDb } from "@/db";
import { salaryDetections } from "@/db/schema";
import { runSalaryVerification } from "@/lib/onboarding";
import { getConfig, type LendingConfig } from "@/lib/settings";
import type { RuleResult, SalaryDetection } from "@/lib/underwriting";
import { formatDate } from "@/lib/dates";
import { formatNaira, formatNairaWhole } from "@/lib/money";
import { Card, Money, Pill } from "@/components/ui";
import { requireJoinPage } from "../flow";
import { JoinHeader, ordinal } from "../join-ui";
import { NotEligibleActions, SalaryConfirmBar } from "./salary-actions";

export const metadata: Metadata = { title: "We checked your salary" };

type Verdict = {
  eligible: boolean;
  avgAmountKobo: number | null;
  monthsFound: number;
  payDayOfMonth: number | null;
  employerGuess: string | null;
  nextPayDate: string | null;
  reasons: RuleResult[];
  evidence: SalaryDetection["evidence"];
};

function humanizeFailure(rule: RuleResult, v: Verdict, config: LendingConfig): string {
  switch (rule.rule) {
    case "recurring_stream_found":
      return "We could not find a credit that repeats every month the way a salary does.";
    case "min_consecutive_months":
      return `We found ${v.monthsFound} consecutive ${v.monthsFound === 1 ? "month" : "months"} of steady pay. We need at least ${config.minSalaryMonths}.`;
    case "amounts_within_tolerance":
      return v.evidence.amountSpreadPct !== null
        ? `The amounts moved around by up to ${v.evidence.amountSpreadPct}% month to month. We allow up to ${config.tolerancePct}%.`
        : `The amounts moved around too much month to month. We allow up to ${config.tolerancePct}%.`;
    case "salary_floor":
      return v.avgAmountKobo
        ? `The average we found, ${formatNaira(v.avgAmountKobo)}, is below the ${formatNairaWhole(config.salaryFloorKobo)} monthly minimum.`
        : `The average pay we found is below the ${formatNairaWhole(config.salaryFloorKobo)} monthly minimum.`;
    case "recent_salary":
      return "The most recent salary we could see is older than 45 days.";
    default:
      return rule.detail;
  }
}

export default async function SalaryPage() {
  const { customer } = await requireJoinPage("salary");
  const db = getDb();
  const config = await getConfig(db);

  const latest =
    (
      await db
        .select()
        .from(salaryDetections)
        .where(eq(salaryDetections.customerId, customer.id))
        .orderBy(desc(salaryDetections.createdAt))
        .limit(1)
    )[0] ?? null;

  // Run detection exactly once per linked account: only while the stage is
  // verify_salary, and only if there is no detection newer than the link.
  let verdict: Verdict;
  const needsRun =
    customer.stage === "verify_salary" &&
    (!latest || latest.createdAt.getTime() < customer.updatedAt.getTime());
  if (needsRun || !latest) {
    verdict = await runSalaryVerification(db, customer.id);
  } else {
    verdict = {
      eligible: latest.eligible,
      avgAmountKobo: latest.avgAmountKobo,
      monthsFound: latest.monthsFound ?? 0,
      payDayOfMonth: latest.payDayOfMonth,
      employerGuess: latest.employerGuess,
      nextPayDate: latest.nextPayDate,
      reasons: latest.reasons as RuleResult[],
      evidence: latest.evidence as SalaryDetection["evidence"],
    };
  }

  const bankLabel = customer.bankName
    ? `${customer.bankName} ••${(customer.accountNumber ?? "").slice(-4)}`
    : "your linked account";

  if (!verdict.eligible) {
    const failures = verdict.reasons.filter((r) => !r.passed);
    return (
      <main className="flex-1 flex flex-col px-5 py-6">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
          <JoinHeader step={4} showSignOut />

          <div className="mt-8 animate-rise">
            <div className="flex size-12 items-center justify-center rounded-full bg-wheat text-cocoa mb-4">
              <SearchX className="size-6" aria-hidden />
            </div>
            <h1 className="font-display text-[28px] leading-tight text-espresso">
              We could not verify a steady salary yet
            </h1>
            <p className="text-sm text-ash mt-2 leading-relaxed">
              Nothing is wrong with your account. We read {bankLabel} and here is exactly what we
              could not see.
            </p>
          </div>

          <Card className="mt-6 animate-rise">
            <ul className="space-y-4">
              {failures.map((rule) => (
                <li key={rule.rule} className="flex gap-3">
                  <CircleAlert className="size-4.5 shrink-0 mt-0.5 text-warn" aria-hidden />
                  <p className="text-sm text-cocoa leading-relaxed">
                    {humanizeFailure(rule, verdict, config)}
                  </p>
                </li>
              ))}
            </ul>
          </Card>

          <p className="text-[13px] text-ash mt-4 leading-relaxed">
            Salaries paid in cash, or into a different bank, will not show here. If your pay lands
            somewhere else, relink that account instead.
          </p>

          <NotEligibleActions />
        </div>
      </main>
    );
  }

  const matched = [...verdict.evidence.matchedTransactions].sort((a, b) =>
    b.date.localeCompare(a.date)
  );

  return (
    <main className="flex-1 flex flex-col px-5 py-6">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        <JoinHeader step={4} showSignOut />

        <div className="mt-8 animate-rise">
          <Pill tone="good">
            <BadgeCheck className="size-3.5" aria-hidden />
            Salary verified
          </Pill>
          <h1 className="font-display text-[28px] leading-tight text-espresso mt-3">
            We checked your salary
          </h1>
          <p className="text-sm text-ash mt-2 leading-relaxed">
            Here is what {bankLabel} told us. Confirm it and we will set your limit.
          </p>
        </div>

        <Card className="mt-6 animate-rise">
          <p className="font-display text-[40px] leading-none text-espresso tnum">
            {formatNairaWhole(verdict.avgAmountKobo ?? 0)}
          </p>
          <p className="text-[13px] text-ash mt-1.5">
            average monthly salary, over {verdict.monthsFound} consecutive{" "}
            {verdict.monthsFound === 1 ? "month" : "months"}
          </p>

          <dl className="mt-5 space-y-3 border-t border-crust/70 pt-4 text-sm">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ash">Employer</dt>
              <dd className="text-espresso font-medium text-right">
                {verdict.employerGuess ?? customer.employerName}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ash">Usual pay day</dt>
              <dd className="text-espresso font-medium">
                {verdict.payDayOfMonth ? `around the ${ordinal(verdict.payDayOfMonth)}` : "varies"}
              </dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ash">Next expected pay</dt>
              <dd className="text-espresso font-medium tnum">
                {verdict.nextPayDate ? formatDate(verdict.nextPayDate) : "to be confirmed"}
              </dd>
            </div>
          </dl>
        </Card>

        <details className="group mt-4 rounded-lg border border-crust/60 bg-white shadow-1 animate-rise">
          <summary className="flex min-h-13 cursor-pointer list-none select-none items-center justify-between gap-2 px-5 py-3.5">
            <span className="text-sm font-medium text-cocoa">How we checked</span>
            <ChevronDown
              className="size-4 text-ash transition-transform group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <div className="px-5 pb-5">
            <p className="text-[13px] text-ash leading-relaxed">
              We read your statement, considered {verdict.evidence.candidateStreams} recurring
              credit {verdict.evidence.candidateStreams === 1 ? "stream" : "streams"}, and matched
              these {matched.length} salary payments.
              {verdict.evidence.amountSpreadPct !== null &&
                ` The amounts stayed within ${verdict.evidence.amountSpreadPct}% of each other.`}
            </p>
            <ul className="mt-3 divide-y divide-crust/60">
              {matched.map((tx) => (
                <li key={tx.id} className="flex items-baseline justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm text-espresso">{tx.narration}</p>
                    <p className="mt-0.5 text-xs text-ash tnum">{formatDate(tx.date)}</p>
                  </div>
                  <Money kobo={tx.amountKobo} className="shrink-0 text-sm font-medium text-good" />
                </li>
              ))}
            </ul>
          </div>
        </details>

        <SalaryConfirmBar />
      </div>
    </main>
  );
}
