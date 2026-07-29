"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  Loader2,
  ShieldCheck,
  ShoppingBasket,
} from "lucide-react";
import { Button, Card, EmptyState, Notice, Skeleton, cn } from "@/components/ui";
import { formatNaira } from "@/lib/money";
import { formatDateShort } from "@/lib/dates";
import { useCart } from "../cart-context";
import {
  confirmOrder,
  prepareCheckout,
  type CheckoutPrep,
  type PlanQuote,
} from "./actions";

function joinHuman(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** "2 x ₦34,980.25, on 26 Aug and 26 Sep" or per-amount when they differ */
function planLine(plan: PlanQuote): string {
  const amounts = plan.schedule.map((i) => i.amountKobo);
  const allEqual = amounts.every((a) => a === amounts[0]);
  if (allEqual) {
    return `${plan.installments} x ${formatNaira(amounts[0])}, on ${joinHuman(
      plan.schedule.map((i) => formatDateShort(i.dueDate))
    )}`;
  }
  return joinHuman(
    plan.schedule.map((i) => `${formatNaira(i.amountKobo)} on ${formatDateShort(i.dueDate)}`)
  );
}

export function CheckoutClient() {
  const { lines, hydrated, clear } = useCart();
  const router = useRouter();
  const [prep, setPrep] = useState<Extract<CheckoutPrep, { ok: true }> | null>(null);
  const [prepError, setPrepError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(true);
  const [selected, setSelected] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);

  const runPrepare = useCallback(async () => {
    setPreparing(true);
    setPrepError(null);
    try {
      const result = await prepareCheckout(lines);
      if (result.ok) {
        setPrep(result);
        setSelected((prev) => {
          const usable = result.plans.filter((p) => p.withinMandateCap);
          if (prev !== null && usable.some((p) => p.installments === prev)) return prev;
          return usable[0]?.installments ?? null;
        });
      } else {
        setPrepError(result.error);
      }
    } catch {
      setPrepError("We could not prepare your order just now. Try again.");
    } finally {
      setPreparing(false);
    }
    // lines identity changes only when the basket changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(lines)]);

  useEffect(() => {
    if (!hydrated || lines.length === 0 || redirecting) return;
    void runPrepare();
  }, [hydrated, lines.length, runPrepare, redirecting]);

  const confirm = async () => {
    if (!prep || selected === null) return;
    setSubmitting(true);
    setConfirmError(null);
    try {
      const result = await confirmOrder(
        prep.lines.map((l) => ({ productUnitId: l.productUnitId, qty: l.qty })),
        selected
      );
      if (result.ok) {
        setRedirecting(true);
        clear();
        router.replace(`/app/card/${result.orderId}`);
        return;
      }
      setConfirmError(result.error);
      await runPrepare();
    } catch {
      setConfirmError("Something interrupted the order. Nothing was placed. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (redirecting) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-rise">
        <Loader2 className="size-7 animate-spin text-terra" aria-hidden />
        <p className="mt-4 font-display text-lg text-espresso">Preparing your Foodline Card</p>
        <p className="mt-1 text-sm text-ash">One moment, your card is being issued.</p>
      </div>
    );
  }

  if (!hydrated || (preparing && !prep && !prepError)) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-13 w-full rounded-full" />
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

  if (prepError) {
    return (
      <Notice tone="bad" title="We could not prepare your order">
        {prepError}
        <div className="mt-3 flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => void runPrepare()}>
            Try again
          </Button>
          <Button size="sm" variant="ghost" href="/app/cart">
            Back to basket
          </Button>
        </div>
      </Notice>
    );
  }

  if (!prep) return null;

  const over = prep.subtotalKobo > prep.availableKobo;
  const selectedPlan = prep.plans.find((p) => p.installments === selected) ?? null;
  const noUsablePlan = prep.plans.every((p) => !p.withinMandateCap);
  const canConfirm = !over && !noUsablePlan && selectedPlan !== null && !submitting;

  return (
    <div className="space-y-4">
      {(prep.removed.length > 0 || prep.adjusted) && (
        <Notice tone="warn" title="Your basket changed slightly">
          {prep.removed.length > 0
            ? `${joinHuman(prep.removed)} ${prep.removed.length === 1 ? "is" : "are"} no longer available and ${prep.removed.length === 1 ? "was" : "were"} left out. `
            : ""}
          {prep.adjusted ? "Some quantities were reduced to match live stock. " : ""}
          The summary below is what you would actually get.
          <div className="mt-2">
            <Link href="/app/cart" className="font-medium underline">
              Review basket
            </Link>
          </div>
        </Notice>
      )}

      {confirmError && (
        <Notice tone="bad" title="The order did not go through">
          {confirmError}
        </Notice>
      )}

      <Card className="p-0">
        <details className="group">
          <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 select-none">
            <span className="text-sm font-medium text-cocoa">
              Order summary · {prep.lines.reduce((s, l) => s + l.qty, 0)} item
              {prep.lines.reduce((s, l) => s + l.qty, 0) === 1 ? "" : "s"}
            </span>
            <span className="flex items-center gap-2">
              <span className="text-[15px] font-semibold text-espresso tnum">
                {formatNaira(prep.subtotalKobo)}
              </span>
              <ChevronDown
                className="size-4.5 text-ash transition-transform group-open:rotate-180"
                aria-hidden
              />
            </span>
          </summary>
          <ul className="border-t border-crust/60 px-5 py-3">
            {prep.lines.map((l) => (
              <li
                key={l.productUnitId}
                className="flex items-baseline justify-between gap-3 py-1.5 text-sm"
              >
                <span className="min-w-0 truncate text-cocoa">
                  {l.productName}{" "}
                  <span className="text-ash">
                    · {l.unitLabel} <span className="tnum">x {l.qty}</span>
                  </span>
                </span>
                <span className="shrink-0 font-medium text-espresso tnum">
                  {formatNaira(l.lineTotalKobo)}
                </span>
              </li>
            ))}
          </ul>
        </details>
      </Card>

      {over ? (
        <Notice tone="bad" title="This basket is above your available credit">
          It comes to {formatNaira(prep.subtotalKobo)}, which is{" "}
          {formatNaira(prep.subtotalKobo - prep.availableKobo)} above your available credit of{" "}
          {formatNaira(prep.availableKobo)}. Trim it a little and you are good to go.
          <div className="mt-3">
            <Button size="sm" variant="secondary" href="/app/cart">
              Back to basket
            </Button>
          </div>
        </Notice>
      ) : (
        <>
          <fieldset>
            <legend className="mb-2.5 text-sm font-medium text-cocoa">
              How would you like to repay?
            </legend>
            <div className="space-y-2.5" role="radiogroup" aria-label="Repayment plans">
              {prep.plans.map((plan) => {
                const active = plan.installments === selected;
                const blocked = !plan.withinMandateCap;
                return (
                  <button
                    key={plan.installments}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    disabled={blocked}
                    onClick={() => {
                      setSelected(plan.installments);
                      setConfirmError(null);
                    }}
                    className={cn(
                      "flex min-h-14 w-full items-start justify-between gap-3 rounded-md border px-4 py-3.5 text-left transition-colors",
                      active
                        ? "border-terra bg-terra-tint"
                        : "border-crust bg-white hover:border-cocoa/40",
                      blocked && "cursor-not-allowed opacity-60 hover:border-crust"
                    )}
                  >
                    <span className="min-w-0">
                      <span
                        className={cn(
                          "block text-[15px] font-medium",
                          active ? "text-terra-deep" : "text-espresso"
                        )}
                      >
                        {plan.installments === 1
                          ? "Pay once on payday"
                          : `${plan.installments} monthly installments`}
                      </span>
                      <span className="mt-0.5 block text-[13px] leading-snug text-cocoa tnum">
                        {planLine(plan)}
                      </span>
                      <span className="mt-0.5 block text-[12px] text-ash tnum">
                        {plan.marginBps / 100}% margin, total {formatNaira(plan.totalRepayableKobo)}
                      </span>
                      {blocked && (
                        <span className="mt-0.5 block text-[12px] font-medium text-warn">
                          Above your mandate cap, choose fewer installments
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2",
                        active ? "border-terra bg-terra text-white" : "border-crust bg-white"
                      )}
                      aria-hidden
                    >
                      {active && <Check className="size-3" strokeWidth={3} />}
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          {noUsablePlan && (
            <Notice tone="warn" title="No plan fits your mandate cap right now">
              A smaller basket will fit. Head back and trim it a little.
              <div className="mt-3">
                <Button size="sm" variant="secondary" href="/app/cart">
                  Back to basket
                </Button>
              </div>
            </Notice>
          )}

          {selectedPlan && (
            <Card className="p-5">
              <p className="font-display text-lg text-espresso tnum">
                You will repay exactly {formatNaira(selectedPlan.totalRepayableKobo)}.
              </p>
              <p className="mt-1.5 text-sm leading-relaxed text-cocoa tnum">
                That is {formatNaira(prep.subtotalKobo)} for the food plus a{" "}
                {formatNaira(selectedPlan.marginKobo)} margin ({selectedPlan.marginBps / 100}%).
                First debit: {formatNaira(selectedPlan.schedule[0].amountKobo)} on{" "}
                {formatDateShort(selectedPlan.schedule[0].dueDate)}. No other charges, ever.
              </p>
              <p className="mt-3 flex items-start gap-2 text-[13px] leading-relaxed text-ash">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
                We debit only your agreed repayment, only on payday, from your salary account.
                Nothing more, nothing else.
              </p>
            </Card>
          )}

          <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+72px)] md:static">
            <Button
              size="lg"
              onClick={() => void confirm()}
              disabled={!canConfirm}
              loading={submitting}
              className="w-full shadow-2 md:shadow-1"
            >
              Confirm and get my card
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
