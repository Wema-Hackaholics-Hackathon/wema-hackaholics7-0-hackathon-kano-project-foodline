import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq, inArray } from "drizzle-orm";
import { CalendarClock, Landmark, ShieldCheck } from "lucide-react";
import { getDb } from "@/db";
import { customers, debitAttempts, installments, loans, mandates, orders } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { outstandingKobo } from "@/lib/debit-engine";
import { formatNaira, formatNairaWhole } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import {
  Button,
  Card,
  DarkCard,
  EmptyState,
  PageTitle,
  Pill,
  cn,
  type Tone,
} from "@/components/ui";
import {
  INSTALLMENT_STATUS_LABEL,
  INSTALLMENT_STATUS_TONE,
  maskAccount,
} from "../format";
import { CopyButton } from "./copy-button";

export const metadata: Metadata = { title: "Repayments" };

type LoanStatus = (typeof loans.$inferSelect)["status"];

const LOAN_STATUS_LABEL: Record<LoanStatus, string> = {
  active: "On track",
  repaid: "Repaid",
  overdue: "Overdue",
  cancelled: "Cancelled",
  defaulted: "In review",
};

const LOAN_STATUS_TONE: Record<LoanStatus, Tone> = {
  active: "terra",
  repaid: "good",
  overdue: "bad",
  cancelled: "neutral",
  defaulted: "bad",
};

type MandateStatus = (typeof mandates.$inferSelect)["status"];

const MANDATE_STATUS_LABEL: Record<MandateStatus, string> = {
  initiated: "Awaiting approval",
  approved: "Active",
  rejected: "Rejected",
  cancelled: "Cancelled",
  expired: "Expired",
};

const MANDATE_STATUS_TONE: Record<MandateStatus, Tone> = {
  initiated: "note",
  approved: "good",
  rejected: "bad",
  cancelled: "neutral",
  expired: "neutral",
};

const ATTEMPT_LABEL: Record<string, string> = {
  successful: "Collected",
  processing: "Processing",
  failed: "Failed",
};

const ATTEMPT_TONE: Record<string, Tone> = {
  successful: "good",
  processing: "note",
  failed: "warn",
};

