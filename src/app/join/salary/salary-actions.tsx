"use client";

import { useActionState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Button, Notice } from "@/components/ui";
import { PinnedCta } from "../join-ui";
import { confirmSalary, notifyWhenQualified, relinkAccount, type ConfirmState } from "./actions";

/** Confirm bar for the eligible verdict: primary confirm + dispute link. */
export function SalaryConfirmBar() {
  const [state, formAction, pending] = useActionState<ConfirmState, FormData>(confirmSalary, {
    error: null,
  });
  const [relinkPending, startRelink] = useTransition();

  return (
    <PinnedCta>
      {state.error && (
        <Notice tone="bad" className="mb-3">
          {state.error}
        </Notice>
      )}
      <form action={formAction}>
        <Button type="submit" size="lg" loading={pending} className="w-full">
          Yes, that is my salary
        </Button>
      </form>
      <button
        onClick={() => startRelink(() => relinkAccount())}
        disabled={relinkPending || pending}
        className="mt-2 w-full h-11 inline-flex items-center justify-center gap-2 rounded-full text-[15px] font-medium text-terra-deep hover:bg-terra-tint transition-colors disabled:opacity-60"
      >
        {relinkPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        That is not right
      </button>
    </PinnedCta>
  );
}

/** Recovery actions for the not-eligible verdict. */
export function NotEligibleActions() {
  const [relinkPending, startRelink] = useTransition();
  const [notifyPending, startNotify] = useTransition();

  return (
    <PinnedCta>
      <Button
        size="lg"
        onClick={() => startRelink(() => relinkAccount())}
        loading={relinkPending}
        disabled={notifyPending}
        className="w-full"
      >
        Relink another account
      </Button>
      <button
        onClick={() => startNotify(() => notifyWhenQualified())}
        disabled={notifyPending || relinkPending}
        className="mt-2 w-full h-11 inline-flex items-center justify-center gap-2 rounded-full border border-crust bg-white text-[15px] font-medium text-espresso hover:bg-cream transition-colors disabled:opacity-60"
      >
        {notifyPending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        Notify me when I qualify
      </button>
      <p className="text-center text-xs text-ash mt-3 leading-relaxed">
        Notifying signs you out. Your account stays open, and we will email you when you qualify.
      </p>
    </PinnedCta>
  );
}
