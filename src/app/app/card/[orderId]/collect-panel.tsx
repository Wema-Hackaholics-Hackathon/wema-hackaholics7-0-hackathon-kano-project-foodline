"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, Clock, HandCoins, Loader2 } from "lucide-react";
import { Button, Card, Notice } from "@/components/ui";
import { formatNaira } from "@/lib/money";
import { confirmCollection, type CollectState } from "./actions";

/**
 * Shown while a card is live. Handover needs both taps: the store's and the
 * customer's. Whoever taps first simply waits for the other.
 */
export function CollectPanel({
  orderId,
  amountKobo,
  storeName,
  retailerConfirmed,
  customerConfirmed,
}: {
  orderId: string;
  amountKobo: number;
  storeName: string | null;
  retailerConfirmed: boolean;
  customerConfirmed: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<CollectState, FormData>(confirmCollection, {
    state: customerConfirmed ? "awaiting_retailer" : "idle",
    error: null,
  });

  const confirmed = customerConfirmed || state.state !== "idle";
  const waitingOnStore = confirmed && !retailerConfirmed && state.state !== "settled";

  // While waiting on the store, refresh so the settled state appears on its own
  useEffect(() => {
    if (!waitingOnStore) return;
    const timer = setInterval(() => router.refresh(), 5000);
    return () => clearInterval(timer);
  }, [waitingOnStore, router]);

  useEffect(() => {
    if (state.state === "settled") router.refresh();
  }, [state.state, router]);

  if (state.state === "settled") {
    return (
      <Notice tone="good" className="mt-4">
        <span className="flex items-start gap-2">
          <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Collection confirmed. {storeName ?? "The store"} has been paid{" "}
            <span className="tnum">{formatNaira(amountKobo)}</span>. Enjoy your foodstuff.
          </span>
        </span>
      </Notice>
    );
  }

  return (
    <Card className="mt-4">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-sm bg-terra-tint text-terra-deep">
          <HandCoins className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-lg text-espresso">Collecting now?</h2>
          {retailerConfirmed && !confirmed ? (
            <p className="mt-1 text-sm leading-relaxed text-cocoa">
              {storeName ?? "The store"} has checked your order and is ready to hand it over. Tap
              confirm once you have your foodstuff, and we pay them{" "}
              <span className="tnum">{formatNaira(amountKobo)}</span> immediately.
            </p>
          ) : (
            <p className="mt-1 text-sm leading-relaxed text-cocoa">
              Show this card at the store. When they confirm and you confirm, we pay them{" "}
              <span className="tnum">{formatNaira(amountKobo)}</span>. Both taps are needed, so
              nobody can use your card without you.
            </p>
          )}

          {state.error && (
            <Notice tone="bad" className="mt-3">
              {state.error}
            </Notice>
          )}

          {waitingOnStore ? (
            <div className="mt-3 flex items-center gap-2 text-[13px] text-warn">
              <Loader2 className="size-4 animate-spin" aria-hidden />
              You confirmed. Waiting for {storeName ?? "the store"} to confirm.
            </div>
          ) : (
            <form action={formAction} className="mt-4">
              <input type="hidden" name="orderId" value={orderId} />
              <Button type="submit" loading={pending} className="w-full sm:w-auto">
                <CircleCheck className="size-4" aria-hidden />
                Confirm collection
              </Button>
            </form>
          )}

          {retailerConfirmed && (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-good">
              <CircleCheck className="size-3.5 shrink-0" aria-hidden />
              Store confirmed
            </p>
          )}
          {!retailerConfirmed && (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ash">
              <Clock className="size-3.5 shrink-0" aria-hidden />
              Store has not confirmed yet
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
