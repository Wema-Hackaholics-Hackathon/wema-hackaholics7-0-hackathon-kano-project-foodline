"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { logout } from "@/lib/auth-actions";
import { Button } from "@/components/ui";
import { Logo } from "@/components/logo";

/**
 * Rendered when a retailer session exists but the retailer profile row does
 * not. Cookie changes are only allowed in server actions, so the layout cannot
 * destroy the session during render; this screen calls the logout action the
 * moment it mounts and offers a manual fallback if that call fails.
 */
export function AutoSignOut() {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    logout().catch(() => setFailed(true));
  }, []);

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm text-center animate-rise">
        <Logo />
        <h1 className="mt-6 font-display text-2xl text-espresso">
          We could not find your retailer profile
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ash">
          This account is not set up as a Foodline partner. We are signing you out so you can sign
          in with the right details.
        </p>
        {failed ? (
          <Button size="lg" className="mt-7 w-full" onClick={() => void logout()}>
            Sign out
          </Button>
        ) : (
          <p className="mt-7 flex items-center justify-center gap-2 text-sm text-ash">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Signing you out
          </p>
        )}
      </div>
    </main>
  );
}
