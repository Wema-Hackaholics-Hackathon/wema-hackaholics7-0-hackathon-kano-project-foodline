"use client";

import { useEffect } from "react";
import { Store } from "lucide-react";
import { Button } from "@/components/ui";

export default function RetailerError({
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
    <div className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm text-center animate-rise">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-terra-tint text-terra-deep">
          <Store className="size-6" aria-hidden />
        </div>
        <h1 className="mt-5 font-display text-2xl text-espresso">
          Something went wrong on our side
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ash">
          No card was redeemed and no money moved. Give it a moment, then try again. If it keeps
          happening, the Foodline partner team can help.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <Button size="lg" className="w-full" onClick={() => unstable_retry()}>
            Try again
          </Button>
          <Button size="lg" variant="ghost" href="/retailer" className="w-full">
            Back to dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
