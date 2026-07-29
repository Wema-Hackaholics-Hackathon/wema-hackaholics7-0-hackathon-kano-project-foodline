import Link from "next/link";
import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import {
  ArrowRight,
  CircleCheck,
  CircleDollarSign,
  ClipboardCheck,
  Clock,
  TriangleAlert,
  Ban,
  Store,
} from "lucide-react";
import { getDb } from "@/db";
import {
  customers,
  debitAttempts,
  installments,
  loans,
  orders,
  retailers,
  settlements,
  users,
} from "@/db/schema";
import { formatNaira, formatNairaWhole } from "@/lib/money";
import { addDays, formatDate, formatDateShort, formatDateTime, todayLagos } from "@/lib/dates";
import { getConfig } from "@/lib/settings";
import { pendingCounts } from "@/lib/approvals";
import { Card, EmptyState, PageTitle, Pill, Stat } from "@/components/ui";
import { RedemptionsChart, type Day } from "./redemptions-chart";

export const dynamic = "force-dynamic";

const OPEN_LOANS = ["active", "overdue"] as const;
const UNPAID = ["scheduled", "processing", "failed", "overdue"] as const;

export default async function AdminDashboard() {
  const db = getDb();
  const config = await getConfig(db);
  const waiting = await pendingCounts(db);
  const today = todayLagos();
  const monthStart = new Date(`${today.slice(0, 7)}-01T00:00:00Z`);
  const dayStart = new Date(`${today}T00:00:00Z`);

  // Outstanding book, and the slice of it sitting on overdue loans
  const [outstandingRows, loanCounts, collectedRows, settledRows] = await Promise.all([
    db
      .select({
        status: loans.status,
        total: sql<number>`coalesce(sum(${installments.amountKobo}), 0)`,
      })
      .from(installments)
      .innerJoin(loans, eq(installments.loanId, loans.id))
      .where(and(inArray(loans.status, [...OPEN_LOANS]), inArray(installments.status, [...UNPAID])))
      .groupBy(loans.status),
    db
      .select({ status: loans.status, n: sql<number>`count(*)` })
      .from(loans)
      .groupBy(loans.status),
    db
      .select({ total: sql<number>`coalesce(sum(${debitAttempts.amountKobo}), 0)` })
      .from(debitAttempts)
      .where(and(eq(debitAttempts.status, "successful"), gte(debitAttempts.createdAt, monthStart))),
    db
      .select({ total: sql<number>`coalesce(sum(${settlements.amountKobo}), 0)` })
      .from(settlements)
      .where(and(eq(settlements.status, "success"), gte(settlements.createdAt, dayStart))),
  ]);

  const outstandingTotal = outstandingRows.reduce((s, r) => s + Number(r.total), 0);
  const overdueOutstanding = Number(
    outstandingRows.find((r) => r.status === "overdue")?.total ?? 0
  );
  const activeLoanCount = loanCounts
    .filter((r) => OPEN_LOANS.includes(r.status as "active" | "overdue"))
    .reduce((s, r) => s + Number(r.n), 0);
  const parPct = outstandingTotal > 0 ? (overdueOutstanding / outstandingTotal) * 100 : 0;

  // Redemptions, last 14 days, bucketed by Lagos day
  const windowStart = new Date(`${addDays(today, -13)}T00:00:00Z`);
  const redeemed = await db
    .select({ redeemedAt: orders.redeemedAt, totalKobo: orders.totalKobo })
    .from(orders)
    .where(and(isNotNull(orders.redeemedAt), gte(orders.redeemedAt, windowStart)));
  const buckets = new Map<string, { count: number; totalKobo: number }>();
  for (let i = 13; i >= 0; i--) {
    buckets.set(addDays(today, -i), { count: 0, totalKobo: 0 });
  }
  for (const row of redeemed) {
    if (!row.redeemedAt) continue;
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Africa/Lagos",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(row.redeemedAt);
    const b = buckets.get(key);
    if (b) {
      b.count++;
      b.totalKobo += row.totalKobo;
    }
  }
  const days: Day[] = [...buckets.entries()].map(([date, v]) => ({ date, ...v }));
  const hasRedemptions = days.some((d) => d.count > 0);

  // Upcoming debits, next 14 days
  const upcoming = await db
    .select({
      id: installments.id,
      amountKobo: installments.amountKobo,
      dueDate: installments.dueDate,
      name: users.name,
    })
    .from(installments)
    .innerJoin(loans, eq(installments.loanId, loans.id))
    .innerJoin(customers, eq(loans.customerId, customers.id))
    .innerJoin(users, eq(customers.id, users.id))
    .where(
      and(
        eq(installments.status, "scheduled"),
        gte(installments.dueDate, today),
        lte(installments.dueDate, addDays(today, 14))
      )
    )
    .orderBy(installments.dueDate)
    .limit(9);

  // Live redemption feed
  const feed = await db
    .select({
      id: orders.id,
      voucherCode: orders.voucherCode,
      totalKobo: orders.totalKobo,
      redeemedAt: orders.redeemedAt,
      status: orders.status,
      retailer: retailers.businessName,
    })
    .from(orders)
    .leftJoin(retailers, eq(orders.redeemedByRetailerId, retailers.id))
    .where(inArray(orders.status, ["redeemed", "settled"]))
    .orderBy(desc(orders.redeemedAt))
    .limit(8);

  const bookRows = [
    { key: "active", label: "Active", icon: CircleDollarSign, tone: "note" as const },
    { key: "repaid", label: "Repaid", icon: CircleCheck, tone: "good" as const },
    { key: "overdue", label: "Overdue", icon: TriangleAlert, tone: "warn" as const },
    { key: "defaulted", label: "Defaulted", icon: Ban, tone: "bad" as const },
  ];

  return (
    <div className="space-y-6">
      <PageTitle
        title="Operations"
        sub={`Live portfolio as at ${formatDate(today)}. Debits fire ${
          config.debitTrigger === "salary_detection" ? "on salary detection" : "on the due date"
        }.`}
      />

      {waiting.total > 0 && (
        <Link href="/admin/approvals" className="block group">
          <Card className="bg-warn-tint border-warn/25 hover:border-warn/50 transition-colors">
            <div className="flex items-center gap-4">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white text-warn">
                <ClipboardCheck className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg text-warn leading-tight">
                  <span className="tnum">{waiting.total}</span> waiting for approval
                </p>
                <p className="text-[13px] text-warn/85 mt-0.5 leading-relaxed">
                  {waiting.retailers} shop application{waiting.retailers === 1 ? "" : "s"} and{" "}
                  {waiting.products} product listing{waiting.products === 1 ? "" : "s"}. Shops
                  cannot trade and listings stay off the shelf until you decide.
                </p>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0 text-sm font-medium text-warn">
                Open the queue
                <ArrowRight
                  className="size-4 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </span>
            </div>
          </Card>
        </Link>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <Stat
            label="Active loans"
            value={activeLoanCount}
            sub={`${formatNairaWhole(outstandingTotal)} outstanding`}
          />
        </Card>
        <Card>
          <Stat
            label="Portfolio at risk"
            value={`${parPct.toFixed(1)}%`}
            sub={formatNairaWhole(overdueOutstanding)}
            tone={parPct > 10 ? "bad" : parPct > 0 ? "warn" : undefined}
          />
        </Card>
        <Card>
          <Stat
            label="Collected this month"
            value={formatNairaWhole(Number(collectedRows[0]?.total ?? 0))}
            sub="Successful debits"
            tone="good"
          />
        </Card>
        <Card>
          <Stat
            label="Settled today"
            value={formatNairaWhole(Number(settledRows[0]?.total ?? 0))}
            sub="Paid to retailers"
          />
        </Card>
      </div>

      <Card>
        <h2 className="font-display text-lg text-espresso mb-1">Redemptions, last 14 days</h2>
        <p className="text-[13px] text-ash mb-4">
          Cards honoured at partner stores, by day.
        </p>
        {hasRedemptions ? (
          <RedemptionsChart days={days} />
        ) : (
          <EmptyState
            icon={<Store className="size-6" />}
            title="No redemptions in this window"
            body="Once a customer shows their Foodline Card at a partner store, it appears here the moment the retailer confirms."
          />
        )}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <h2 className="font-display text-lg text-espresso mb-3">Upcoming debits</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-ash py-4">
              No installments fall due in the next 14 days.
            </p>
          ) : (
            <ul className="divide-y divide-crust/60">
              {upcoming.slice(0, 8).map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-espresso truncate">{row.name}</p>
                    <p className="text-[13px] text-ash">
                      {formatDateShort(row.dueDate)},{" "}
                      {config.debitTrigger === "salary_detection"
                        ? "on salary detection"
                        : "on due date"}
                    </p>
                  </div>
                  <span className="text-sm text-espresso tnum shrink-0">
                    {formatNaira(row.amountKobo)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {upcoming.length > 8 && (
            <p className="text-[13px] text-ash mt-2">Plus more beyond the next 8 shown.</p>
          )}
        </Card>

        <Card>
          <h2 className="font-display text-lg text-espresso mb-3">Live redemption feed</h2>
          {feed.length === 0 ? (
            <p className="text-sm text-ash py-4">No cards have been redeemed yet.</p>
          ) : (
            <ul className="divide-y divide-crust/60">
              {feed.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm text-espresso tnum">{row.voucherCode}</p>
                    <p className="text-[13px] text-ash truncate">
                      {row.retailer ?? "Unknown store"}
                      {row.redeemedAt ? `, ${formatDateTime(row.redeemedAt.getTime())}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm text-espresso tnum">{formatNaira(row.totalKobo)}</p>
                    <Pill tone={row.status === "settled" ? "good" : "warn"}>
                      {row.status === "settled" ? "Settled" : "Redeemed"}
                    </Pill>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="font-display text-lg text-espresso mb-3">Loan book</h2>
        <div className="flex flex-wrap gap-2">
          {bookRows.map((row) => {
            const Icon = row.icon;
            const n = Number(loanCounts.find((r) => r.status === row.key)?.n ?? 0);
            const amount = Number(
              outstandingRows.find((r) => r.status === row.key)?.total ?? 0
            );
            return (
              <Pill key={row.key} tone={row.tone} className="px-3 py-1.5 text-[13px]">
                <Icon className="size-3.5" aria-hidden />
                {row.label}: <span className="tnum font-semibold">{n}</span>
                {amount > 0 && <span className="tnum opacity-80">({formatNairaWhole(amount)})</span>}
              </Pill>
            );
          })}
        </div>
        <p className="text-[13px] text-ash mt-3">
          Every limit, debit and settlement decision is recorded in the{" "}
          <Link href="/admin/ledger" className="text-terra-deep hover:underline">
            audit ledger
          </Link>
          .
        </p>
      </Card>
    </div>
  );
}
