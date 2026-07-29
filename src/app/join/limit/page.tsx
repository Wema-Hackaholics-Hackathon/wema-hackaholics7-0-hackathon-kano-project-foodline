import type { Metadata } from "next";
import { CalendarCheck } from "lucide-react";
import { getDb } from "@/db";
import { getConfig } from "@/lib/settings";
import { formatDate } from "@/lib/dates";
import { Button, Card, Divider } from "@/components/ui";
import { requireJoinPage } from "../flow";
import { JoinHeader, PinnedCta, bpsToPct } from "../join-ui";
import { LimitReveal } from "./limit-reveal";

export const metadata: Metadata = { title: "You are approved" };

export default async function LimitPage() {
  const { user, customer } = await requireJoinPage("limit");
  const db = getDb();
  const config = await getConfig(db);

  const firstName = user.name.trim().split(/\s+/)[0];
  const plans = [...config.installmentPlans].sort((a, b) => a.installments - b.installments);

  return (
    <main className="flex-1 flex flex-col px-5 py-6">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        <JoinHeader step={5} showSignOut />

        <LimitReveal limitKobo={customer.creditLimitKobo} firstName={firstName} />

        <Card className="mt-8 animate-rise">
          <h2 className="text-sm font-semibold text-espresso">Clear terms, before you spend</h2>
          <ul className="mt-3 space-y-2.5">
            {plans.map((plan) => (
              <li key={plan.installments} className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-cocoa">
                  {plan.installments} {plan.installments === 1 ? "installment" : "installments"}
                </span>
                <span className="text-espresso font-medium tnum">
                  {bpsToPct(plan.marginBps)}% margin
                </span>
              </li>
            ))}
          </ul>
          <Divider className="my-4" />
          <p className="text-[13px] text-cocoa leading-relaxed">
            No hidden charges: what you see at checkout is exactly what you repay.
          </p>
          {customer.nextPayDate && (
            <p className="flex items-center gap-2 text-[13px] text-ash mt-2.5">
              <CalendarCheck className="size-4 shrink-0 text-good" aria-hidden />
              Repayments line up with your payday. The next one is {formatDate(customer.nextPayDate)}.
            </p>
          )}
        </Card>

        <PinnedCta>
          <Button size="lg" href="/join/mandate" className="w-full">
            Set up repayment
          </Button>
        </PinnedCta>
      </div>
    </main>
  );
}
