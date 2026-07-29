"use client";

import { useEffect, useState } from "react";
import { PlateRing } from "@/components/ui";
import { formatNairaWhole } from "@/lib/money";

/**
 * The reveal: the Plate Ring fills while the limit counts up from zero over
 * about 900ms. With prefers-reduced-motion both jump straight to the final
 * value.
 */
export function LimitReveal({ limitKobo, firstName }: { limitKobo: number; firstName: string }) {
  const [displayKobo, setDisplayKobo] = useState(0);
  const [fraction, setFraction] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplayKobo(limitKobo);
      setFraction(1);
      return;
    }
    setFraction(1);
    const duration = 900;
    let start: number | null = null;
    let raf = 0;
    const tick = (t: number) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplayKobo(Math.round(limitKobo * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [limitKobo]);

  return (
    <div className="flex flex-col items-center text-center mt-10 animate-rise">
      <PlateRing fraction={fraction} size={224} stroke={12}>
        <p className="text-xs text-ash">Your Foodline limit</p>
        <p className="font-display text-[32px] leading-tight text-espresso tnum mt-1">
          {formatNairaWhole(displayKobo)}
        </p>
      </PlateRing>
      <h1 className="font-display text-[28px] leading-tight text-espresso mt-8">
        You are approved, {firstName}.
      </h1>
      <p className="text-sm text-ash mt-2 max-w-sm leading-relaxed">
        Your Foodline limit is {formatNairaWhole(limitKobo)}. Stock up on foodstuff today, repay
        from your salary on payday.
      </p>
    </div>
  );
}
