import { Button } from "@/components/ui";
import { FoodlineCard } from "./foodline-card";

/** Espresso hero: the pitch in one breath, and the Foodline Card front and centre. */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden bg-espresso text-cream"
    >
      {/* Ambient warmth: one ember glow low-left, one faint mango wash high-right */}
      <div
        className="absolute -left-32 bottom-0 h-96 w-96 rounded-full bg-terra/20 blur-3xl"
        aria-hidden
      />
      <div
        className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-mango/10 blur-3xl"
        aria-hidden
      />

      <div className="relative mx-auto max-w-6xl px-5 sm:px-6">
        <div className="grid items-center gap-12 py-14 sm:py-20 lg:grid-cols-2 lg:gap-16 lg:py-24">
          <div className="animate-rise">
            <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-mango">
              Food credit for verified salary earners
            </p>
            <h1
              id="hero-heading"
              className="mt-4 font-display text-[42px] leading-[1.04] sm:text-6xl lg:text-[64px]"
            >
              Your foodstuff, <span className="text-mango">sorted.</span>
            </h1>
            <p className="mt-5 max-w-lg text-base leading-relaxed text-cream/75 sm:text-lg">
              Foodline turns your verified salary into a food credit line: stock up today, repay
              in easy installments when salary lands.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button href="/join" size="lg" className="w-full sm:w-auto">
                Get your credit line
              </Button>
              <a
                href="#how-it-works"
                className="inline-flex h-13 w-full items-center justify-center rounded-full border border-cream/25 px-8 text-base font-medium text-cream transition-colors hover:bg-cream/10 sm:w-auto"
              >
                See how it works
              </a>
            </div>
          </div>

          <div className="animate-rise lg:justify-self-end lg:w-full">
            <div className="mx-auto w-full max-w-md px-2 py-6 sm:px-4 lg:max-w-lg">
              <FoodlineCard />
              <p className="mt-8 text-center text-[13px] text-cream/60">
                Secured by Mono, settled by Paystack.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
