import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { Inbox, Clock, CircleCheck } from "lucide-react";
import { getDb } from "@/db";
import { orderItems, orders, users } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { Button, Card, EmptyState, PageTitle, Pill } from "@/components/ui";

export const dynamic = "force-dynamic";

/** "Adaeze Chiamaka Okafor" -> "Adaeze O." */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Foodline customer";
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

export default async function RetailerOrders() {
  const retailer = await requireRole("retailer");
  const db = getDb();

  const rows = await db
    .select({
      id: orders.id,
      voucherCode: orders.voucherCode,
      totalKobo: orders.totalKobo,
      issuedAt: orders.issuedAt,
      expiresAt: orders.expiresAt,
      customerConfirmedAt: orders.customerConfirmedAt,
      retailerConfirmedAt: orders.retailerConfirmedAt,
      customerName: users.name,
    })
    .from(orders)
    .innerJoin(users, eq(orders.customerId, users.id))
    .where(
      and(
        eq(orders.pickupRetailerId, retailer.id),
        inArray(orders.status, ["issued", "redeemed"])
      )
    )
    .orderBy(desc(orders.issuedAt))
    .limit(50);

  const live = rows.filter((r) => r.expiresAt.getTime() > Date.now());
  const ids = live.map((r) => r.id);
  const items = ids.length
    ? await db.select().from(orderItems).where(inArray(orderItems.orderId, ids))
    : [];
  const byOrder = new Map<string, typeof items>();
  for (const item of items) {
    const list = byOrder.get(item.orderId);
    if (list) list.push(item);
    else byOrder.set(item.orderId, [item]);
  }

  return (
    <div className="space-y-5">
      <PageTitle
        title="Incoming orders"
        sub="Cards customers sent to your shop. Check the basket against your shelves, then confirm when they arrive."
      />

      {live.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox className="size-6" />}
            title="No orders waiting"
            body="When a customer picks your shop at checkout, their card lands here straight away, before they walk in."
            action={<Button href="/retailer/redeem">Accept a card by scan</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {live.map((order) => {
            const lines = byOrder.get(order.id) ?? [];
            const waitingForCustomer = Boolean(order.retailerConfirmedAt);
            return (
              <Card key={order.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-espresso">
                      {shortName(order.customerName)}
                    </p>
                    <p className="text-[13px] text-ash tnum">
                      {order.voucherCode}, sent {formatDateTime(order.issuedAt.getTime())}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-display text-xl text-espresso tnum">
                      {formatNaira(order.totalKobo)}
                    </p>
                    {waitingForCustomer ? (
                      <Pill tone="good">
                        <CircleCheck className="size-3.5" aria-hidden />
                        You confirmed
                      </Pill>
                    ) : (
                      <Pill tone="warn">
                        <Clock className="size-3.5" aria-hidden />
                        Awaiting pickup
                      </Pill>
                    )}
                  </div>
                </div>

                {lines.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-crust/60 pt-3">
                    {lines.map((line) => (
                      <li
                        key={line.id}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="text-cocoa">
                          <span className="tnum">{line.qty}</span> x {line.productName}
                          <span className="text-ash"> ({line.unitLabel})</span>
                        </span>
                        <span className="text-espresso tnum shrink-0">
                          {formatNaira(line.lineTotalKobo)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <Button href={`/retailer/redeem?token=${order.voucherCode}`}>
                    {waitingForCustomer ? "Open" : "Confirm this order"}
                  </Button>
                  {waitingForCustomer && (
                    <p className="text-[13px] text-ash">
                      Waiting for the customer to confirm collection.
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-[13px] text-ash">
        Customers can also collect at any partner shop.{" "}
        <Link href="/retailer/redeem" className="text-terra-deep hover:underline">
          Scan a card
        </Link>{" "}
        that was not sent to you.
      </p>
    </div>
  );
}
