"use client";

import { useActionState, useState } from "react";
import { CircleCheck, Utensils } from "lucide-react";
import { Button, Card, Notice, Pill, Textarea, cn, inputCls } from "@/components/ui";
import { formatNaira } from "@/lib/money";
import { priceFor } from "@/lib/catalog";
import { approveListing, declineListing } from "./actions";
import {
  IDLE_REVIEW,
  MARKUP_PRESETS_BPS,
  MIN_REASON_CHARS,
  formatBps,
  parseMarkupPercent,
  type ReviewState,
} from "./review-state";

export type PendingListing = {
  id: string;
  name: string;
  description: string;
  category: string;
  imageKey: string | null;
  suggestedMarkupBps: number;
  storeName: string;
  submittedOn: string;
  units: {
    id: string;
    unitLabel: string;
    costKobo: number;
    stockQty: number;
    suggestedPriceKobo: number;
  }[];
};

function Photo({ src, alt }: { src: string | null; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="flex size-20 shrink-0 items-center justify-center rounded-md bg-wheat text-ash/60">
        <Utensils className="size-6" aria-hidden />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className="size-20 shrink-0 rounded-md object-cover bg-wheat"
      onError={() => setFailed(true)}
    />
  );
}

export function ListingReviewCard({ listing }: { listing: PendingListing }) {
  const [approveState, approveAction, approving] = useActionState<ReviewState, FormData>(
    approveListing,
    IDLE_REVIEW
  );
  const [declineState, declineAction, declining] = useActionState<ReviewState, FormData>(
    declineListing,
    IDLE_REVIEW
  );
  const [percent, setPercent] = useState(String(listing.suggestedMarkupBps / 100));
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");

  const markupBps = parseMarkupPercent(percent);
  const priced =
    markupBps === null
      ? null
      : listing.units.map((u) => {
          const price = priceFor(u.costKobo, markupBps);
          return { ...u, priceKobo: price, marginKobo: price - u.costKobo };
        });
  const marginTotal = priced?.reduce((sum, u) => sum + u.marginKobo, 0) ?? 0;
  const reasonReady = reason.trim().length >= MIN_REASON_CHARS;

  return (
    <Card className="p-0 overflow-hidden">
      <div className="awning h-1" aria-hidden />
      <div className="p-5 space-y-4">
        <div className="flex items-start gap-4">
          <Photo src={listing.imageKey} alt={listing.name} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-lg text-espresso leading-tight">{listing.name}</h3>
              <Pill tone="terra">{listing.storeName}</Pill>
            </div>
            <p className="text-[13px] text-ash mt-0.5">
              {listing.category}, submitted {listing.submittedOn}
            </p>
            <p className="text-sm text-cocoa mt-2 leading-relaxed">{listing.description}</p>
          </div>
        </div>

        <div className="rounded-md bg-wheat/60 px-4 py-3">
          <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
            <label className="block">
              <span className="block text-sm font-medium text-cocoa mb-1.5">
                Foodline markup
              </span>
              <div className="relative w-32">
                <input
                  value={percent}
                  onChange={(ev) => setPercent(ev.target.value)}
                  inputMode="decimal"
                  aria-label={`Markup percent for ${listing.name}`}
                  aria-invalid={markupBps === null}
                  className={cn(inputCls, "pr-9 tnum", markupBps === null && "border-bad")}
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-ash text-sm">
                  %
                </span>
              </div>
            </label>
            <div className="flex flex-wrap gap-1.5 pb-1">
              {MARKUP_PRESETS_BPS.map((bps) => {
                const value = String(bps / 100);
                const on = markupBps === bps;
                return (
                  <button
                    key={bps}
                    type="button"
                    onClick={() => setPercent(value)}
                    aria-pressed={on}
                    className={cn(
                      "h-11 min-w-11 px-3 rounded-full text-sm font-medium tnum transition-colors",
                      on
                        ? "bg-terra text-white"
                        : "bg-white border border-crust text-cocoa hover:bg-cream"
                    )}
                  >
                    {formatBps(bps)}
                  </button>
                );
              })}
            </div>
          </div>
          <p className="text-[13px] text-ash mt-2">
            {listing.storeName} suggested {formatBps(listing.suggestedMarkupBps)}. Customers only
            ever see the final price.
          </p>
          {markupBps === null && (
            <p className="text-[13px] text-bad mt-1">
              Enter a markup between 0% and 200%, for example 10.
            </p>
          )}
        </div>

        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full min-w-140 text-left border-collapse">
            <thead>
              <tr className="border-b border-crust">
                <th className="py-2 pr-3 text-[13px] font-medium text-cocoa">Unit</th>
                <th className="py-2 px-3 text-[13px] font-medium text-cocoa whitespace-nowrap">
                  Shop receives
                </th>
                <th className="py-2 px-3 text-[13px] font-medium text-cocoa">Stock</th>
                <th className="py-2 px-3 text-[13px] font-medium text-cocoa whitespace-nowrap">
                  At their {formatBps(listing.suggestedMarkupBps)}
                </th>
                <th className="py-2 px-3 text-[13px] font-medium text-terra-deep whitespace-nowrap">
                  Customer pays
                </th>
                <th className="py-2 pl-3 text-[13px] font-medium text-cocoa whitespace-nowrap">
                  Foodline keeps
                </th>
              </tr>
            </thead>
            <tbody>
              {listing.units.map((unit, i) => {
                const row = priced?.[i];
                return (
                  <tr key={unit.id} className="border-b border-crust/50 last:border-0">
                    <td className="py-2.5 pr-3 text-sm text-espresso">{unit.unitLabel}</td>
                    <td className="py-2.5 px-3 text-sm text-cocoa tnum whitespace-nowrap">
                      {formatNaira(unit.costKobo)}
                    </td>
                    <td className="py-2.5 px-3 text-sm text-cocoa tnum">{unit.stockQty}</td>
                    <td className="py-2.5 px-3 text-[13px] text-ash tnum whitespace-nowrap">
                      {formatNaira(unit.suggestedPriceKobo)}
                    </td>
                    <td className="py-2.5 px-3 text-sm font-medium text-terra-deep tnum whitespace-nowrap">
                      {row ? formatNaira(row.priceKobo) : "Set a markup"}
                    </td>
                    <td className="py-2.5 pl-3 text-sm text-good tnum whitespace-nowrap">
                      {row ? formatNaira(row.marginKobo) : "-"}
                    </td>
                  </tr>
                );
              })}
              {listing.units.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-3 text-sm text-ash">
                    This listing has no sellable units yet, so there is nothing to price. Decline it
                    and ask the shop to add a unit.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {priced && priced.length > 0 && (
          <p className="text-sm text-cocoa">
            At {formatBps(markupBps ?? 0)}, Foodline keeps{" "}
            <span className="tnum font-medium text-espresso">{formatNaira(marginTotal)}</span> across
            one of each unit. The shop is settled its cost, nothing less.
          </p>
        )}

        {approveState.error && <Notice tone="bad">{approveState.error}</Notice>}
        {declineState.error && <Notice tone="bad">{declineState.error}</Notice>}

        <div className="flex flex-wrap items-center gap-2">
          <form action={approveAction}>
            <input type="hidden" name="productId" value={listing.id} />
            <input type="hidden" name="productName" value={listing.name} />
            <input type="hidden" name="markupPercent" value={percent} />
            <Button
              type="submit"
              loading={approving}
              disabled={markupBps === null || listing.units.length === 0 || declineOpen}
            >
              <CircleCheck className="size-4" aria-hidden />
              Approve and publish
            </Button>
          </form>
          {!declineOpen && (
            <button
              type="button"
              onClick={() => setDeclineOpen(true)}
              className="h-11 px-4 rounded-full text-sm font-medium text-ash hover:text-bad hover:bg-bad-tint transition-colors"
            >
              Decline
            </button>
          )}
        </div>

        {declineOpen && (
          <form action={declineAction} className="space-y-3 animate-rise">
            <input type="hidden" name="productId" value={listing.id} />
            <input type="hidden" name="productName" value={listing.name} />
            <label className="block">
              <span className="block text-sm font-medium text-cocoa mb-1.5">
                Why are you declining {listing.name}?
              </span>
              <Textarea
                name="reason"
                value={reason}
                onChange={(ev) => setReason(ev.target.value)}
                placeholder="The photo shows a different product from the description."
                className="min-h-20"
              />
              <span className="block text-[13px] text-ash mt-1.5">
                {listing.storeName} sees this and can fix the listing and send it again. At least{" "}
                {MIN_REASON_CHARS} characters.
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="danger" loading={declining} disabled={!reasonReady}>
                Send decline
              </Button>
              <button
                type="button"
                onClick={() => {
                  setDeclineOpen(false);
                  setReason("");
                }}
                className="h-11 px-4 text-sm text-ash hover:text-cocoa"
              >
                Keep in the queue
              </button>
            </div>
          </form>
        )}
      </div>
    </Card>
  );
}
