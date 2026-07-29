"use client";

import { useActionState, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, Notice, Select, cn, inputCls } from "@/components/ui";
import type { LendingConfig } from "@/lib/settings";
import { saveLendingConfig, type ConfigState } from "./actions";

function Row({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-3 border-b border-crust/50 last:border-0 grid md:grid-cols-[1fr_220px] gap-2 md:gap-6 md:items-center">
      <div className="min-w-0">
        <p className="text-sm font-medium text-espresso">{label}</p>
        <p className="text-[13px] text-ash leading-snug mt-0.5">{hint}</p>
        {error && <p className="text-[13px] text-bad mt-1">{error}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <h2 className="font-display text-lg text-espresso mb-1">{title}</h2>
      <div>{children}</div>
    </Card>
  );
}

const naira = (kobo: number) => String(Math.round(kobo / 100));

export function LendingForm({ config }: { config: LendingConfig }) {
  const [state, formAction, pending] = useActionState<ConfigState, FormData>(saveLendingConfig, {
    errors: {},
    saved: false,
  });
  const [plans, setPlans] = useState(
    config.installmentPlans.map((p) => ({
      installments: String(p.installments),
      margin: String(p.marginBps / 100),
    }))
  );

  const e = state.errors;

  return (
    <form action={formAction} className="space-y-4">
      <Notice tone="note">
        Changes apply immediately to new decisions. No redeploy needed.
      </Notice>

      {state.saved && Object.keys(e).length === 0 && (
        <Notice tone="good">Configuration saved. New applications use these rules from now.</Notice>
      )}
      {e.form && <Notice tone="bad">{e.form}</Notice>}

      <Section title="Credit limits">
        <Row
          label="Limit percentage"
          hint="Share of verified monthly salary offered as credit."
          error={e.limitPercent}
        >
          <div className="relative">
            <input
              name="limitPercent"
              defaultValue={config.limitPercent}
              inputMode="numeric"
              className={cn(inputCls, "pr-9 tnum")}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ash text-sm">%</span>
          </div>
        </Row>
        <Row
          label="Minimum limit"
          hint="Applicants below this are declined rather than given a token limit."
          error={e.minLimitKobo}
        >
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ash text-sm">₦</span>
            <input
              name="minLimitKobo"
              defaultValue={naira(config.minLimitKobo)}
              inputMode="numeric"
              className={cn(inputCls, "pl-8 tnum")}
            />
          </div>
        </Row>
        <Row
          label="Maximum limit"
          hint="Ceiling regardless of salary, for portfolio concentration."
          error={e.maxLimitKobo}
        >
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ash text-sm">₦</span>
            <input
              name="maxLimitKobo"
              defaultValue={naira(config.maxLimitKobo)}
              inputMode="numeric"
              className={cn(inputCls, "pl-8 tnum")}
            />
          </div>
        </Row>
      </Section>

      <Section title="Eligibility">
        <Row
          label="Minimum salary months"
          hint="Consecutive months of salary required before we lend."
          error={e.minSalaryMonths}
        >
          <input
            name="minSalaryMonths"
            defaultValue={config.minSalaryMonths}
            inputMode="numeric"
            className={cn(inputCls, "tnum")}
          />
        </Row>
        <Row
          label="Amount tolerance"
          hint="How far a salary payment may deviate from the average and still count."
          error={e.tolerancePct}
        >
          <div className="relative">
            <input
              name="tolerancePct"
              defaultValue={config.tolerancePct}
              inputMode="numeric"
              className={cn(inputCls, "pr-9 tnum")}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ash text-sm">%</span>
          </div>
        </Row>
        <Row
          label="Salary floor"
          hint="Minimum verified monthly salary to qualify at all."
          error={e.salaryFloorKobo}
        >
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-ash text-sm">₦</span>
            <input
              name="salaryFloorKobo"
              defaultValue={naira(config.salaryFloorKobo)}
              inputMode="numeric"
              className={cn(inputCls, "pl-8 tnum")}
            />
          </div>
        </Row>
      </Section>

      <Section title="Repayment plans">
        <p className="text-[13px] text-ash mb-3">
          What the customer can choose at checkout. The margin is added to the order total and split
          across the installments.
        </p>
        {e.plans && <p className="text-[13px] text-bad mb-2">{e.plans}</p>}
        <div className="space-y-2">
          {plans.map((plan, i) => (
            <div key={i} className="flex items-end gap-2">
              <label className="flex-1">
                <span className="block text-[13px] text-cocoa mb-1">Installments</span>
                <input
                  name="planInstallments"
                  value={plan.installments}
                  onChange={(ev) =>
                    setPlans((p) =>
                      p.map((row, idx) =>
                        idx === i ? { ...row, installments: ev.target.value } : row
                      )
                    )
                  }
                  inputMode="numeric"
                  className={cn(inputCls, "tnum")}
                />
              </label>
              <label className="flex-1">
                <span className="block text-[13px] text-cocoa mb-1">Margin %</span>
                <input
                  name="planMargin"
                  value={plan.margin}
                  onChange={(ev) =>
                    setPlans((p) =>
                      p.map((row, idx) => (idx === i ? { ...row, margin: ev.target.value } : row))
                    )
                  }
                  inputMode="decimal"
                  className={cn(inputCls, "tnum")}
                />
              </label>
              <button
                type="button"
                onClick={() => setPlans((p) => p.filter((_, idx) => idx !== i))}
                disabled={plans.length === 1}
                aria-label={`Remove plan ${i + 1}`}
                className="flex size-12 shrink-0 items-center justify-center rounded-md text-ash hover:text-bad hover:bg-bad-tint disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-ash"
              >
                <Trash2 className="size-4.5" />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setPlans((p) => [...p, { installments: "", margin: "" }])}
          className="mt-3 inline-flex items-center gap-1.5 text-sm text-terra-deep hover:underline h-11"
        >
          <Plus className="size-4" /> Add a plan
        </button>
      </Section>

      <Section title="Collections">
        <Row
          label="Debit trigger"
          hint="Collect the moment salary is detected, or wait for the scheduled due date."
        >
          <Select name="debitTrigger" defaultValue={config.debitTrigger}>
            <option value="salary_detection">On salary detection</option>
            <option value="fixed_date">On due date</option>
          </Select>
        </Row>
        <Row
          label="Fallback debit days"
          hint="Days after the due date before we debit anyway without a salary signal."
          error={e.fallbackDebitDays}
        >
          <input
            name="fallbackDebitDays"
            defaultValue={config.fallbackDebitDays}
            inputMode="numeric"
            className={cn(inputCls, "tnum")}
          />
        </Row>
        <Row
          label="Retry interval"
          hint="Days to wait between attempts on a failed debit."
          error={e.retryIntervalDays}
        >
          <input
            name="retryIntervalDays"
            defaultValue={config.retryIntervalDays}
            inputMode="numeric"
            className={cn(inputCls, "tnum")}
          />
        </Row>
        <Row
          label="Maximum retries"
          hint="Attempts per installment before it stops being retried."
          error={e.maxRetries}
        >
          <input
            name="maxRetries"
            defaultValue={config.maxRetries}
            inputMode="numeric"
            className={cn(inputCls, "tnum")}
          />
        </Row>
        <Row
          label="Grace period"
          hint="Days past due, after retries are exhausted, before an installment is marked overdue."
          error={e.graceDays}
        >
          <input
            name="graceDays"
            defaultValue={config.graceDays}
            inputMode="numeric"
            className={cn(inputCls, "tnum")}
          />
        </Row>
      </Section>

      <Section title="Cards and mandates">
        <Row
          label="Card expiry"
          hint="Hours a Foodline Card stays valid before the credit is released back."
          error={e.cardExpiryHours}
        >
          <div className="relative">
            <input
              name="cardExpiryHours"
              defaultValue={config.cardExpiryHours}
              inputMode="numeric"
              className={cn(inputCls, "pr-14 tnum")}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ash text-sm">hours</span>
          </div>
        </Row>
        <Row
          label="Mandate cap multiplier"
          hint="1.1 means the mandate cap is 110% of the customer limit, leaving room for margin."
          error={e.mandateCapMultiplier}
        >
          <input
            name="mandateCapMultiplier"
            defaultValue={config.mandateCapMultiplier}
            inputMode="decimal"
            className={cn(inputCls, "tnum")}
          />
        </Row>
        <Row
          label="Mandate validity"
          hint="How many months a standing mandate stays valid before renewal."
          error={e.mandateMonths}
        >
          <div className="relative">
            <input
              name="mandateMonths"
              defaultValue={config.mandateMonths}
              inputMode="numeric"
              className={cn(inputCls, "pr-16 tnum")}
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ash text-sm">months</span>
          </div>
        </Row>
        <Row
          label="Demo mode"
          hint="Enables the demo salary account, simulated mandates and the judge login panel."
        >
          <label className="inline-flex items-center gap-2 h-12">
            <input
              type="checkbox"
              name="demoMode"
              defaultChecked={config.demoMode}
              className="size-5 accent-[var(--color-terra)]"
            />
            <span className="text-sm text-cocoa">Demo mode on</span>
          </label>
        </Row>
      </Section>

      <div className="sticky bottom-0 bg-oat/95 backdrop-blur py-3 -mx-5 px-5 md:mx-0 md:px-0 border-t border-crust/60">
        <Button type="submit" size="lg" loading={pending}>
          Save configuration
        </Button>
      </div>
    </form>
  );
}
