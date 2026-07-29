import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { ChevronLeft, Store } from "lucide-react";
import { getDb } from "@/db";
import { orderItems, orders, retailers } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { formatNairaWhole, formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { Logo } from "@/components/logo";
import { Button, Card, Money, Notice, Pill, cn } from "@/components/ui";
import {
  effectiveOrderStatus,
  ORDER_STATUS_LABEL,
  ORDER_STATUS_TONE,
  voucherGroups,
} from "../../format";
import { CardQr } from "./card-qr";
import { ExpiryCountdown } from "./countdown";

export const metadata: Metadata = { title: "Your Foodline Card" };

export default async function CardPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const user = await requireRole("customer");
  const { orderId } = await params;
  const db = getDb();

  const order = (await db.select().from(orders).where(eq(orders.id, orderId)).limit(1))[0];
  if (!order || order.customerId !== user.id) notFound();

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));

  let retailerName: string | null = null;
  if (order.redeemedByRetailerId) {
    retailerName =
      (
        await db
          .select({ name: retailers.businessName })
          .from(retailers)
          .where(eq(retailers.id, order.redeemedByRetailerId))
          .limit(1)
      )[0]?.name ?? null;
  }

  const status = effectiveOrderStatus(order);
  const live = status === "issued";
  const honoured = status === "redeemed" || status === "settled";

  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host") ?? "foodline.local"}`;
  const qrUrl = `${origin}/r/${order.qrToken}`;
  const groups = voucherGroups(order.voucherCode);

  return (
    <div className="mx-auto w-full max-w-md animate-rise">
      <Link
        href="/app/cards"
        className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-terra-deep hover:underline"
      >
        <ChevronLeft className="size-4.5" aria-hidden />
        All cards
      </Link>

      {/* The Foodline Card */}
      <div
        className={cn(
          "relative aspect-[1.586/1] w-full overflow-hidden rounded-xl shadow-card animate-pop",
          !live && "opacity-80 grayscale-[0.4]"
        )}
        style={{
          backgroundImage: "linear-gradient(135deg, #2B1B15 0%, #3D2417 55%, #7A2E0E 100%)",
        }}
        role="img"
        aria-label={`Foodline Card ${order.voucherCode}, ${ORDER_STATUS_LABEL[status].toLowerCase()}, worth ${formatNairaWhole(order.totalKobo)}`}
      >
        <div className="absolute inset-0 card-weave" aria-hidden />
        <div
          className="absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(circle at 84% 80%, rgba(245, 165, 36, 0.14), transparent 52%)",
          }}
        />

        <div className="relative flex h-full flex-col justify-between p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <Logo on="dark" size="sm" />
            <span className="pt-1 text-[9px] font-semibold uppercase tracking-[0.28em] text-cream/60 sm:text-[10px]">
              Foodstuff credit
            </span>
          </div>

          <div>
            {/* Golden chip */}
            <div
              aria-hidden
              className="relative h-7 w-9 overflow-hidden rounded-[6px] sm:h-8 sm:w-10"
              style={{ backgroundImage: "linear-gradient(160deg, #E8C36A 0%, #B98A2F 100%)" }}
            >
              <span className="absolute inset-x-1 top-[25%] h-px bg-espresso/25" />
              <span className="absolute inset-x-1 top-[50%] h-px bg-espresso/25" />
              <span className="absolute inset-x-1 top-[75%] h-px bg-espresso/25" />
            </div>
            <p className="mt-3 text-[22px] font-medium tracking-[0.14em] text-cream tnum sm:mt-4 sm:text-[26px]">
              {groups.join(" ")}
            </p>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-medium uppercase tracking-[0.12em] text-cream sm:text-[13px]">
                {user.name}
              </p>
              <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-cream/60 sm:text-[10px]">
                Valid thru {formatDateTime(order.expiresAt.getTime())}
              </p>
            </div>
            <div className="shrink-0 rounded-md bg-cream p-2">
              <CardQr value={qrUrl} size={84} />
            </div>
          </div>
        </div>

        {honoured && (
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <span className="-rotate-12 rounded-md border-4 border-cream/85 px-5 py-1.5 font-display text-2xl font-semibold uppercase tracking-[0.3em] text-cream/85">
              Redeemed
            </span>
          </div>
        )}
      </div>

      {/* Status + total */}
      <Card className="mt-5 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[13px] text-ash">Order total</p>
            <p className="mt-0.5 font-display text-3xl text-espresso tnum">
              <Money kobo={order.totalKobo} />
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Pill tone={ORDER_STATUS_TONE[status]}>{ORDER_STATUS_LABEL[status]}</Pill>
            {live && <ExpiryCountdown expiresAtMs={order.expiresAt.getTime()} />}
          </div>
        </div>
        <p className="mt-3 text-[13px] text-ash">
          Issued {formatDateTime(order.issuedAt.getTime())}
        </p>
      </Card>

      {honoured && (
        <Notice tone="good" className="mt-4">
          <span className="flex items-start gap-2">
            <Store className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span className="tnum">
              Honoured at {retailerName ?? "a Foodline partner store"}
              {order.redeemedAt ? ` on ${formatDateTime(order.redeemedAt.getTime())}` : ""}. The
              retailer has been settled in full.
            </span>
          </span>
        </Notice>
      )}

      {status === "expired" && (
        <Notice tone="note" className="mt-4" title="This card expired unused">
          Your credit was not touched, and there is nothing to repay for it. Shop again whenever
          you are ready.
          <div className="mt-3">
            <Button size="sm" href="/app/shop">
              Shop again
            </Button>
          </div>
        </Notice>
      )}

      {status === "cancelled" && (
        <Notice tone="note" className="mt-4" title="This card was cancelled">
          Your credit was not touched. If this is a surprise, talk to us and we will explain
          exactly what happened.
          <div className="mt-3">
            <Button size="sm" variant="secondary" href="/app/support">
              Talk to us
            </Button>
          </div>
        </Notice>
      )}

      {/* Items */}
      <Card className="mt-4 p-0">
        <h2 className="border-b border-crust/60 px-5 py-3.5 text-sm font-medium text-cocoa">
          What this card buys
        </h2>
        <ul className="px-5 py-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-baseline justify-between gap-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate text-cocoa">
                {item.productName}{" "}
                <span className="text-ash">
                  · {item.unitLabel} <span className="tnum">x {item.qty}</span>
                </span>
              </span>
              <span className="shrink-0 font-medium text-espresso tnum">
                {formatNaira(item.lineTotalKobo)}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {live && (
        <Card className="mt-4 p-5">
          <h2 className="text-sm font-medium text-cocoa">How to use</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-cocoa">
            Show this card at any Foodline partner store. The retailer scans the code and hands
            over your order. Done.
          </p>
        </Card>
      )}
    </div>
  );
}
