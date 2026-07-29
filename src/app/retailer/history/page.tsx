import { desc, eq } from "drizzle-orm";
import { ReceiptText } from "lucide-react";
import { getDb } from "@/db";
import { orders, settlements } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { formatNaira, formatNairaWhole } from "@/lib/money";
import { formatDate, todayLagos, addDays } from "@/lib/dates";
import { Button, Card, EmptyState, PageTitle } from "@/components/ui";
import { SettlementStatusPill } from "../settlement-status";

export const dynamic = "force-dynamic";

const LAGOS_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const LAGOS_TIME = new Intl.DateTimeFormat("en-NG", {
  timeZone: "Africa/Lagos",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export default async function RetailerHistory() {
  const retailer = await requireRole("retailer");
  const db = getDb();

  const rows = await db
    .select({
      id: settlements.id,
      amountKobo: settlements.amountKobo,
      status: settlements.status,
      reference: settlements.reference,
      createdAt: settlements.createdAt,
      settledAt: settlements.settledAt,
      voucherCode: orders.voucherCode,
    })
    .from(settlements)
    .innerJoin(orders, eq(settlements.orderId, orders.id))
    .where(eq(settlements.retailerId, retailer.id))
    .orderBy(desc(settlements.createdAt))
    .limit(200);

  const totalEarned = rows
    .filter((r) => r.status === "success")
    .reduce((sum, r) => sum + r.amountKobo, 0);

  const today = todayLagos();
  const yesterday = addDays(today, -1);
  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = LAGOS_DAY.format(row.createdAt);
    const existing = groups.get(key);
    if (existing) existing.push(row);
    else groups.set(key, [row]);
  }

  const groupLabel = (key: string) =>
    key === today ? "Today" : key === yesterday ? "Yesterday" : formatDate(key);

  return (
    <div className="space-y-5">
      <PageTitle title="Settlement history" sub="Every card you have accepted, and what we paid you." />

      {rows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ReceiptText className="size-6" />}
            title="No settlements yet"
            body="When you accept a Foodline Card, the payment lands in your settlement account and shows up here with its reference."
            action={<Button href="/retailer/redeem">Accept a card</Button>}
          />
        </Card>
      ) : (
        <>
          <div className="sticky top-0 z-10 -mx-5 px-5 py-3 bg-oat/95 backdrop-blur border-b border-crust/60 md:mx-0 md:px-0 md:border-0 md:bg-transparent md:backdrop-blur-none md:static">
            <Card className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="text-[13px] text-ash">Total earned</p>
                <p className="font-display text-2xl text-espresso tnum">
                  {formatNairaWhole(totalEarned)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[13px] text-ash">Settlements</p>
                <p className="font-display text-2xl text-espresso tnum">{rows.length}</p>
              </div>
            </Card>
          </div>

          <div className="space-y-5">
            {[...groups.entries()].map(([key, items]) => (
              <section key={key}>
                <h2 className="text-[13px] font-medium text-ash mb-2 px-1">{groupLabel(key)}</h2>
                <Card className="p-0 overflow-hidden">
                  <ul className="divide-y divide-crust/60">
                    {items.map((row) => (
                      <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3">
                        <div className="min-w-0">
                          <p className="text-sm text-espresso tnum">{row.voucherCode}</p>
                          <p
                            className="text-[13px] text-ash truncate max-w-60"
                            title={row.reference}
                          >
                            {row.reference}
                          </p>
                          <p className="text-[13px] text-ash tnum mt-0.5">
                            {LAGOS_TIME.format(row.settledAt ?? row.createdAt)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-medium text-espresso tnum">
                            {formatNaira(row.amountKobo)}
                          </p>
                          <div className="mt-1">
                            <SettlementStatusPill status={row.status} />
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Card>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
