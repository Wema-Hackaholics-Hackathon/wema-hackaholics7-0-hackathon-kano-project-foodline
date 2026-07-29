"use client";

import { useActionState, useState } from "react";
import { Button, Notice } from "@/components/ui";
import { collectNow, type CollectState } from "./actions";

export function CollectButton({ loanId }: { loanId: string }) {
  const [state, formAction, pending] = useActionState<CollectState, FormData>(collectNow, {
    outcomes: [],
    error: null,
  });
  const [confirming, setConfirming] = useState(false);

  return (
    <div>
      {confirming ? (
        <form action={formAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="loanId" value={loanId} />
          <span className="text-[13px] text-cocoa">
            Debit every installment that is due under this mandate?
          </span>
          <Button type="submit" loading={pending} size="sm">
            Yes, collect now
          </Button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="text-sm text-ash hover:text-cocoa h-11 px-2"
          >
            Cancel
          </button>
        </form>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          Attempt collection now
        </Button>
      )}

      {state.error && (
        <Notice tone="bad" className="mt-3">
          {state.error}
        </Notice>
      )}
      {state.outcomes.length > 0 && (
        <div className="mt-3 space-y-2">
          {state.outcomes.map((o, i) => (
            <Notice
              key={i}
              tone={o.status === "successful" ? "good" : o.attempted ? "bad" : "warn"}
            >
              {o.message}
            </Notice>
          ))}
        </div>
      )}
    </div>
  );
}
