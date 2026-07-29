"use client";

import { useActionState } from "react";
import { RotateCcw } from "lucide-react";
import { Button, Notice } from "@/components/ui";
import { reapply, type ReapplyState } from "./actions";

export function ReapplyForm() {
  const [state, formAction, pending] = useActionState<ReapplyState, FormData>(reapply, {
    error: null,
  });

  return (
    <form action={formAction} className="space-y-3">
      {state.error && <Notice tone="bad">{state.error}</Notice>}
      <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto">
        <RotateCcw className="size-4" aria-hidden />
        Send my application again
      </Button>
    </form>
  );
}
