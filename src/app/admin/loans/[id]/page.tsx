import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import {
  customers,
  debitAttempts,
  installments,
  ledgerEvents,
  loans,
  mandates,
  orders,
  users,
} from "@/db/schema";
import { formatNaira } from "@/lib/money";
import { formatDate, formatDateTime } from "@/lib/dates";
import { Card, DarkCard, PageTitle, Pill, type Tone } from "@/components/ui";
import { CollectButton } from "../collect-button";

export const dynamic = "force-dynamic";

const INST_TONE: Record<string, Tone> = {
  scheduled: "neutral",
  processing: "note",
  paid: "good",
  failed: "bad",
  overdue: "warn",
  waived: "neutral",
};

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[13px] text-ash">{label}</p>
      <p className="text-sm text-espresso mt-0.5 tnum">{value}</p>
    </div>
  );
}

export default async function LoanDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();

  const row = (
    await db
      .select({
        loan: loans,
        customer: customers,
        user: users,
        order: orders,
        mandate: mandates,
      })
      .from(loans)
      .innerJoin(customers, eq(loans.customerId, customers.id))
      .innerJoin(users, eq(customers.id, users.id))
      .innerJoin(orders, eq(loans.orderId, orders.id))
      .leftJoin(mandates, eq(loans.mandateId, mandates.id))
      .where(eq(loans.id, id))
      .limit(1)
  )[0];
  if (!row) notFound();

  const { loan, customer, user, order, mandate } = row;

  const [schedule, attempts, timeline] = await Promise.all([
    db.select().from(installments).where(eq(installments.loanId, id)).orderBy(asc(installments.seq)),
    db
      .select()
      .from(debitAttempts)
      .where(eq(debitAttempts.loanId, id))
      .orderBy(desc(debitAttempts.createdAt)),
    db
      .select()
      .from(ledgerEvents)
      .where(eq(ledgerEvents.loanId, id))
      .orderBy(desc(ledgerEvents.createdAt))
      .limit(20),
  ]);

  return (
    <div className="space-y-5">
      <PageTitle
        title={user.name}
        sub={`Order ${order.voucherCode}, opened ${formatDate(loan.createdAt.toISOString().slice(0, 10))}`}
        right={<Pill tone={loan.status === "repaid" ? "good" : loan.status === "overdue" ? "warn" : "note"}>{loan.status}</Pill>}
      />

      <Card>
        <h2 className="font-display text-lg text-espresso mb-3">Loan</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Fact label="Principal" value={formatNaira(loan.principalKobo)} />
          <Fact label="Margin" value={`${loan.marginBps / 100}%`} />
          <Fact label="Total repayable" value={formatNaira(loan.totalRepayableKobo)} />
          <Fact label="Installments" value={loan.installmentsCount} />
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-lg text-espresso mb-3">Repayment schedule</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-crust">
                <th className="py-2 text-[13px] font-medium text-cocoa">#</th>
                <th className="py-2 text-[13px] font-medium text-cocoa">Due</th>
                <th className="py-2 text-[13px] font-medium text-cocoa">Amount</th>
                <th className="py-2 text-[13px] font-medium text-cocoa">Status</th>
                <th className="py-2 text-[13px] font-medium text-cocoa">Attempts</th>
                <th className="py-2 text-[13px] font-medium text-cocoa">Last attempt</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((inst) => (
                <tr key={inst.id} className="border-b border-crust/50">
                  <td className="py-2.5 text-sm text-cocoa tnum">{inst.seq}</td>
                  <td className="py-2.5 text-sm text-cocoa whitespace-nowrap">
                    {formatDate(inst.dueDate)}
                  </td>
                  <td className="py-2.5 text-sm text-espresso tnum">
                    {formatNaira(inst.amountKobo)}
                  </td>
                  <td className="py-2.5">
                    <Pill tone={INST_TONE[inst.status] ?? "neutral"}>{inst.status}</Pill>
                  </td>
                  <td className="py-2.5 text-sm text-cocoa tnum">{inst.attempts}</td>
                  <td className="py-2.5 text-[13px] text-ash whitespace-nowrap">
                    {inst.lastAttemptAt ? formatDateTime(inst.lastAttemptAt.getTime()) : "None"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4">
          <CollectButton loanId={loan.id} />
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <DarkCard>
          <h2 className="font-display text-lg text-cream mb-3">Mandate</h2>
          {mandate ? (
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-cream/60">Status</span>
                <span className="text-cream">{mandate.status}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-cream/60">Ready to debit</span>
                <span className="text-cream">{mandate.readyToDebit ? "Yes" : "Not yet"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-cream/60">Cap</span>
                <span className="text-cream tnum">{formatNaira(mandate.amountCapKobo)}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-cream/60">Reference</span>
                <span className="text-cream tnum text-[13px] truncate max-w-40">
                  {mandate.reference}
                </span>
              </div>
              {mandate.nibssCode && (
                <div className="flex justify-between gap-3">
                  <span className="text-cream/60">NIBSS code</span>
                  <span className="text-cream tnum text-[13px] truncate max-w-40">
                    {mandate.nibssCode}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-cream/70">No mandate is linked to this loan.</p>
          )}
        </DarkCard>

        <Card>
          <h2 className="font-display text-lg text-espresso mb-3">Customer</h2>
          <div className="space-y-2.5">
            <Fact label="Employer" value={customer.employerName} />
            <Fact
              label="Verified salary"
              value={
                customer.salaryAmountKobo ? formatNaira(customer.salaryAmountKobo) : "Not verified"
              }
            />
            <Fact label="Credit limit" value={formatNaira(customer.creditLimitKobo)} />
            <Fact
              label="Bank"
              value={`${customer.bankName ?? "Unlinked"} ${
                customer.accountNumber ? `••${customer.accountNumber.slice(-4)}` : ""
              }`}
            />
            <Fact label="Next pay date" value={customer.nextPayDate ?? "Unknown"} />
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="font-display text-lg text-espresso mb-3">Debit attempts</h2>
        {attempts.length === 0 ? (
          <p className="text-sm text-ash py-2">No debit has been attempted on this loan yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-crust">
                  <th className="py-2 text-[13px] font-medium text-cocoa">When</th>
                  <th className="py-2 text-[13px] font-medium text-cocoa">Amount</th>
                  <th className="py-2 text-[13px] font-medium text-cocoa">Trigger</th>
                  <th className="py-2 text-[13px] font-medium text-cocoa">Result</th>
                  <th className="py-2 text-[13px] font-medium text-cocoa">Reference</th>
                </tr>
              </thead>
              <tbody>
                {attempts.map((a) => (
                  <tr key={a.id} className="border-b border-crust/50">
                    <td className="py-2.5 text-[13px] text-ash whitespace-nowrap">
                      {formatDateTime(a.createdAt.getTime())}
                    </td>
                    <td className="py-2.5 text-sm text-espresso tnum">
                      {formatNaira(a.amountKobo)}
                    </td>
                    <td className="py-2.5 text-[13px] text-cocoa">
                      {a.trigger.replace(/_/g, " ")}
                    </td>
                    <td className="py-2.5">
                      <Pill
                        tone={
                          a.status === "successful" ? "good" : a.status === "failed" ? "bad" : "note"
                        }
                      >
                        {a.status}
                      </Pill>
                      {a.message && (
                        <p className="text-[13px] text-ash mt-1 max-w-60">{a.message}</p>
                      )}
                    </td>
                    <td className="py-2.5 text-[13px] text-ash tnum truncate max-w-32">
                      {a.reference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-lg text-espresso mb-3">Decision timeline</h2>
        {timeline.length === 0 ? (
          <p className="text-sm text-ash py-2">No events recorded for this loan.</p>
        ) : (
          <ul className="space-y-3">
            {timeline.map((ev) => (
              <li key={ev.id} className="flex gap-3">
                <span className="mt-1.5 size-1.5 rounded-full bg-terra shrink-0" aria-hidden />
                <div className="min-w-0">
                  <p className="text-sm text-espresso">{ev.message}</p>
                  <p className="text-[13px] text-ash tnum">
                    {formatDateTime(ev.createdAt.getTime())}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
