"use client";

import { useEffect } from "react";
import { CookingPot } from "lucide-react";
import { Button } from "@/components/ui";
import { Logo } from "@/components/logo";

/**
 * Root error boundary: catches unexpected render errors on the landing page
 * (and acts as a calm fallback for any route without its own boundary).
 */
export default function RootError({
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
    <main className="flex flex-1 items-center justify-center bg-oat px-5 py-16">
      <div className="w-full max-w-sm text-center animate-rise">
        <Logo href="/" />
        <div className="mx-auto mt-8 flex size-14 items-center justify-center rounded-full bg-terra-tint text-terra-deep">
          <CookingPot className="size-6" aria-hidden />
        </div>
        <h1 className="mt-5 font-display text-2xl text-espresso">
          Something went wrong on our side
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ash">
          It is not you, and nothing has happened to your account. Give it a moment, then try
          again.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <Button size="lg" onClick={() => unstable_retry()} className="w-full">
            Try again
          </Button>
          <Button size="lg" variant="ghost" href="/" className="w-full">
            Go to the homepage
          </Button>
        </div>
      </div>
    </main>
  );
}
