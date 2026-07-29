"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { Check, Copy, ShieldCheck, TimerReset } from "lucide-react";
import { Button, DemoBadge, Money, Notice, cn } from "@/components/ui";
import { formatDate } from "@/lib/dates";
import type { TransferDestination } from "@/lib/mono";
import { PinnedCta } from "../join-ui";
import { relinkAccount } from "../salary/actions";
import { createRealMandate, simulateDemoMandate } from "./actions";

export type ExistingMandate = {
  status: "initiated" | "approved" | "rejected" | "cancelled" | "expired";
  readyToDebit: boolean;
  createdAtMs: number;
  destinations: TransferDestination[] | null;
};

type Props = {
  isDemo: boolean;
  bankName: string;
  last4: string;
  capKobo: number;
  months: number;
  endDate: string; // YYYY-MM-DD
  existing: ExistingMandate | null;
};

type Phase =
  | { kind: "summary" }
  | { kind: "authorize"; createdAtMs: number; destinations: TransferDestination[] }
  | { kind: "success"; mode: "demo" | "sandbox" | "approved"; ready: boolean }
  | { kind: "rejected" }
  | { kind: "closed" };

function initialPhase(existing: ExistingMandate | null): Phase {
  if (!existing) return { kind: "summary" };
  switch (existing.status) {
    case "initiated":
      return existing.destinations && existing.destinations.length > 0
        ? {
            kind: "authorize",
            createdAtMs: existing.createdAtMs,
            destinations: existing.destinations,
          }
        : { kind: "closed" };
    case "approved":
      return { kind: "success", mode: "approved", ready: existing.readyToDebit };
    case "rejected":
      return { kind: "rejected" };
    default:
      return { kind: "closed" };
  }
}

