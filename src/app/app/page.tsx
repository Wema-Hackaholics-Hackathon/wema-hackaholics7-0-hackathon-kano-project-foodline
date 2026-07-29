import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import {
  ArrowDownToLine,
  Banknote,
  CalendarClock,
  ChevronRight,
  CircleCheck,
  CreditCard,
  HandCoins,
  QrCode,
  ReceiptText,
  ShieldCheck,
  ShoppingBasket,
  Sparkles,
  Store,
  Wallet,
} from "lucide-react";
import { getDb } from "@/db";
import { customers, installments, ledgerEvents, loans, orders } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { availableCreditKobo } from "@/lib/debit-engine";
import { formatNaira } from "@/lib/money";
import { diffDays, formatDateShort, todayLagos } from "@/lib/dates";
import { Button, Card, EmptyState, Pill, cn, type Tone } from "@/components/ui";
import { AvailableHero } from "./available-hero";
import { lagosGreeting, relativeTime } from "./format";

export const metadata: Metadata = { title: "Home" };

const QUICK_ACTIONS = [
  { href: "/app/shop", label: "Shop foodstuff", icon: ShoppingBasket },
  { href: "/app/cards", label: "My cards", icon: CreditCard },
  { href: "/app/repayments", label: "Repayments", icon: CalendarClock },
] as const;

const EVENT_ICON: Record<string, typeof ReceiptText> = {
  order_issued: CreditCard,
  order_redeemed: Store,
  order_expired: CreditCard,
  loan_created: HandCoins,
  loan_repaid: CircleCheck,
  debit_attempt: Banknote,
  debit_result: Banknote,
  debit_decision: Banknote,
  inflow_observed: ArrowDownToLine,
  salary_detected: Wallet,
  mandate_created: ShieldCheck,
  mandate_event: ShieldCheck,
};

export default async function HomePage() {
  const user = await requireRole("customer");
  const db = getDb();

  const customer = (
    await db.select().from(customers).where(eq(customers.id, user.id)).limit(1)
  )[0];
  const available = await availableCreditKobo(db, user.id);
  const limit = customer?.creditLimitKobo ?? 0;

  const nextInstallment = (
    await db
      .select({ dueDate: installments.dueDate, amountKobo: installments.amountKobo })
      .from(installments)
      .innerJoin(loans, eq(installments.loanId, loans.id))
      .where(
        and(
          eq(loans.customerId, user.id),
          inArray(loans.status, ["active", "overdue"]),
          inArray(installments.status, ["scheduled", "processing", "failed", "overdue"])
        )
      )
      .orderBy(installments.dueDate)
      .limit(1)
  )[0];

  const readyOrder = (
    await db
      .select({ id: orders.id, voucherCode: orders.voucherCode })
      .from(orders)
      .where(
        and(
          eq(orders.customerId, user.id),
          eq(orders.status, "issued"),
          gt(orders.expiresAt, new Date())
        )
      )
      .orderBy(desc(orders.issuedAt))
      .limit(1)
  )[0];

  const activity = await db
    .select({
      id: ledgerEvents.id,
      type: ledgerEvents.type,
      message: ledgerEvents.message,
      createdAt: ledgerEvents.createdAt,
    })
    .from(ledgerEvents)
    .where(eq(ledgerEvents.customerId, user.id))
    .orderBy(desc(ledgerEvents.createdAt))
    .limit(6);

  const firstName = user.name.split(" ")[0];
  const today = todayLagos();
  const daysToDue = nextInstallment ? diffDays(nextInstallment.dueDate, today) : null;
  const chipTone: Tone =
    daysToDue === null ? "neutral" : daysToDue < 0 ? "bad" : daysToDue <= 3 ? "warn" : "neutral";

  return (
    <div className="space-y-6 animate-rise">
      <div>
        <h1 className="font-display text-2xl text-espresso md:text-[28px]">
          {lagosGreeting()}, {firstName}
        </h1>
        <p className="mt-1 text-sm text-ash">Here is where your credit line stands today.</p>
      </div>

      <Card className="p-6">
        <AvailableHero availableKobo={available} limitKobo={limit} />
        {nextInstallment && (
          <div className="mt-5 flex justify-center">
            <Pill tone={chipTone} className="px-3.5 py-1.5 text-[13px] tnum">
              <CalendarClock className="size-3.5" aria-hidden />
              {daysToDue !== null && daysToDue < 0
                ? `Repayment overdue: ${formatNaira(nextInstallment.amountKobo)} was due ${formatDateShort(nextInstallment.dueDate)}`
                : `Next repayment: ${formatNaira(nextInstallment.amountKobo)} on ${formatDateShort(nextInstallment.dueDate)}`}
            </Pill>
          </div>
        )}
      </Card>

      {readyOrder && (
        <Link
          href={`/app/card/${readyOrder.id}`}
          className="flex items-center gap-4 rounded-lg border border-cream/10 bg-espresso p-4 text-cream shadow-1 transition-colors hover:bg-espresso-2"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-md bg-cream/10 text-mango">
            <QrCode className="size-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium">Card ready to use</span>
            <span className="block text-[13px] text-cream/70 tnum">
              {readyOrder.voucherCode}, show it at any partner store
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-cream/60" aria-hidden />
        </Link>
      )}

      <div className="grid grid-cols-3 gap-3">
        {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-lg border border-crust/60 bg-white p-3 text-center shadow-1 transition-colors hover:border-cocoa/30 hover:bg-cream"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-terra-tint text-terra-deep">
              <Icon className="size-5" aria-hidden />
            </span>
            <span className="text-[13px] font-medium leading-tight text-cocoa">{label}</span>
          </Link>
        ))}
      </div>

      <section aria-label="Recent activity">
        <h2 className="mb-3 font-display text-lg text-espresso">Recent activity</h2>
        {activity.length === 0 ? (
          <Card className="p-0">
            <EmptyState
              icon={<Sparkles className="size-6" aria-hidden />}
              title="No activity yet"
              body="Your first market run starts here. Shop foodstuff today and repay from your salary on payday."
              action={
                <Button href="/app/shop" size="sm">
                  Shop foodstuff
                </Button>
              }
            />
          </Card>
        ) : (
          <Card className="divide-y divide-crust/60 p-0">
            {activity.map((event) => {
              const Icon = EVENT_ICON[event.type] ?? ReceiptText;
              return (
                <div key={event.id} className="flex items-start gap-3.5 px-5 py-4">
                  <span
                    className={cn(
                      "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
                      event.type === "loan_repaid" || event.type === "inflow_observed"
                        ? "bg-good-tint text-good"
                        : "bg-terra-tint text-terra-deep"
                    )}
                  >
                    <Icon className="size-4.5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-snug text-espresso">{event.message}</p>
                    <p className="mt-0.5 text-[12px] text-ash">{relativeTime(event.createdAt)}</p>
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}
