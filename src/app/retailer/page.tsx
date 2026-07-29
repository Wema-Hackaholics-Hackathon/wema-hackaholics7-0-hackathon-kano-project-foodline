import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ChevronRight, ScanLine } from "lucide-react";
import { getDb } from "@/db";
import { orders, settlements } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { todayLagos, toDateOnly, formatDate, formatDateTime } from "@/lib/dates";
import { formatNairaWhole } from "@/lib/money";
import { Button, Card, EmptyState, Money, PageTitle, Stat } from "@/components/ui";
import { SettlementStatusPill } from "./settlement-status";

export const metadata: Metadata = { title: "Dashboard" };

export default async function RetailerDashboard() {
  const user = await requireRole("retailer");
  const db = getDb();

  const rows = await db
    .select({
      id: settlements.id,
      amountKobo: settlements.amountKobo,
      status: settlements.status,
      createdAt: settlements.createdAt,
      reference: settlements.reference,
      voucherCode: orders.voucherCode,
    })
    .from(settlements)
    .innerJoin(orders, eq(settlements.orderId, orders.id))
    .where(eq(settlements.retailerId, user.id))
    .orderBy(desc(settlements.createdAt));

  const today = todayLagos();
  const monthPrefix = today.slice(0, 7);

  let todayCount = 0;
  let todaySettledKobo = 0;
  let monthEarnedKobo = 0;
  let pendingCount = 0;
  for (const row of rows) {
    const day = toDateOnly(row.createdAt);
    if (day === today) {
      todayCount += 1;
      if (row.status === "success") todaySettledKobo += row.amountKobo;
    }
    if (day.startsWith(monthPrefix) && row.status === "success") {
      monthEarnedKobo += row.amountKobo;
    }
    if (row.status === "pending") pendingCount += 1;
  }

  const latest = rows.slice(0, 5);

  return (
    <div className="animate-rise">
      <PageTitle title="Dashboard" sub={formatDate(today)} />

      <Link href="/retailer/redeem" className="group block rounded-lg" aria-label="Accept a Foodline Card">
        <div className="flex items-center gap-5 rounded-lg border border-cream/10 bg-espresso p-6 text-cream shadow-2 transition-colors group-hover:bg-espresso-2">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-mango/15 text-mango">
            <ScanLine className="size-7" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl leading-tight">Accept a Foodline Card</p>
            <p className="mt-1 text-sm leading-relaxed text-cream/70">
              Scan the customer&rsquo;s QR or enter their short code. You are paid the moment you
              confirm.
            </p>
          </div>
          <ChevronRight
            className="size-5 shrink-0 text-cream/60 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
      </Link>

      <Card className="mt-5">
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3">
          <Stat
            label="Today"
            value={formatNairaWhole(todaySettledKobo)}
            sub={`${todayCount} redemption${todayCount === 1 ? "" : "s"}`}
          />
          <Stat label="This month" value={formatNairaWhole(monthEarnedKobo)} sub="Total settled" />
          {pendingCount > 0 && (
            <Stat
              label="Pending settlements"
              value={pendingCount}
              sub="Paystack is completing these"
              tone="warn"
            />
          )}
        </div>
      </Card>

      <section className="mt-7" aria-label="Latest redemptions">
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-cocoa">Latest redemptions</h2>
          {rows.length > 0 && (
            <Link
              href="/retailer/history"
              className="text-[13px] font-medium text-terra-deep hover:underline"
            >
              View all
            </Link>
          )}
        </div>
        {latest.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icon={<ScanLine className="size-6" aria-hidden />}
              title="No redemptions yet today"
              body="Accepted cards appear here the moment you confirm them."
              action={
                <Button href="/retailer/redeem" variant="secondary">
                  Accept a card
                </Button>
              }
            />
          </Card>
        ) : (
          <Card className="overflow-hidden p-0">
            <ul className="divide-y divide-crust/60">
              {latest.map((row) => (
                <li key={row.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="tnum text-sm font-medium text-espresso">{row.voucherCode}</p>
                    <p className="mt-0.5 text-[12px] text-ash">
                      {formatDateTime(row.createdAt.getTime())}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <Money kobo={row.amountKobo} className="text-sm font-medium text-espresso" />
                    <div className="mt-1">
                      <SettlementStatusPill status={row.status} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  );
}
