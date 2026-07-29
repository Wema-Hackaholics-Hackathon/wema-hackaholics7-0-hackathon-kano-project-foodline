import type { Metadata } from "next";
import Link from "next/link";
import {
  Banknote,
  ChevronRight,
  ScanLine,
  ShieldCheck,
  Store,
  Tags,
  Users,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui";

// Fully static: no session, no database, prerendered at build.

export const metadata: Metadata = {
  title: "Partner with Foodline",
  description:
    "Join Foodline as a partner shop: customers arrive with an approved credit line, you confirm the order, and Paystack settles your account the same day.",
};

const BENEFITS = [
  {
    icon: Banknote,
    title: "Paid the same day",
    body: "The moment you and the customer both confirm the handover, Paystack sends your money to your bank account. No 30 day terms, no invoices, no chasing.",
  },
  {
    icon: ShieldCheck,
    title: "No credit risk on your side",
    body: "Foodline lends, not you. We verify the salary, we hold the mandate, we collect on payday. Whatever happens after the customer leaves your shop, you have been paid.",
  },
  {
    icon: Users,
    title: "Customers sent to your counter",
    body: "Salary earners near your shop browse your shelf in the app and send their order ahead. You pack it before they arrive, so the queue keeps moving.",
  },
  {
    icon: Tags,
    title: "You set the price you need",
    body: "List every item at the amount you need to receive per mudu, congo, paint bucket or bag. Foodline adds its own service margin on top, so your take-home never shrinks.",
  },
];

const STEPS = [
  {
    title: "Apply with your shop details",
    body: "Business name, shop address and the bank account we should settle into. It takes about five minutes.",
  },
  {
    title: "We review your application",
    body: "Our partner team checks the details, usually within one working day, and calls you if anything is unclear.",
  },
  {
    title: "List what you sell",
    body: "Add your foodstuff unit by unit at the price you need. You can start listing while your application is still under review.",
  },
  {
    title: "Customers shop and send their card",
    body: "A customer near you fills a basket from your shelf and sends their Foodline Card to your shop.",
  },
  {
    title: "Confirm the handover, get settled",
    body: "Scan the card or type the short code, hand over the goods, and Paystack pays your account.",
  },
];

export default function PartnerLandingPage() {
  return (
    <>
      <div className="awning h-1 shrink-0" aria-hidden />

      <header className="border-b border-cream/10 bg-espresso">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-2 px-5 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Logo on="dark" size="sm" href="/" />
            <span className="hidden h-5 w-px bg-cream/20 sm:block" aria-hidden />
            <span className="hidden text-sm text-cream/70 sm:block">For partner shops</span>
          </div>
          <nav aria-label="Partner" className="flex items-center gap-1 sm:gap-2">
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-full px-3 text-sm font-medium text-cream/90 transition-colors hover:bg-cream/10 hover:text-cream sm:px-5 sm:text-[15px]"
            >
              Partner sign in
            </Link>
            <Link
              href="/partner/apply"
              className="inline-flex h-11 items-center rounded-full bg-terra px-4 text-sm font-medium text-white shadow-1 transition-colors hover:bg-terra-deep sm:px-6 sm:text-[15px]"
            >
              Apply to join
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section aria-labelledby="partner-hero" className="relative overflow-hidden bg-espresso text-cream">
          <div
            className="absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-terra/20 blur-3xl"
            aria-hidden
          />
          <div
            className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-mango/10 blur-3xl"
            aria-hidden
          />
          <div className="relative mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20 lg:py-24">
            <div className="max-w-3xl animate-rise">
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-mango">
                For foodstuff retailers
              </p>
              <h1
                id="partner-hero"
                className="mt-4 font-display text-[40px] leading-[1.05] sm:text-6xl lg:text-[64px]"
              >
                Sell more foodstuff, <span className="text-mango">get paid the same day.</span>
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-cream/75 sm:text-lg">
                Foodline customers are salary earners with an approved food credit line. They arrive
                at your shop with a Foodline Card, you confirm the order, and Paystack settles your
                bank account. You carry no credit risk, because Foodline lends, not you.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button href="/partner/apply" size="lg" className="w-full sm:w-auto">
                  Apply to join
                </Button>
                <Link
                  href="/login"
                  className="inline-flex h-13 w-full items-center justify-center rounded-full border border-cream/25 px-8 text-base font-medium text-cream transition-colors hover:bg-cream/10 sm:w-auto"
                >
                  Partner sign in
                </Link>
              </div>
              <p className="mt-6 text-[13px] text-cream/60">
                Free to join. No monthly fee, no card machine to rent.
              </p>
            </div>
          </div>
        </section>

        {/* Benefits */}
        <section aria-labelledby="benefits-heading" className="bg-oat">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
            <div className="max-w-2xl">
              <h2 id="benefits-heading" className="font-display text-3xl text-espresso sm:text-4xl">
                The deal, plainly
              </h2>
              <p className="mt-3 text-base text-ash sm:text-lg">
                Foodline is not a loan to your shop and not stock on credit. It is a customer who
                has already been approved to spend, walking through your door.
              </p>
            </div>
            <ul className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2">
              {BENEFITS.map((benefit) => (
                <li
                  key={benefit.title}
                  className="rounded-lg border border-crust/60 bg-white p-6 shadow-1 sm:p-7"
                >
                  <span className="flex size-11 items-center justify-center rounded-sm bg-terra-tint text-terra-deep">
                    <benefit.icon className="size-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-espresso">{benefit.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ash">{benefit.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* How it works */}
        <section aria-labelledby="partner-how" className="bg-white">
          <div className="awning h-1" aria-hidden />
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
            <div className="max-w-2xl">
              <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-terra-deep">
                How it works
              </p>
              <h2 id="partner-how" className="mt-4 font-display text-3xl text-espresso sm:text-4xl">
                From application to settlement
              </h2>
            </div>
            <ol className="mt-10 space-y-4">
              {STEPS.map((step, i) => (
                <li key={step.title} className="flex gap-4 sm:gap-5">
                  <span
                    className="tnum flex size-10 shrink-0 items-center justify-center rounded-full bg-espresso font-display text-base text-cream"
                    aria-hidden
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 border-b border-crust/60 pb-4 last:border-0">
                    <h3 className="text-base font-semibold text-espresso">{step.title}</h3>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ash">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Closing CTA */}
        <section aria-labelledby="partner-cta" className="bg-oat">
          <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20">
            <div className="rounded-lg border border-crust/60 bg-white p-7 shadow-1 sm:p-10 lg:flex lg:items-center lg:justify-between lg:gap-10">
              <div className="max-w-xl">
                <span className="flex size-11 items-center justify-center rounded-sm bg-terra-tint text-terra-deep">
                  <Store className="size-5" aria-hidden />
                </span>
                <h2
                  id="partner-cta"
                  className="mt-4 font-display text-2xl text-espresso sm:text-[30px]"
                >
                  Bring your shop onto Foodline
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-ash sm:text-base">
                  Apply today and start listing your foodstuff while we review. Approved shops go
                  live to every customer in their area.
                </p>
              </div>
              <div className="mt-6 flex shrink-0 flex-col gap-3 sm:flex-row lg:mt-0 lg:flex-col">
                <Button href="/partner/apply" size="lg" className="w-full sm:w-auto">
                  Apply to join
                  <ChevronRight className="size-4" aria-hidden />
                </Button>
                <Button href="/login" variant="secondary" size="lg" className="w-full sm:w-auto">
                  Partner sign in
                </Button>
              </div>
            </div>
            <p className="mt-6 flex items-center justify-center gap-2 text-center text-[13px] text-ash">
              <ScanLine className="size-4 shrink-0" aria-hidden />
              Already approved? Sign in and scan your first Foodline Card.
            </p>
          </div>
        </section>
      </main>

      <footer className="bg-espresso text-cream">
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-12">
          <div className="gap-8 sm:flex sm:items-start sm:justify-between">
            <div className="max-w-xs">
              <Logo on="dark" href="/" />
              <p className="mt-2 text-sm text-cream/60">foodline.com.ng</p>
            </div>
            <nav aria-label="Partner footer" className="mt-8 flex flex-col sm:mt-0 sm:items-end">
              <Link
                href="/partner/apply"
                className="inline-flex min-h-11 items-center text-sm text-cream/70 transition-colors hover:text-cream"
              >
                Apply to join
              </Link>
              <Link
                href="/login"
                className="inline-flex min-h-11 items-center text-sm text-cream/70 transition-colors hover:text-cream"
              >
                Partner sign in
              </Link>
              <Link
                href="/"
                className="inline-flex min-h-11 items-center text-sm text-cream/70 transition-colors hover:text-cream"
              >
                Foodline for customers
              </Link>
            </nav>
          </div>
          <div className="mt-8 flex flex-col gap-2 border-t border-cream/10 pt-6 text-[13px] text-cream/50 sm:flex-row sm:items-center sm:justify-between">
            <p>&copy; 2026 Foodline. Made in Lagos.</p>
            <p>Secured by Mono, settled by Paystack.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
