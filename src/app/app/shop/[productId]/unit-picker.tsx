"use client";

import { useMemo, useState } from "react";
import { Check, Minus, Plus, ShoppingBasket } from "lucide-react";
import { Button, cn } from "@/components/ui";
import { formatNaira } from "@/lib/money";
import { MAX_QTY, useCart } from "../../cart-context";

type Unit = {
  id: string;
  unitLabel: string;
  priceKobo: number;
  stockQty: number;
};

/**
 * Market-unit radio cards + quantity stepper + live line total. Adds to the
 * client basket; prices and stock are re-validated server-side at checkout.
 */
export function UnitPicker({ productName, units }: { productName: string; units: Unit[] }) {
  const { addLine } = useCart();
  const firstInStock = units.find((u) => u.stockQty > 0);
  const [unitId, setUnitId] = useState<string | null>(firstInStock?.id ?? null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const selected = useMemo(() => units.find((u) => u.id === unitId) ?? null, [units, unitId]);
  const maxQty = selected ? Math.min(selected.stockQty, MAX_QTY) : 1;
  const clampedQty = Math.min(qty, Math.max(1, maxQty));
  const lineTotal = selected ? selected.priceKobo * clampedQty : 0;
  const allSoldOut = !firstInStock;

  const pickUnit = (u: Unit) => {
    if (u.stockQty === 0) return;
    setUnitId(u.id);
    setQty((prev) => Math.min(prev, Math.min(u.stockQty, MAX_QTY)));
    setAdded(false);
  };

  const add = () => {
    if (!selected) return;
    addLine(selected.id, clampedQty, maxQty);
    setAdded(true);
    window.setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="mt-6">
      <fieldset>
        <legend className="mb-2.5 text-sm font-medium text-cocoa">Choose a size</legend>
        <div className="space-y-2.5" role="radiogroup" aria-label={`${productName} sizes`}>
          {units.map((u) => {
            const soldOut = u.stockQty === 0;
            const active = u.id === unitId;
            return (
              <button
                key={u.id}
                type="button"
                role="radio"
                aria-checked={active}
                disabled={soldOut}
                onClick={() => pickUnit(u)}
                className={cn(
                  "flex min-h-14 w-full items-center justify-between gap-3 rounded-md border px-4 py-3 text-left transition-colors",
                  active
                    ? "border-terra bg-terra-tint"
                    : "border-crust bg-white hover:border-cocoa/40",
                  soldOut && "cursor-not-allowed opacity-60 hover:border-crust"
                )}
              >
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-[15px] font-medium",
                      active ? "text-terra-deep" : "text-espresso"
                    )}
                  >
                    {u.unitLabel}
                  </span>
                  {soldOut ? (
                    <span className="block text-[12px] text-ash">Sold out</span>
                  ) : u.stockQty <= 5 ? (
                    <span className="block text-[12px] font-medium text-warn">
                      Only {u.stockQty} left
                    </span>
                  ) : null}
                </span>
                <span className="flex items-center gap-3">
                  <span className="text-[15px] font-semibold text-espresso tnum">
                    {formatNaira(u.priceKobo)}
                  </span>
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border-2",
                      active ? "border-terra bg-terra text-white" : "border-crust bg-white"
                    )}
                    aria-hidden
                  >
                    {active && <Check className="size-3" strokeWidth={3} />}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {!allSoldOut && (
        <>
          <div className="mt-5 flex items-center justify-between gap-4">
            <div
              className="flex items-center rounded-full border border-crust bg-white"
              role="group"
              aria-label="Quantity"
            >
              <button
                type="button"
                onClick={() => setQty(Math.max(1, clampedQty - 1))}
                disabled={clampedQty <= 1}
                aria-label="Reduce quantity"
                className="flex size-11 items-center justify-center rounded-full text-cocoa transition-colors hover:bg-wheat disabled:text-ash/50"
              >
                <Minus className="size-4.5" aria-hidden />
              </button>
              <span className="w-10 text-center text-[15px] font-semibold text-espresso tnum" aria-live="polite">
                {clampedQty}
              </span>
              <button
                type="button"
                onClick={() => setQty(Math.min(maxQty, clampedQty + 1))}
                disabled={clampedQty >= maxQty}
                aria-label="Increase quantity"
                className="flex size-11 items-center justify-center rounded-full text-cocoa transition-colors hover:bg-wheat disabled:text-ash/50"
              >
                <Plus className="size-4.5" aria-hidden />
              </button>
            </div>
            <div className="text-right">
              <p className="text-[12px] text-ash">Line total</p>
              <p className="font-display text-xl text-espresso tnum" aria-live="polite">
                {formatNaira(lineTotal)}
              </p>
            </div>
          </div>

          <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+72px)] mt-6 md:static">
            <Button
              size="lg"
              onClick={add}
              disabled={!selected}
              className="w-full shadow-2 md:shadow-1"
            >
              {added ? (
                <>
                  <Check className="size-5" aria-hidden />
                  Added to basket
                </>
              ) : (
                <>
                  <ShoppingBasket className="size-5" aria-hidden />
                  Add to basket
                </>
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
