import {
  BadgeCheck,
  CalendarCheck,
  FileCheck2,
  Gauge,
  Landmark,
  Lock,
  ShieldCheck,
  ShoppingBasket,
  Undo2,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui";

// ---------------------------------------------------------------------------
// How it works
// ---------------------------------------------------------------------------

const STEPS = [
  {
    icon: Landmark,
    title: "Link your salary account",
    body: "Connect through Mono in read-only mode. We confirm your salary from your statement, and we never see your password or PIN.",
  },
  {
    icon: Gauge,
    title: "See your limit in minutes",
    body: "Clear rules decide, not a committee. Your limit is up to 30% of your verified monthly salary.",
  },
  {
    icon: ShoppingBasket,
    title: "Shop and show your card",
    body: "Fill your basket, then show your Foodline Card at a partner store. The retailer scans it and hands over your goods.",
  },
  {
    icon: CalendarCheck,
    title: "Repay on payday",
    body: "We auto-debit the exact agreed amount when your salary lands. You can cancel the mandate at any time.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-heading"
      className="scroll-mt-24 bg-oat"
    >
      <div className="mx-auto max-w-6xl px-5 pt-16 sm:px-6 sm:pt-24">
        <div className="max-w-2xl">
          <h2 id="how-heading" className="font-display text-3xl text-espresso sm:text-4xl">
            How Foodline works
          </h2>
          <p className="mt-3 text-base text-ash sm:text-lg">
            Four steps, one sitting, no paperwork. Your verified salary does the talking.
          </p>
        </div>
        <ol className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <li
              key={step.title}
              className="rounded-lg border border-crust/60 bg-white p-5 shadow-1 sm:p-6"
            >
              <div className="flex items-center justify-between">
                <span className="flex size-11 items-center justify-center rounded-sm bg-terra-tint text-terra-deep">
                  <step.icon className="size-5" aria-hidden />
                </span>
                <span className="tnum text-sm font-medium text-ash" aria-hidden>
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-4 text-base font-semibold text-espresso">{step.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ash">{step.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Numbers strip
// ---------------------------------------------------------------------------

const FIGURES = [
  {
    value: "3 min",
    label: "to a credit decision",
    sub: "Salary check, limit and mandate, all in one sitting.",
  },
  {
    value: "0",
    label: "hidden charges",
    sub: "One flat service margin, shown in naira before you confirm.",
  },
  {
    value: "Instant",
    label: "retailer settlement",
    sub: "Paystack pays the store the moment your card is redeemed.",
  },
];

export function NumbersStrip() {
  return (
    <section aria-label="Foodline in numbers" className="bg-oat">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <div className="grid divide-y divide-crust/60 rounded-lg border border-crust/60 bg-white shadow-1 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {FIGURES.map((f) => (
            <div key={f.label} className="px-6 py-7 text-center sm:px-8 sm:py-9">
              <p className="tnum font-display text-4xl text-espresso sm:text-[40px]">{f.value}</p>
              <p className="mt-1.5 text-sm font-medium text-cocoa">{f.label}</p>
              <p className="mt-1.5 text-[13px] leading-relaxed text-ash">{f.sub}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Trust section (espresso, per the dark trust rule)
// ---------------------------------------------------------------------------

const TRUST_ITEMS = [
  {
    icon: ShieldCheck,
    title: "Only the agreed amount",
    body: "We debit your agreed repayment on payday, nothing more, nothing else. Every amount and date is shown to you before you confirm a purchase.",
  },
  {
    icon: FileCheck2,
    title: "Authorised through NIBSS",
    body: "Repayments run on a NIBSS e-mandate that you authorise once with your own bank. It is capped, dated and visible to you from day one.",
  },
  {
    icon: Undo2,
    title: "A clear way to cancel",
    body: "You can view or cancel your mandate from Settings at any time. No calls to make, no letters to write.",
  },
  {
    icon: Lock,
    title: "Read-only, encrypted access",
    body: "Bank linking through Mono is encrypted and read-only. We can confirm your salary, we cannot move your money.",
  },
];

export function TrustSection() {
  return (
    <section aria-labelledby="trust-heading" className="bg-espresso text-cream">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-mango">
            Built for trust
          </p>
          <h2 id="trust-heading" className="mt-4 font-display text-3xl sm:text-4xl">
            We treat your salary account with respect
          </h2>
          <p className="mt-3 text-base leading-relaxed text-cream/70 sm:text-lg">
            A direct debit on a salary account is serious business. Here is exactly how Foodline
            behaves with yours.
          </p>
        </div>
        <ul className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2">
          {TRUST_ITEMS.map((item) => (
            <li
              key={item.title}
              className="rounded-lg border border-cream/10 bg-espresso-2 p-6 sm:p-7"
            >
              <span className="flex size-11 items-center justify-center rounded-sm bg-cream/10 text-mango">
                <item.icon className="size-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-base font-semibold text-cream">{item.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-cream/70">{item.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Partner strip (awning top border)
// ---------------------------------------------------------------------------

export function PartnerStrip() {
  return (
    <section aria-labelledby="partner-heading" className="bg-white">
      <div className="awning h-1" aria-hidden />
      <div className="mx-auto max-w-6xl gap-10 px-5 py-14 sm:px-6 sm:py-20 lg:flex lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-terra-deep">
            For foodstuff retailers
          </p>
          <h2 id="partner-heading" className="mt-4 font-display text-3xl text-espresso sm:text-[34px]">
            Guaranteed payment before goods leave the shelf
          </h2>
          <p className="mt-3 text-base leading-relaxed text-ash">
            Every Foodline Card is backed by an approved credit line. Scan it, release the goods,
            and Paystack settles your account instantly. No credit risk, no chasing debtors.
          </p>
          <ul className="mt-6 space-y-3">
            <li className="flex items-start gap-3">
              <BadgeCheck className="mt-0.5 size-5 shrink-0 text-terra-deep" aria-hidden />
              <span className="text-sm text-cocoa sm:text-[15px]">
                Payment is confirmed before you release a single item
              </span>
            </li>
            <li className="flex items-start gap-3">
              <Zap className="mt-0.5 size-5 shrink-0 text-terra-deep" aria-hidden />
              <span className="text-sm text-cocoa sm:text-[15px]">
                Instant settlement to your bank account via Paystack
              </span>
            </li>
          </ul>
        </div>
        <div className="mt-8 shrink-0 lg:mt-0">
          <Button href="/login" variant="secondary" size="lg" className="w-full sm:w-auto">
            Partner sign-in
          </Button>
        </div>
      </div>
    </section>
  );
}
