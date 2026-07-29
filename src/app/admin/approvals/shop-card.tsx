"use client";

import { useActionState, useState } from "react";
import { BadgeCheck, ShieldAlert, Store } from "lucide-react";
import { Button, Card, Notice, Pill, Textarea, cn } from "@/components/ui";
import { approveShop, declineShop } from "./actions";
import { IDLE_REVIEW, MIN_REASON_CHARS, type ReviewState } from "./review-state";

export type ShopApplication = {
  id: string;
  businessName: string;
  ownerName: string | null;
  email: string;
  contactPhone: string | null;
  address: string | null;
  state: string | null;
  lga: string | null;
  rcNumber: string | null;
  businessType: string | null;
  yearsTrading: number | null;
  description: string | null;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankVerified: boolean;
  appliedOn: string;
};

/** Only ever show the tail of a settlement account number. */
function maskAccount(number: string): string {
  const tail = number.slice(-4);
  return `${"•".repeat(Math.max(0, number.length - 4))}${tail}`;
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="text-[13px] text-ash">{label}</dt>
      <dd className={cn("text-sm mt-0.5 break-words", value ? "text-espresso" : "text-ash/70")}>
        {value ?? "Not provided"}
      </dd>
    </div>
  );
}

export function ShopApplicationCard({ shop }: { shop: ShopApplication }) {
  const [approveState, approveAction, approving] = useActionState<ReviewState, FormData>(
    approveShop,
    IDLE_REVIEW
  );
  const [declineState, declineAction, declining] = useActionState<ReviewState, FormData>(
    declineShop,
    IDLE_REVIEW
  );
  const [declineOpen, setDeclineOpen] = useState(false);
  const [reason, setReason] = useState("");

  const reasonReady = reason.trim().length >= MIN_REASON_CHARS;
  const area = [shop.lga, shop.state].filter(Boolean).join(", ");

  return (
    <Card className="p-0 overflow-hidden">
      <div className="awning h-1" aria-hidden />
      <div className="p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-display text-lg text-espresso leading-tight">
              {shop.businessName}
            </h3>
            <p className="text-[13px] text-ash mt-0.5">
              Applied {shop.appliedOn}
              {shop.businessType ? `, ${shop.businessType}` : ""}
            </p>
          </div>
          {shop.bankVerified ? (
            <Pill tone="good">
              <BadgeCheck className="size-3.5" aria-hidden />
              Bank verified
            </Pill>
          ) : (
            <Pill tone="warn">
              <ShieldAlert className="size-3.5" aria-hidden />
              Bank not verified
            </Pill>
          )}
        </div>

        <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-3">
          <Detail label="Owner" value={shop.ownerName} />
          <Detail label="Login email" value={shop.email} />
          <Detail label="Phone" value={shop.contactPhone} />
          <Detail label="Business type" value={shop.businessType} />
          <Detail
            label="Years trading"
            value={shop.yearsTrading == null ? null : `${shop.yearsTrading}`}
          />
          <Detail label="RC number" value={shop.rcNumber} />
          <Detail label="Service area" value={area || null} />
          <Detail label="Shop address" value={shop.address} />
        </dl>

        {shop.description && (
          <div className="rounded-md bg-wheat/60 px-4 py-3">
            <p className="text-[13px] text-ash">What they sell</p>
            <p className="text-sm text-cocoa mt-1 leading-relaxed">{shop.description}</p>
          </div>
        )}

        <div className="rounded-md border border-crust/70 px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[13px] text-ash">Settlement account</p>
            <p className="text-[13px] text-ash">Foodline pays the shop its cost portion here</p>
          </div>
          <p className="text-sm text-espresso mt-1">
            {shop.bankName} <span className="tnum text-cocoa">{maskAccount(shop.accountNumber)}</span>
          </p>
          <p className="text-sm text-cocoa">{shop.accountName}</p>
        </div>

        {!shop.bankVerified && (
          <Notice tone="warn" title="This account name was never checked with the bank">
            They onboarded in demo mode, so Paystack did not confirm the name on the account. You
            can approve them to trade, but verify {shop.accountName} at {shop.bankName} before the
            first payout leaves.
          </Notice>
        )}

        {approveState.error && <Notice tone="bad">{approveState.error}</Notice>}
        {declineState.error && <Notice tone="bad">{declineState.error}</Notice>}

        <div className="flex flex-wrap items-center gap-2">
          <form action={approveAction}>
            <input type="hidden" name="retailerId" value={shop.id} />
            <input type="hidden" name="businessName" value={shop.businessName} />
            <Button type="submit" loading={approving} disabled={declineOpen}>
              <Store className="size-4" aria-hidden />
              Approve shop
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
            <input type="hidden" name="retailerId" value={shop.id} />
            <input type="hidden" name="businessName" value={shop.businessName} />
            <label className="block">
              <span className="block text-sm font-medium text-cocoa mb-1.5">
                Why are you declining {shop.businessName}?
              </span>
              <Textarea
                name="reason"
                value={reason}
                onChange={(ev) => setReason(ev.target.value)}
                placeholder="The RC number does not match the business name on CAC."
                className="min-h-20"
              />
              <span className="block text-[13px] text-ash mt-1.5">
                The shop sees this reason, so make it specific enough to act on. At least{" "}
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