export default async function RepaymentsPage() {
  const user = await requireRole("customer");
  const db = getDb();

  const customer = (
    await db.select().from(customers).where(eq(customers.id, user.id)).limit(1)
  )[0];

  const outstanding = await outstandingKobo(db, user.id);

  const loanRows = await db
    .select({ loan: loans, orderCode: orders.voucherCode })
    .from(loans)
    .innerJoin(orders, eq(loans.orderId, orders.id))
    .where(eq(loans.customerId, user.id))
    .orderBy(desc(loans.createdAt));

  const instRows =
    loanRows.length === 0
      ? []
      : await db
          .select()
          .from(installments)
          .where(
            inArray(
              installments.loanId,
              loanRows.map((r) => r.loan.id)
            )
          )
          .orderBy(asc(installments.seq));
  const instByLoan = new Map<string, (typeof instRows)[number][]>();
  for (const inst of instRows) {
    const list = instByLoan.get(inst.loanId) ?? [];
    list.push(inst);
    instByLoan.set(inst.loanId, list);
  }

  const mandate = (
    await db
      .select()
      .from(mandates)
      .where(eq(mandates.customerId, user.id))
      .orderBy(desc(mandates.createdAt))
      .limit(1)
  )[0];

  const attempts = await db
    .select({
      id: debitAttempts.id,
      amountKobo: debitAttempts.amountKobo,
      status: debitAttempts.status,
      reference: debitAttempts.reference,
      message: debitAttempts.message,
      createdAt: debitAttempts.createdAt,
    })
    .from(debitAttempts)
    .innerJoin(loans, eq(debitAttempts.loanId, loans.id))
    .where(eq(loans.customerId, user.id))
    .orderBy(desc(debitAttempts.createdAt))
    .limit(5);

  const openLoans = loanRows.filter(
    (r) => r.loan.status === "active" || r.loan.status === "overdue"
  ).length;

  return (
    <div className="mx-auto w-full max-w-xl animate-rise">
      <PageTitle
        title="Repayments"
        sub="Every plan, every installment, every debit. Nothing hidden."
      />

      {/* Summary */}
      <Card className="p-5">
        <p className="text-[13px] text-ash">Total outstanding</p>
        <p className="mt-0.5 font-display text-3xl text-espresso tnum">
          {formatNaira(outstanding)}
        </p>
        <p className="mt-1 text-[13px] text-ash">
          {outstanding === 0
            ? "Nothing outstanding. You are all clear."
            : `Across ${openLoans} open plan${openLoans === 1 ? "" : "s"}, collected from your salary on payday.`}
        </p>
      </Card>

      {/* Loans */}
      <section aria-label="Repayment plans" className="mt-5 space-y-4">
        {loanRows.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icon={<CalendarClock className="size-6" aria-hidden />}
              title="No repayments yet"
              body="When you shop with your credit line, your repayment plan appears here, clear and exact."
              action={<Button href="/app/shop">Shop foodstuff</Button>}
            />
          </Card>
        ) : (
          loanRows.map(({ loan, orderCode }) => {
            const insts = instByLoan.get(loan.id) ?? [];
            const paid = insts.filter((i) => i.status === "paid" || i.status === "waived").length;
            const progress = insts.length > 0 ? paid / insts.length : 0;
            const marginKobo = loan.totalRepayableKobo - loan.principalKobo;
            return (
              <Card key={loan.id} className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/app/card/${loan.orderId}`}
                      className="text-[15px] font-medium text-espresso tnum hover:underline"
                    >
                      {orderCode}
                    </Link>
                    <p className="mt-0.5 text-[13px] text-ash">
                      {formatDateTime(loan.createdAt.getTime())}
                    </p>
                  </div>
                  <Pill tone={LOAN_STATUS_TONE[loan.status]}>
                    {LOAN_STATUS_LABEL[loan.status]}
                  </Pill>
                </div>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-[13px]">
                    <span className="text-cocoa tnum">
                      {paid} of {insts.length} installment{insts.length === 1 ? "" : "s"} paid
                    </span>
                    <span className="font-medium text-espresso tnum">
                      {formatNaira(loan.totalRepayableKobo)} total
                    </span>
                  </div>
                  <div
                    className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-wheat"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={insts.length}
                    aria-valuenow={paid}
                    aria-label={`${paid} of ${insts.length} installments paid`}
                  >
                    <div
                      className={cn(
                        "h-full rounded-full transition-[width] duration-500",
                        loan.status === "repaid" ? "bg-good" : "bg-terra"
                      )}
                      style={{ width: `${Math.max(progress * 100, paid > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                </div>

                <ul className="mt-4 divide-y divide-crust/60">
                  {insts.map((inst) => (
                    <li key={inst.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="text-sm text-espresso tnum">
                          {inst.seq}. Due {formatDate(inst.dueDate)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2.5">
                        <span className="text-sm font-medium text-espresso tnum">
                          {formatNaira(inst.amountKobo)}
                        </span>
                        <Pill tone={INSTALLMENT_STATUS_TONE[inst.status]}>
                          {INSTALLMENT_STATUS_LABEL[inst.status]}
                        </Pill>
                      </div>
                    </li>
                  ))}
                </ul>

                <p className="mt-3 border-t border-crust/60 pt-3 text-[12px] text-ash tnum">
                  {formatNaira(loan.principalKobo)} foodstuff + {formatNaira(marginKobo)} margin (
                  {loan.marginBps / 100}%). No other charges.
                </p>
              </Card>
            );
          })
        )}
      </section>

      {/* Mandate panel: dark trust surface */}
      {mandate && (
        <section aria-label="Repayment mandate" className="mt-6">
          <DarkCard className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex size-9 items-center justify-center rounded-full bg-cream/10 text-mango">
                  <ShieldCheck className="size-4.5" aria-hidden />
                </span>
                <h2 className="font-display text-lg text-cream">Salary mandate</h2>
              </div>
              <Pill tone={MANDATE_STATUS_TONE[mandate.status]}>
                {MANDATE_STATUS_LABEL[mandate.status]}
              </Pill>
            </div>

            <dl className="mt-4 space-y-2.5 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-cream/60">Account</dt>
                <dd className="flex items-center gap-1.5 text-cream tnum">
                  <Landmark className="size-3.5 text-cream/60" aria-hidden />
                  {mandate.bankName ?? customer?.bankName ?? "Linked bank"}{" "}
                  {maskAccount(mandate.accountNumber ?? customer?.accountNumber ?? "")}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-cream/60">Debit cap</dt>
                <dd className="text-cream tnum">{formatNairaWhole(mandate.amountCapKobo)}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-cream/60">Valid until</dt>
                <dd className="text-cream tnum">{formatDate(mandate.endDate)}</dd>
              </div>
              {mandate.nibssCode && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-cream/60">NIBSS code</dt>
                  <dd className="flex items-center gap-1 text-cream tnum">
                    {mandate.nibssCode}
                    <CopyButton value={mandate.nibssCode} label="Copy NIBSS mandate code" />
                  </dd>
                </div>
              )}
            </dl>

            {mandate.status === "approved" && (
              <p
                className={cn(
                  "mt-4 rounded-md px-3.5 py-2.5 text-[13px] leading-relaxed",
                  mandate.readyToDebit || mandate.isDemo
                    ? "bg-good/20 text-cream"
                    : "bg-mango/15 text-cream"
                )}
              >
                {mandate.readyToDebit || mandate.isDemo
                  ? "Ready. Repayments are collected automatically on payday, and only the amounts named in your plan above."
                  : "Approved and activating. NIBSS applies a short waiting period before debits can start, and no debit will happen until it clears."}
              </p>
            )}

            <p className="mt-4 text-[13px] leading-relaxed text-cream/70">
              We debit only your agreed repayment, only on payday. Nothing more, nothing else.
              Repaying early or cancelling never carries a penalty.
            </p>
            <Link
              href="/app/support"
              className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-cream underline decoration-cream/40 underline-offset-4 hover:decoration-cream"
            >
              Cancel mandate or talk to us
            </Link>
          </DarkCard>
        </section>
      )}

      {/* Debit history */}
      {attempts.length > 0 && (
        <section aria-label="Debit history" className="mt-5">
          <Card className="p-0">
            <h2 className="border-b border-crust/60 px-5 py-3.5 text-sm font-medium text-cocoa">
              Recent debits, for the record
            </h2>
            <ul className="divide-y divide-crust/60">
              {attempts.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm text-espresso tnum">
                      {formatDateTime(a.createdAt.getTime())}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-ash tnum">
                      Ref {a.reference}
                      {a.status === "failed" && a.message ? ` · ${a.message}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2.5">
                    <span className="text-sm font-medium text-espresso tnum">
                      {formatNaira(a.amountKobo)}
                    </span>
                    <Pill tone={ATTEMPT_TONE[a.status] ?? "neutral"}>
                      {ATTEMPT_LABEL[a.status] ?? a.status}
                    </Pill>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}
    </div>
  );
}
