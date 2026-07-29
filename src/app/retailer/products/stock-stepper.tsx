"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Minus, Plus } from "lucide-react";
import { cn } from "@/components/ui";
import { setUnitStock } from "./actions";

/**
 * Counter-side stock edit. Stock is the one thing a shopkeeper changes hourly,
 * so it saves on its own and does not send the listing back for review.
 */
export function StockStepper({
  unitId,
  label,
  stockQty,
}: {
  unitId: string;
  /** Full description for screen readers, e.g. "Parboiled rice, 1 mudu" */
  label: string;
  stockQty: number;
}) {
  const [qty, setQty] = useState(stockQty);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function commit(next: number) {
    const value = Math.max(0, Math.min(100_000, Math.round(next)));
    setQty(value);
    setSaved(false);
    setError(null);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      startTransition(async () => {
        const result = await setUnitStock(unitId, value);
        if (result.ok) setSaved(true);
        else setError(result.error ?? "Stock did not save. Try again.");
      });
    }, 600);
  }

  return (
    <div className="shrink-0">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => commit(qty - 1)}
          disabled={qty === 0}
          aria-label={`Reduce stock of ${label}`}
          className="flex size-11 items-center justify-center rounded-full text-cocoa transition-colors hover:bg-wheat disabled:text-ash/50 disabled:hover:bg-transparent"
        >
          <Minus className="size-4.5" aria-hidden />
        </button>
        <input
          value={qty}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "");
            commit(digits === "" ? 0 : Number(digits));
          }}
          inputMode="numeric"
          aria-label={`Stock of ${label}`}
          className="tnum h-11 w-14 rounded-sm border border-crust bg-white text-center text-[15px] text-espresso focus:border-terra focus:outline-none focus:ring-2 focus:ring-terra/20"
        />
        <button
          type="button"
          onClick={() => commit(qty + 1)}
          aria-label={`Add stock of ${label}`}
          className="flex size-11 items-center justify-center rounded-full text-cocoa transition-colors hover:bg-wheat"
        >
          <Plus className="size-4.5" aria-hidden />
        </button>
      </div>
      <p
        className={cn(
          "mt-0.5 flex items-center justify-center gap-1 text-[12px]",
          error ? "text-bad" : "text-ash"
        )}
        aria-live="polite"
      >
        {error ? (
          error
        ) : pending ? (
          <>
            <Loader2 className="size-3 animate-spin" aria-hidden /> Saving
          </>
        ) : saved ? (
          <>
            <Check className="size-3" aria-hidden /> Stock saved
          </>
        ) : (
          "In stock"
        )}
      </p>
    </div>
  );
}