export function MandateFlow({ isDemo, bankName, last4, capKobo, months, endDate, existing }: Props) {
  const [phase, setPhase] = useState<Phase>(() => initialPhase(existing));
  const [error, setError] = useState<string | null>(null);
  const [creating, startCreate] = useTransition();

  const create = useCallback(() => {
    setError(null);
    startCreate(async () => {
      if (isDemo) {
        const res = await simulateDemoMandate();
        if ("error" in res) setError(res.error);
        else setPhase({ kind: "success", mode: "demo", ready: true });
        return;
      }
      const res = await createRealMandate();
      if ("error" in res) {
        setError(res.error);
      } else if (res.autoApproved) {
        setPhase({ kind: "success", mode: "sandbox", ready: false });
      } else if (res.destinations && res.destinations.length > 0) {
        setPhase({
          kind: "authorize",
          createdAtMs: res.createdAtMs,
          destinations: res.destinations,
        });
      } else {
        setError("Mono did not return the transfer accounts. Try creating the mandate again.");
      }
    });
  }, [isDemo]);

  // Poll while the customer authorises, and after approval until debits open
  const polling =
    phase.kind === "authorize" || (phase.kind === "success" && phase.mode !== "demo" && !phase.ready);
  useEffect(() => {
    if (!polling) return;
    const id = setInterval(async () => {
      try {
        const res = await fetch("/api/onboarding/mandate-status", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { status?: string; readyToDebit?: boolean };
        const ready = Boolean(data.readyToDebit);
        if (data.status === "approved") {
          setPhase((p) =>
            p.kind === "success"
              ? { ...p, ready: p.ready || ready }
              : { kind: "success", mode: "approved", ready }
          );
        } else if (data.status === "rejected") {
          setPhase({ kind: "rejected" });
        } else if (data.status === "cancelled" || data.status === "expired") {
          setPhase({ kind: "closed" });
        }
      } catch {
        // network blip: next tick retries
      }
    }, 6000);
    return () => clearInterval(id);
  }, [polling]);

  return (
    <>
      {phase.kind === "summary" && (
        <>
          <SummaryCard
            isDemo={isDemo}
            bankName={bankName}
            last4={last4}
            capKobo={capKobo}
            months={months}
            endDate={endDate}
          />
          {error && (
            <Notice tone="bad" className="mt-4" title="Mandate not created">
              {error} <button onClick={create} className="underline font-medium">Retry</button>
            </Notice>
          )}
          <PinnedCta on="dark">
            <Button size="lg" onClick={create} loading={creating} className="w-full">
              {isDemo ? "Simulate the ₦50 authorization" : "Create mandate"}
            </Button>
            <p className="text-center text-xs text-cream/50 mt-3 leading-relaxed">
              {isDemo
                ? "Demo accounts skip the bank transfer. The real flow authorises with a one-time ₦50 NIBSS transfer."
                : "Next you authorise it with a one-time ₦50 NIBSS transfer from your linked account."}
            </p>
          </PinnedCta>
        </>
      )}

      {phase.kind === "authorize" && (
        <div className="animate-rise">
          <p className="text-sm text-cream/75 mt-6 leading-relaxed">
            To activate, transfer exactly <span className="font-semibold text-cream">₦50</span> from
            your {bankName} account ending {last4} to any ONE of these accounts. The ₦50 goes to
            NIBSS, Nigeria&apos;s payment infrastructure, not to Foodline.
          </p>

          <ul className="mt-4 space-y-3">
            {phase.destinations.map((d) => (
              <DestinationCard key={String(d.account_number)} destination={d} />
            ))}
          </ul>

          <Countdown createdAtMs={phase.createdAtMs} />

          <StatusTimeline
            steps={[
              { label: "Created", state: "done" },
              { label: "Awaiting your ₦50 transfer", state: "current" },
              { label: "Approved", state: "pending" },
              { label: "Ready to debit", state: "pending" },
            ]}
          />

          <p className="text-xs text-cream/45 mt-4 leading-relaxed pb-6">
            We check with your bank every few seconds. This screen moves forward on its own the
            moment your transfer lands.
          </p>
        </div>
      )}

      {phase.kind === "success" && (
        <div className="flex flex-col items-center text-center mt-10 animate-rise">
          <span className="flex size-16 items-center justify-center rounded-full bg-good text-cream animate-pop">
            <Check className="size-8" aria-hidden strokeWidth={2.5} />
          </span>
          <h2 className="font-display text-2xl text-cream mt-5">Mandate approved and ready</h2>
          <p className="text-sm text-cream/70 mt-2 max-w-sm leading-relaxed">
            {phase.mode === "demo"
              ? `Your repayment mandate on ${bankName} ••${last4} is approved. We debit only your agreed repayment, only on payday.`
              : "Approved. Banks take from 5 minutes up to 24 hours to open the account for debits. You can shop now: your first repayment is only due on payday."}
          </p>
          {phase.mode === "sandbox" && (
            <Notice tone="note" className="mt-4 text-left">
              Sandbox approved this mandate instantly. In production you would authorise it with a
              one-time ₦50 NIBSS transfer.
            </Notice>
          )}
          {phase.mode === "demo" && <DemoBadge className="mt-4" />}

          <StatusTimeline
            className="w-full text-left"
            steps={[
              { label: "Created", state: "done" },
              { label: "₦50 authorization", state: "done" },
              { label: "Approved", state: "done" },
              {
                label: phase.ready ? "Ready to debit" : "Ready to debit, opening at your bank",
                state: phase.ready ? "done" : "current",
              },
            ]}
          />

          <PinnedCta on="dark" className="w-full">
            <Button size="lg" href="/app" className="w-full">
              Start shopping
            </Button>
          </PinnedCta>
        </div>
      )}

      {phase.kind === "rejected" && (
        <FailureState
          title="Your bank rejected this mandate"
          body={`That usually happens when the ${bankName} account details do not match your BVN records. Relink your salary account and we will set the mandate up again.`}
          action={<RelinkButton />}
        />
      )}

      {phase.kind === "closed" && (
        <FailureState
          title="This mandate is no longer active"
          body="The transfer window was missed, so the mandate closed without being authorised. No money moved. Create a new one and the ₦50 transfer window restarts."
          action={
            <>
              {error && (
                <Notice tone="bad" className="mb-3 text-left">
                  {error}
                </Notice>
              )}
              <Button size="lg" onClick={create} loading={creating} className="w-full">
                Create a new mandate
              </Button>
            </>
          }
        />
      )}
    </>
  );
}

function SummaryCard({
  isDemo,
  bankName,
  last4,
  capKobo,
  months,
  endDate,
}: {
  isDemo: boolean;
  bankName: string;
  last4: string;
  capKobo: number;
  months: number;
  endDate: string;
}) {
  return (
    <div className="mt-6 rounded-lg border border-cream/10 bg-espresso-2 p-5 animate-rise">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-cream">Your repayment mandate</h2>
        {isDemo && <DemoBadge />}
      </div>
      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-cream/55">Linked account</dt>
          <dd className="text-cream font-medium text-right">
            {bankName} <span className="tnum">••{last4}</span>
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-cream/55">Debit cap</dt>
          <dd className="text-cream font-medium">
            <Money kobo={capKobo} whole />
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-cream/55">Valid for</dt>
          <dd className="text-cream font-medium tnum">
            {months} months, until {formatDate(endDate)}
          </dd>
        </div>
      </dl>
      <div className="flex gap-2.5 mt-4 border-t border-cream/10 pt-4">
        <ShieldCheck className="size-4 shrink-0 mt-0.5 text-mango" aria-hidden />
        <p className="text-[13px] text-cream/70 leading-relaxed">
          We debit only your agreed repayment, only on payday. You can cancel this mandate anytime.
        </p>
      </div>
    </div>
  );
}

function DestinationCard({ destination: d }: { destination: TransferDestination }) {
  const account = String(d.account_number);
  return (
    <li
      className="rounded-md border border-cream/10 bg-espresso-2 border-l-4 px-4 py-3.5"
      style={{ borderLeftColor: d.primary_color || "var(--color-mango)" }}
    >
      <div className="flex items-center gap-3">
        {/* Bank icons come from Mono's CDN */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={d.icon}
          alt=""
          className="size-9 shrink-0 rounded-full bg-cream/10 object-contain"
        />
        <div className="min-w-0">
          <p className="text-[13px] text-cream/60 truncate">{d.bank_name}</p>
          <p className="font-display text-xl text-cream tnum tracking-wider">{account}</p>
        </div>
        <CopyButton value={account} label={`Copy ${d.bank_name} account number`} />
      </div>
    </li>
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // clipboard blocked: the number stays readable on screen
        }
      }}
      className={cn(
        "ml-auto flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors",
        copied ? "bg-good text-cream" : "bg-cream/10 text-cream hover:bg-cream/20"
      )}
    >
      {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function Countdown({ createdAtMs }: { createdAtMs: number }) {
  const deadline = createdAtMs + 60 * 60 * 1000;
  // Computed only on the client to keep server and client markup identical
  const [leftMs, setLeftMs] = useState<number | null>(null);
  useEffect(() => {
    const update = () => setLeftMs(Math.max(0, deadline - Date.now()));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [deadline]);

  const mm = leftMs === null ? "--" : String(Math.floor(leftMs / 60000)).padStart(2, "0");
  const ss = leftMs === null ? "--" : String(Math.floor((leftMs % 60000) / 1000)).padStart(2, "0");

  return (
    <div
      className="mt-4 flex items-center gap-3 rounded-md border border-cream/10 bg-espresso-2 px-4 py-3"
      role="timer"
      aria-live="off"
    >
      <TimerReset className="size-5 shrink-0 text-mango" aria-hidden />
      {leftMs === null || leftMs > 0 ? (
        <p className="text-[13px] text-cream/75 leading-relaxed">
          The transfer window closes in{" "}
          <span className="font-semibold text-cream tnum">
            {mm}:{ss}
          </span>
          . If the mandate stays unauthorised it cancels automatically after 6 hours.
        </p>
      ) : (
        <p className="text-[13px] text-cream/75 leading-relaxed">
          The 60 minute transfer window has passed. Your transfer may still land, but an
          unauthorised mandate cancels automatically after 6 hours.
        </p>
      )}
    </div>
  );
}

function StatusTimeline({
  steps,
  className,
}: {
  steps: { label: string; state: "done" | "current" | "pending" }[];
  className?: string;
}) {
  return (
    <ol className={cn("mt-6 space-y-0", className)} aria-label="Mandate progress">
      {steps.map((step, i) => (
        <li key={step.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                step.state === "done" && "border-good bg-good text-cream",
                step.state === "current" && "border-mango bg-transparent",
                step.state === "pending" && "border-cream/20 bg-transparent"
              )}
              aria-hidden
            >
              {step.state === "done" && <Check className="size-3.5" strokeWidth={3} />}
              {step.state === "current" && (
                <span className="size-2 rounded-full bg-mango animate-pulse" />
              )}
            </span>
            {i < steps.length - 1 && (
              <span
                className={cn(
                  "w-0.5 flex-1 min-h-5 my-1 rounded-full",
                  step.state === "done" ? "bg-good/60" : "bg-cream/15"
                )}
                aria-hidden
              />
            )}
          </div>
          <p
            className={cn(
              "text-sm pb-5 pt-0.5",
              step.state === "done" && "text-cream/80",
              step.state === "current" && "text-cream font-medium",
              step.state === "pending" && "text-cream/40"
            )}
          >
            {step.label}
          </p>
        </li>
      ))}
    </ol>
  );
}

function RelinkButton() {
  const [pending, startRelink] = useTransition();
  return (
    <Button size="lg" onClick={() => startRelink(() => relinkAccount())} loading={pending} className="w-full">
      Relink my bank account
    </Button>
  );
}

function FailureState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action: React.ReactNode;
}) {
  return (
    <div className="flex-1 flex flex-col mt-10 text-center animate-rise">
      <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-cream/10 text-cream/80">
        <TimerReset className="size-6" aria-hidden />
      </span>
      <h2 className="font-display text-2xl text-cream mt-5">{title}</h2>
      <p className="text-sm text-cream/65 mt-2 max-w-sm mx-auto leading-relaxed">{body}</p>
      <PinnedCta on="dark">{action}</PinnedCta>
    </div>
  );
}
