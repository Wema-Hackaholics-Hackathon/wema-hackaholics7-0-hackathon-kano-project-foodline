"use client";

import { useEffect } from "react";
import { CookingPot } from "lucide-react";
import { Button } from "@/components/ui";

export default function AppError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 items-center justify-center py-16">
      <div className="w-full max-w-sm text-center animate-rise">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-terra-tint text-terra-deep">
          <CookingPot className="size-6" aria-hidden />
        </div>
        <h1 className="mt-5 font-display text-2xl text-espresso">
          This screen did not load
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ash">
          It is not you, and nothing has happened to your credit line or your money. Give it a
          moment, then try again.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <Button size="lg" onClick={() => unstable_retry()} className="w-full">
            Try again
          </Button>
          <Button size="lg" variant="ghost" href="/app" className="w-full">
            Back to home
          </Button>
        </div>
      </div>
    </div>
  );
}
