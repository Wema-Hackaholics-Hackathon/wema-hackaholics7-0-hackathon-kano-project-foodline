"use client";

import { useState, useTransition } from "react";
import { Landmark, Loader2 } from "lucide-react";
import { Button, DemoBadge, Notice } from "@/components/ui";
import { PinnedCta } from "../join-ui";
import { linkDemoAccount, submitMonoCode } from "./actions";

type Props = {
  name: string;
  email: string;
  bvn: string;
  demoMode: boolean;
};

export function LinkConnect({ name, email, bvn, demoMode }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [exchanging, setExchanging] = useState(false);
  const [opening, setOpening] = useState(false);
  const [, startExchange] = useTransition();
  const [demoPending, startDemo] = useTransition();

  async function openWidget() {
    setError(null);
    const key = process.env.NEXT_PUBLIC_MONO_PUBLIC_KEY;
    if (!key) {
      setError(
        demoMode
          ? "Bank linking is not configured in this environment. Use the demo salary account below instead."
          : "Bank linking is not configured in this environment. Please contact support."
      );
      return;
    }
    setOpening(true);
    try {
      const Connect = (await import("@mono.co/connect.js")).default;
      const mono = new Connect({
        key,
        data: {
          customer: {
            name,
            email,
            identity: { type: "bvn", number: bvn },
          },
        },
        onSuccess: ({ code }: { code: string }) => {
          setExchanging(true);
          startExchange(async () => {
            const res = await submitMonoCode(code);
            if (res?.error) {
              setExchanging(false);
              setError(res.error);
            }
          });
        },
        onClose: () => {
          setOpening(false);
        },
      });
      mono.setup();
      mono.open();
    } catch {
      setOpening(false);
      setError("The bank widget could not load. Check your connection and try again.");
    }
  }

  function startDemoLink() {
    setError(null);
    startDemo(async () => {
      const res = await linkDemoAccount();
      if (res?.error) setError(res.error);
    });
  }

  return (
    <>
      {error && (
        <Notice tone="bad" className="mt-6" title="Connection not completed">
          {error} <button onClick={openWidget} className="underline font-medium">Retry</button>
        </Notice>
      )}

      <PinnedCta on="dark">
        <Button
          size="lg"
          onClick={openWidget}
          loading={opening && !exchanging}
          className="w-full"
        >
          <Landmark className="size-4.5" aria-hidden />
          Connect with Mono
        </Button>

        {demoMode && (
          <>
            <div className="flex items-center gap-3 my-4" role="presentation">
              <span className="h-px flex-1 bg-cream/15" />
              <span className="text-xs text-cream/50">or</span>
              <span className="h-px flex-1 bg-cream/15" />
            </div>
            <div className="rounded-md border border-cream/15 bg-espresso-2 p-4">
              <div className="flex items-center gap-2">
                <DemoBadge />
                <p className="text-[13px] text-cream/70">Prefer to explore first?</p>
              </div>
              <button
                onClick={startDemoLink}
                disabled={demoPending}
                className="mt-3 w-full h-11 inline-flex items-center justify-center gap-2 rounded-full bg-transparent border border-cream/25 text-cream text-[15px] font-medium hover:bg-cream/10 transition-colors disabled:opacity-60"
              >
                {demoPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
                Use a demo salary account
              </button>
            </div>
          </>
        )}
      </PinnedCta>

      {exchanging && (
        <div
          className="fixed inset-0 z-50 bg-espresso flex flex-col items-center justify-center px-8 text-center"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="size-8 animate-spin text-mango" aria-hidden />
          <p className="font-display text-xl text-cream mt-5">Securing your connection...</p>
          <p className="text-sm text-cream/60 mt-2 max-w-xs leading-relaxed">
            We are confirming your account with Mono. This takes a few seconds, do not close this
            page.
          </p>
        </div>
      )}
    </>
  );
}
