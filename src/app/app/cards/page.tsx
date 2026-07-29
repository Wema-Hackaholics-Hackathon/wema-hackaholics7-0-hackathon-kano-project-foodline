import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { ChevronRight, CreditCard } from "lucide-react";
import { getDb } from "@/db";
import { orders } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { formatNairaWhole } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { Button, Card, EmptyState, PageTitle, Pill } from "@/components/ui";
import {
  effectiveOrderStatus,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
} from "../format";

export const metadata: Metadata = { title: "My cards" };

export default async function CardsPage() {
  const user = await requireRole("customer");
  const db = getDb();

  const rows = await db
    .select({
      id: orders.id,
      voucherCode: orders.voucherCode,
      status: orders.status,
      totalKobo: orders.totalKobo,
      issuedAt: orders.issuedAt,
      expiresAt: orders.expiresAt,
    })
    .from(orders)
    .where(eq(orders.customerId, user.id))
    .orderBy(desc(orders.issuedAt));

  return (
    <div className="mx-auto w-full max-w-xl animate-rise">
      <PageTitle
        title="My cards"
        sub="Every Foodline Card you have been issued, newest first."
      />

      {rows.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={<CreditCard className="size-6" aria-hidden />}
            title="No cards yet"
            body="When you place an order, your Foodline Card appears here, ready to show at any partner store."
            action={<Button href="/app/shop">Shop foodstuff</Button>}
          />
        </Card>
      ) : (
        <ul className="space-y-3">
          {rows.map((order) => {
            const status = effectiveOrderStatus(order);
            return (
              <li key={order.id}>
                <Link href={`/app/card/${order.id}`} className="group block">
                  <Card className="flex items-center gap-4 p-4 transition-shadow group-hover:shadow-2">
                    {/* Mini card thumbnail */}
                    <span
                      aria-hidden
                      className="relative flex h-10 w-16 shrink-0 items-center justify-center overflow-hidden rounded-[7px]"
                      style={{
                        backgroundImage:
                          "linear-gradient(135deg, #2B1B15 0%, #3D2417 55%, #7A2E0E 100%)",
                      }}
                    >
                      <span className="font-display text-[13px] font-semibold text-cream">
                        fl
                      </span>
                      <span className="absolute right-1.5 top-1.5 size-1 rounded-full bg-mango" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[15px] font-medium text-espresso tnum">
                          {order.voucherCode}
                        </span>
                        <Pill tone={ORDER_STATUS_TONE[status]}>
                          {ORDER_STATUS_LABEL[status]}
                        </Pill>
                      </span>
                      <span className="mt-0.5 block text-[13px] text-ash">
                        {formatDateTime(order.issuedAt.getTime())}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-2">
                      <span className="text-[15px] font-semibold text-espresso tnum">
                        {formatNairaWhole(order.totalKobo)}
                      </span>
                      <ChevronRight
                        className="size-4.5 text-ash transition-transform group-hover:translate-x-0.5"
                        aria-hidden
                      />
                    </span>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
