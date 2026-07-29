"use client";

import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";

export default function JoinError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex-1 flex items-center justify-center px-5 py-10">
      <div className="max-w-sm text-center animate-rise">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-warn-tint text-warn">
          <TriangleAlert className="size-6" aria-hidden />
        </div>
        <h1 className="font-display text-2xl text-espresso">That did not go through</h1>
        <p className="text-sm text-ash mt-2 leading-relaxed">
          Something briefly failed on our side, not yours. Your progress is saved, so you can pick
          up exactly where you stopped.
        </p>
        <div className="mt-6 flex flex-col items-stretch gap-2">
          <Button onClick={reset} size="lg">
            Try again
          </Button>
          <Button variant="ghost" href="/join">
            Back to onboarding
          </Button>
        </div>
      </div>
    </main>
  );
}
