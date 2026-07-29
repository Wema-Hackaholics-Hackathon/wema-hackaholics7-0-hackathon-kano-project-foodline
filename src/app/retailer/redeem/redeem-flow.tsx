"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Ban,
  Check,
  CircleCheck,
  Clock,
  Copy,
  Loader2,
  SearchX,
  ShieldAlert,
} from "lucide-react";
import { Button, Card, Money, Notice, Pill, cn, inputCls } from "@/components/ui";
import { formatNaira } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import {
  confirmRedeem,
  lookup,
  type ConfirmResult,
  type InvalidKind,
  type LookupResult,
} from "./actions";
import { QrScanner } from "./qr-scanner";

type LookupOk = Extract<LookupResult, { ok: true }>;
type ConfirmOk = Extract<ConfirmResult, { ok: true }>;

type Phase =
  | { name: "entry" }
  | { name: "looking" }
  | { name: "review"; card: LookupOk }
  | { name: "confirming"; card: LookupOk }
  | { name: "invalid"; kind: InvalidKind | "network" | "confirm_failed"; message: string }
  | { name: "done"; receipt: ConfirmOk };

const NETWORK_MESSAGE =
  "We could not reach Foodline just now. Check your connection and try again.";

function expiresInLabel(expiresAtMs: number): string {
  const minutes = Math.max(0, Math.round((expiresAtMs - Date.now()) / 60_000));
  if (minutes < 60) return `in ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `in about ${hours} hour${hours === 1 ? "" : "s"}`;
}

export function RedeemFlow({ initialToken }: { initialToken?: string }) {
  const [tab, setTab] = useState<"scan" | "code">("scan");
  const [phase, setPhase] = useState<Phase>(
    initialToken ? { name: "looking" } : { name: "entry" }
  );
  const [code, setCode] = useState("");
  // Remount key so "Accept another card" restarts the camera cleanly.
  const [scanSession, setScanSession] = useState(0);
  const autoSubmitted = useRef(false);

  const runLookup = useCallback(async (value: string) => {
    setPhase({ name: "looking" });
    let result: LookupResult;
    try {
      result = await lookup(value);
    } catch {
      setPhase({ name: "invalid", kind: "network", message: NETWORK_MESSAGE });
      return;
    }
    if (result.ok) setPhase({ name: "review", card: result });
    else setPhase({ name: "invalid", kind: result.kind, message: result.message });
  }, []);

  const runConfirm = useCallback(async (card: LookupOk) => {
    setPhase({ name: "confirming", card });
    let result: ConfirmResult;
    try {
      result = await confirmRedeem(card.canonical);
    } catch {
      setPhase({ name: "invalid", kind: "network", message: NETWORK_MESSAGE });
      return;
    }
    if (result.ok) setPhase({ name: "done", receipt: result });
    else setPhase({ name: "invalid", kind: "confirm_failed", message: result.message });
  }, []);

  const reset = useCallback(() => {
    setCode("");
    setTab("scan");
    setScanSession((s) => s + 1);
    setPhase({ name: "entry" });
  }, []);

  // Deep link (/r/[token] or ?token=...): pre-submit the token once.
  useEffect(() => {
    if (initialToken && !autoSubmitted.current) {
      autoSubmitted.current = true;
      void runLookup(initialToken);
    }
  }, [initialToken, runLookup]);

  const codeReady = code.replace(/^FL-?/, "").length >= 6;

  if (phase.name === "done") {
    return <SuccessScreen receipt={phase.receipt} onAgain={reset} />;
  }

  return (
    <div className="mx-auto w-full max-w-md animate-rise">
      <h1 className="font-display text-2xl leading-tight text-espresso md:text-[28px]">
        Accept a card
      </h1>
      <p className="mt-1 text-sm text-ash">
        Scan the QR on the customer&rsquo;s Foodline Card, or enter the short code.
      </p>

      {phase.name === "entry" && (
        <div className="mt-5">
          <div role="tablist" aria-label="How to accept the card" className="flex rounded-full bg-wheat p-1">
            {(
              [
                ["scan", "Scan"],
                ["code", "Enter code"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                role="tab"
                id={`redeem-tab-${value}`}
                aria-selected={tab === value}
                aria-controls={`redeem-panel-${value}`}
                onClick={() => setTab(value)}
                className={cn(
                  "h-11 flex-1 rounded-full text-sm font-medium transition-colors",
                  tab === value ? "bg-white text-espresso shadow-1" : "text-ash hover:text-cocoa"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "scan" ? (
            <div
              role="tabpanel"
              id="redeem-panel-scan"
              aria-labelledby="redeem-tab-scan"
              className="mt-4"
            >
              <QrScanner
                key={scanSession}
                onDecode={(token) => void runLookup(token)}
                onSwitchToCode={() => setTab("code")}
              />
              <Button
                variant="ghost"
                size="lg"
                className="mt-3 w-full"
                onClick={() => setTab("code")}
              >
                Enter code instead
              </Button>
            </div>
          ) : (
            <form
              role="tabpanel"
              id="redeem-panel-code"
              aria-labelledby="redeem-tab-code"
              className="mt-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (codeReady) void runLookup(code);
              }}
            >
              <label htmlFor="voucher-code" className="mb-1.5 block text-sm font-medium text-cocoa">
                Card code
              </label>
              <input
                id="voucher-code"
                value={code}
                onChange={(e) =>
                  setCode(e.target.value.toUpperCase().replace(/\s/g, "").replace(/[^A-Z0-9-]/g, ""))
                }
                placeholder="FL-8PM3QK"
                autoFocus
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={40}
                className={cn(
                  inputCls,
                  "tnum h-14 text-center text-xl font-medium uppercase tracking-[0.18em] placeholder:tracking-[0.18em]"
                )}
              />
              <p className="mt-1.5 text-[13px] leading-snug text-ash">
                The short code under the QR on the customer&rsquo;s card. With or without the FL
                prefix, both work.
              </p>
              <Button type="submit" size="lg" disabled={!codeReady} className="mt-4 w-full">
                Find card
              </Button>
            </form>
          )}
        </div>
      )}

      {phase.name === "looking" && (
        <div className="mt-10 flex flex-col items-center justify-center py-14 text-center animate-rise">
          <Loader2 className="size-7 animate-spin text-terra" aria-hidden />
          <p className="mt-4 text-sm font-medium text-cocoa">Checking this card</p>
          <p className="mt-1 text-[13px] text-ash">One moment while we look it up.</p>
        </div>
      )}

      {(phase.name === "review" || phase.name === "confirming") && (
        <ReviewScreen
          card={phase.card}
          confirming={phase.name === "confirming"}
          onConfirm={() => void runConfirm(phase.card)}
          onCancel={reset}
        />
      )}

      {phase.name === "invalid" && (
        <InvalidScreen kind={phase.kind} message={phase.message} onReset={reset} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------

function ReviewScreen({
  card,
  confirming,
  onConfirm,
  onCancel,
}: {
  card: LookupOk;
  confirming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mt-5 animate-rise">
      <Card className="overflow-hidden p-0">
        <div className="flex items-center justify-between gap-3 border-b border-crust/60 px-5 py-4">
          <div className="min-w-0">
            <p className="text-[13px] text-ash">Foodline Card</p>
            <p className="truncate font-medium text-espresso">{card.customerName}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="tnum text-sm font-medium text-cocoa">{card.voucherCode}</p>
            <Pill tone="good" className="mt-1">
              Valid card
            </Pill>
          </div>
        </div>
        <ul className="divide-y divide-crust/60 px-5">
          {card.items.map((item, i) => (
            <li key={i} className="flex items-baseline justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm text-espresso">
                  <span className="tnum">{item.qty}</span> × {item.productName}
                </p>
                <p className="mt-0.5 text-[13px] text-ash">{item.unitLabel}</p>
              </div>
              <Money kobo={item.lineTotalKobo} className="shrink-0 text-sm text-cocoa" />
            </li>
          ))}
        </ul>
        <div className="flex items-baseline justify-between gap-3 bg-wheat/60 px-5 py-4">
          <p className="text-sm text-cocoa">Total to receive</p>
          <p className="font-display tnum text-3xl text-espresso">{formatNaira(card.totalKobo)}</p>
        </div>
      </Card>

      <p className="mt-3 flex items-center gap-1.5 text-[13px] text-ash">
        <Clock className="size-3.5 shrink-0" aria-hidden />
        Expires {expiresInLabel(card.expiresAtMs)}, at {formatDateTime(card.expiresAtMs)}
      </p>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] mt-5 md:static">
        <Button size="lg" className="w-full" loading={confirming} onClick={onConfirm}>
          Confirm and receive {formatNaira(card.totalKobo)}
        </Button>
      </div>
      <Button
        variant="ghost"
        size="lg"
        className="mt-2 w-full"
        disabled={confirming}
        onClick={onCancel}
      >
        Scan a different card
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Invalid card states
// ---------------------------------------------------------------------------

const INVALID_UI: Record<
  string,
  { title: string; icon: typeof Ban; circle: string }
> = {
  used: { title: "Already used", icon: Ban, circle: "bg-bad-tint text-bad" },
  expired: { title: "This card has expired", icon: Clock, circle: "bg-warn-tint text-warn" },
  cancelled: { title: "This card was cancelled", icon: Ban, circle: "bg-wheat text-cocoa" },
  not_found: { title: "Card not found", icon: SearchX, circle: "bg-wheat text-cocoa" },
  auth: { title: "You are signed out", icon: ShieldAlert, circle: "bg-warn-tint text-warn" },
  network: { title: "Connection trouble", icon: ShieldAlert, circle: "bg-note-tint text-note" },
  confirm_failed: {
    title: "We could not complete that",
    icon: ShieldAlert,
    circle: "bg-warn-tint text-warn",
  },
};

function InvalidScreen({
  kind,
  message,
  onReset,
}: {
  kind: string;
  message: string;
  onReset: () => void;
}) {
  const ui = INVALID_UI[kind] ?? INVALID_UI.not_found;
  const Icon = ui.icon;
  return (
    <div className="mt-6 py-8 text-center animate-rise">
      <div className={cn("mx-auto flex size-14 items-center justify-center rounded-full", ui.circle)}>
        <Icon className="size-6" aria-hidden />
      </div>
      <h2 className="mt-4 font-display text-xl text-espresso">{ui.title}</h2>
      <p className="mx-auto mt-1.5 max-w-xs text-sm leading-relaxed text-ash">{message}</p>
      <div className="mx-auto mt-6 flex max-w-xs flex-col gap-2">
        {kind === "auth" ? (
          <Button size="lg" href="/login" className="w-full">
            Sign in again
          </Button>
        ) : (
          <Button size="lg" onClick={onReset} className="w-full">
            Scan another card
          </Button>
        )}
        <Button variant="ghost" size="lg" href="/retailer" className="w-full">
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Settlement confirmation: the money-arriving moment
// ---------------------------------------------------------------------------

function SuccessScreen({ receipt, onAgain }: { receipt: ConfirmOk; onAgain: () => void }) {
  const [copied, setCopied] = useState(false);

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(receipt.reference);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (unlikely on modern phones); nothing to break.
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center py-8 text-center">
      <div className="animate-pop flex size-24 items-center justify-center rounded-full bg-good-tint text-good">
        <CircleCheck className="size-12" strokeWidth={1.75} aria-hidden />
      </div>
      <h1 className="animate-rise mt-6 font-display text-3xl leading-tight text-espresso">
        <span className="tnum">{formatNaira(receipt.amountKobo)}</span> is on its way to you
      </h1>
      <p className="mt-2 text-sm text-cocoa">
        Paid to {receipt.bankName}
        {receipt.accountLast4 ? ` ••${receipt.accountLast4}` : ""}
      </p>

      <button
        onClick={() => void copyReference()}
        aria-label="Copy Paystack reference"
        className="mt-5 flex w-full max-w-sm items-center justify-between gap-3 rounded-md border border-crust bg-white px-4 py-3 text-left transition-colors hover:border-cocoa/40"
      >
        <span className="min-w-0">
          <span className="block text-[11px] uppercase tracking-wider text-ash">
            Paystack reference
          </span>
          <code className="tnum block truncate text-[13px] text-espresso">{receipt.reference}</code>
        </span>
        {copied ? (
          <Check className="size-4.5 shrink-0 text-good" aria-hidden />
        ) : (
          <Copy className="size-4.5 shrink-0 text-ash" aria-hidden />
        )}
      </button>
      <p className="mt-2 text-[13px] text-ash">{formatDateTime(receipt.atMs)}</p>

      {receipt.settlementStatus === "pending" && (
        <Notice tone="note" className="mt-4 w-full max-w-sm text-left">
          Paystack is completing this transfer. It will appear in History as settled shortly.
        </Notice>
      )}

      <div className="mt-8 flex w-full max-w-sm flex-col gap-3">
        <Button size="lg" className="w-full" onClick={onAgain}>
          Accept another card
        </Button>
        <Button size="lg" variant="secondary" href="/retailer" className="w-full">
          Back to dashboard
        </Button>
      </div>
    </div>
  );
}
