"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Minus, Plus, ShoppingBasket, Trash2 } from "lucide-react";
import { Button, Card, EmptyState, Notice, Skeleton, cn } from "@/components/ui";
import { formatNaira, formatNairaWhole } from "@/lib/money";
import { MAX_QTY, useCart } from "../cart-context";
import { ProductImage } from "../shop/product-image";
import { validateCart, type CartValidation, type ValidatedLine } from "./actions";

export function CartClient() {
  const { lines, hydrated, setQty, removeLine } = useCart();
  const [validation, setValidation] = useState<Extract<CartValidation, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [validating, setValidating] = useState(false);

  const idsKey = useMemo(
    () =>
      lines
        .map((l) => l.productUnitId)
        .sort()
        .join(","),
    [lines]
  );

  const runValidation = useCallback(async () => {
    setValidating(true);
    setError(null);
    try {
      const snapshot = idsKey ? idsKey.split(",").map((id) => ({ productUnitId: id, qty: 1 })) : [];
      const result = await validateCart(snapshot);
      if (result.ok) setValidation(result);
      else setError(result.error);
    } catch {
      setError("We could not check prices and stock just now. Try again.");
    } finally {
      setValidating(false);
    }
  }, [idsKey]);

  useEffect(() => {
    if (!hydrated) return;
    if (!idsKey) {
      setValidation(null);
      return;
    }
    void runValidation();
  }, [hydrated, idsKey, runValidation]);

  const lineData = useMemo(() => {
    const byId = new Map<string, ValidatedLine>(
      (validation?.lines ?? []).map((l) => [l.productUnitId, l])
    );
    return lines.map((l) => ({ cart: l, server: byId.get(l.productUnitId) ?? null }));
  }, [lines, validation]);

  const subtotal = useMemo(
    () =>
      lineData.reduce((sum, { cart, server }) => {
        if (!server || !server.available || server.stockQty === 0) return sum;
        return sum + server.priceKobo * Math.min(cart.qty, server.stockQty);
      }, 0),
    [lineData]
  );

  const hasDeadLines = lineData.some(
    ({ server }) => server && (!server.available || server.stockQty === 0)
  );

  if (!hydrated || (validating && !validation && !error && lines.length > 0)) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
        <Skeleton className="mt-4 h-28 w-full" />
      </div>
    );
  }

  if (lines.length === 0) {
    return (
      <Card className="p-0">
        <EmptyState
          icon={<ShoppingBasket className="size-6" aria-hidden />}
          title="Your basket is empty"
          body="Your first market run starts here. Everyday foodstuff, on your credit line, repaid from your salary."
          action={<Button href="/app/shop">Shop foodstuff</Button>}
        />
      </Card>
    );
  }

  if (error) {
    return (
      <Notice tone="bad" title="We could not check your basket">
        {error}
        <div className="mt-3">
          <Button size="sm" variant="secondary" onClick={() => void runValidation()}>
            Try again
          </Button>
        </div>
      </Notice>
    );
  }

  if (!validation) return null;

  const { limitKobo, outstandingKobo, availableKobo } = validation;
  const overBy = subtotal - availableKobo;
  const over = overBy > 0;
  const usedAfter = outstandingKobo + subtotal;
  const nearLimit = !over && limitKobo > 0 && usedAfter / limitKobo > 0.8;

  return (
    <div className="space-y-4">
      {hasDeadLines && (
        <Notice tone="warn" title="Some items changed">
          An item in your basket is sold out or no longer on sale. Remove it to continue.
        </Notice>
      )}

      <ul className="space-y-3">
        {lineData.map(({ cart, server }) => {
          if (!server) return null;
          const dead = !server.available || server.stockQty === 0;
          const maxQty = Math.min(server.stockQty, MAX_QTY);
          const qty = Math.min(cart.qty, Math.max(1, maxQty));
          const clamped = !dead && cart.qty > server.stockQty;
          return (
            <Card as="li" key={cart.productUnitId} className={cn("p-4", dead && "opacity-70")}>
              <div className="flex gap-3.5">
                <div className="size-16 shrink-0 overflow-hidden rounded-md bg-wheat">
                  <ProductImage
                    src={server.imageKey}
                    alt={server.productName}
                    className="size-full"
                    iconClassName="size-6"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-medium text-espresso">
                        {server.productName}
                      </h3>
                      <p className="text-[13px] text-ash">
                        {server.unitLabel}
                        {!dead && (
                          <span className="tnum"> · {formatNaira(server.priceKobo)} each</span>
                        )}
                      </p>
                      {dead ? (
                        <p className="mt-0.5 text-[12px] font-medium text-bad">
                          {server.available ? "Sold out" : "No longer available"}
                        </p>
                      ) : clamped ? (
                        <p className="mt-0.5 text-[12px] font-medium text-warn">
                          Only {server.stockQty} in stock, quantity adjusted
                        </p>
                      ) : server.stockQty <= 5 ? (
                        <p className="mt-0.5 text-[12px] font-medium text-warn">
                          Only {server.stockQty} left
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(cart.productUnitId)}
                      aria-label={`Remove ${server.productName} from basket`}
                      className="flex size-9 shrink-0 items-center justify-center rounded-full text-ash transition-colors hover:bg-bad-tint hover:text-bad"
                    >
                      <Trash2 className="size-4.5" aria-hidden />
                    </button>
                  </div>
                  {!dead && (
                    <div className="mt-2.5 flex items-center justify-between">
                      <div
                        className="flex items-center rounded-full border border-crust bg-white"
                        role="group"
                        aria-label={`Quantity of ${server.productName}`}
                      >
                        <button
                          type="button"
                          onClick={() => setQty(cart.productUnitId, qty - 1)}
                          disabled={qty <= 1}
                          aria-label="Reduce quantity"
                          className="flex size-9 items-center justify-center rounded-full text-cocoa transition-colors hover:bg-wheat disabled:text-ash/50"
                        >
                          <Minus className="size-4" aria-hidden />
                        </button>
                        <span className="w-8 text-center text-sm font-semibold text-espresso tnum">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQty(cart.productUnitId, Math.min(maxQty, qty + 1))}
                          disabled={qty >= maxQty}
                          aria-label="Increase quantity"
                          className="flex size-9 items-center justify-center rounded-full text-cocoa transition-colors hover:bg-wheat disabled:text-ash/50"
                        >
                          <Plus className="size-4" aria-hidden />
                        </button>
                      </div>
                      <p className="text-[15px] font-semibold text-espresso tnum">
                        {formatNaira(server.priceKobo * qty)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </ul>

      <Card className="p-5">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-cocoa">Subtotal</p>
          <p className="font-display text-2xl text-espresso tnum">{formatNaira(subtotal)}</p>
        </div>

        <div className="mt-4">
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-wheat"
            role="img"
            aria-label={
              over
                ? `Basket exceeds available credit by ${formatNaira(overBy)}`
                : `After this order ${formatNaira(availableKobo - subtotal)} of your ${formatNairaWhole(limitKobo)} limit remains`
            }
          >
            <div className="flex h-full">
              <div
                className="h-full bg-cocoa/35"
                style={{ width: `${pctOf(outstandingKobo, limitKobo)}%` }}
              />
              <div
                className={cn(
                  "h-full rounded-r-full transition-[width] duration-300",
                  over ? "bg-bad" : nearLimit ? "bg-warn" : "bg-terra"
                )}
                style={{ width: `${pctOf(Math.min(subtotal, Math.max(0, limitKobo - outstandingKobo)), limitKobo)}%` }}
              />
            </div>
          </div>
          <p
            className={cn(
              "mt-2 text-[13px] leading-relaxed tnum",
              over ? "text-bad" : nearLimit ? "text-warn" : "text-ash"
            )}
          >
            {over
              ? `This basket is ${formatNaira(overBy)} above your available credit of ${formatNaira(availableKobo)}. Trim it a little and you are good to go.`
              : `After this order: ${formatNaira(availableKobo - subtotal)} left of ${formatNairaWhole(limitKobo)}.`}
          </p>
        </div>

        <div className="mt-5">
          <Button
            href="/app/checkout"
            size="lg"
            disabled={over || hasDeadLines || subtotal === 0}
            className="w-full"
          >
            Continue to repayment plan
          </Button>
        </div>
      </Card>
    </div>
  );
}

function pctOf(part: number, whole: number): number {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
}
