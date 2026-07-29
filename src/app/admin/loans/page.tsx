import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { Banknote } from "lucide-react";
import { getDb } from "@/db";
import { customers, installments, loans, orders, users } from "@/db/schema";
import { formatNaira } from "@/lib/money";
import { formatDateShort } from "@/lib/dates";
import { Card, EmptyState, PageTitle, Pill, cn, type Tone } from "@/components/ui";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "", label: "All" },
  { key: "active", label: "Active" },
  { key: "overdue", label: "Overdue" },
  { key: "repaid", label: "Repaid" },
] as const;

const STATUS_TONE: Record<string, Tone> = {
  active: "note",
  repaid: "good",
  overdue: "warn",
  cancelled: "neutral",
  defaulted: "bad",
};

export default async function LoansPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const db = getDb();

  const rows = await db
    .select({
      id: loans.id,
      status: loans.status,
      principalKobo: loans.principalKobo,
      totalRepayableKobo: loans.totalRepayableKobo,
      installmentsCount: loans.installmentsCount,
      createdAt: loans.createdAt,
      customerName: users.name,
      voucherCode: orders.voucherCode,
    })
    .from(loans)
    .innerJoin(customers, eq(loans.customerId, customers.id))
    .innerJoin(users, eq(customers.id, users.id))
    .innerJoin(orders, eq(loans.orderId, orders.id))
    .where(status ? eq(loans.status, status as "active") : undefined)
    .orderBy(desc(loans.createdAt))
    .limit(100);

  const ids = rows.map((r) => r.id);
  const paidCounts = ids.length
    ? await db
        .select({
          loanId: installments.loanId,
          paid: sql<number>`sum(case when ${installments.status} = 'paid' then 1 else 0 end)`,
          nextDue: sql<string | null>`min(case when ${installments.status} in ('scheduled','failed','overdue') then ${installments.dueDate} else null end)`,
        })
        .from(installments)
        .where(inArray(installments.loanId, ids))
        .groupBy(installments.loanId)
    : [];
  const progress = new Map(paidCounts.map((r) => [r.loanId, r]));

  return (
    <div className="space-y-5">
      <PageTitle title="Loan book" sub="Every credit line drawn against a Foodline order." />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = (status ?? "") === f.key;
          return (
            <Link
              key={f.key}
              href={f.key ? `/admin/loans?status=${f.key}` : "/admin/loans"}
              className={cn(
                "inline-flex items-center h-9 px-4 rounded-full text-sm font-medium transition-colors",
                active
                  ? "bg-terra text-white"
                  : "bg-white border border-crust text-cocoa hover:bg-cream"
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Banknote className="size-6" />}
            title="No loans in this view"
            body="Loans appear here as soon as a customer checks out with a repayment plan."
          />
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-crust bg-wheat/50">
                  <th className="px-4 py-2.5 text-[13px] font-medium text-cocoa">Customer</th>
                  <th className="px-3 py-2.5 text-[13px] font-medium text-cocoa">Order</th>
                  <th className="px-3 py-2.5 text-[13px] font-medium text-cocoa">Principal</th>
                  <th className="px-3 py-2.5 text-[13px] font-medium text-cocoa">Repayable</th>
                  <th className="px-3 py-2.5 text-[13px] font-medium text-cocoa">Progress</th>
                  <th className="px-3 py-2.5 text-[13px] font-medium text-cocoa">Status</th>
                  <th className="px-3 py-2.5 text-[13px] font-medium text-cocoa whitespace-nowrap">
                    Next due
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const p = progress.get(row.id);
                  const paid = Number(p?.paid ?? 0);
                  const pct = (paid / row.installmentsCount) * 100;
                  return (
                    <tr key={row.id} className="border-b border-crust/50 hover:bg-cream/50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/loans/${row.id}`}
                          className="text-sm text-espresso hover:text-terra-deep"
                        >
                          {row.customerName}
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-[13px] text-ash tnum">{row.voucherCode}</td>
                      <td className="px-3 py-3 text-sm text-cocoa tnum">
                        {formatNaira(row.principalKobo)}
                      </td>
                      <td className="px-3 py-3 text-sm text-cocoa tnum">
                        {formatNaira(row.totalRepayableKobo)}
                      </td>
                      <td className="px-3 py-3 min-w-28">
                        <p className="text-[13px] text-cocoa tnum">
                          {paid}/{row.installmentsCount}
                        </p>
                        <div className="h-1 w-full rounded-full bg-wheat mt-1">
                          <div
                            className="h-1 rounded-full bg-terra"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Pill tone={STATUS_TONE[row.status] ?? "neutral"}>{row.status}</Pill>
                      </td>
                      <td className="px-3 py-3 text-[13px] text-ash whitespace-nowrap">
                        {p?.nextDue ? formatDateShort(p.nextDue) : "None"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
