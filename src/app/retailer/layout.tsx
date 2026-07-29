import type { ReactNode } from "react";
import { eq } from "drizzle-orm";
import { CirclePause, LogOut } from "lucide-react";
import { getDb } from "@/db";
import { retailers } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { logout } from "@/lib/auth-actions";
import { Logo } from "@/components/logo";
import { Button, DemoBadge } from "@/components/ui";
import { RetailerNav } from "./retailer-nav";
import { AutoSignOut } from "./account-state";
import { StatusGate } from "./pending/status-gate";

export default async function RetailerLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("retailer");
  const db = getDb();
  const retailer = (
    await db.select().from(retailers).where(eq(retailers.id, user.id)).limit(1)
  )[0];

  // Session says retailer but there is no retailer profile: sign them out
  // cleanly rather than strand them in a broken shell.
  if (!retailer) {
    return (
      <div className="flex min-h-dvh flex-1 flex-col">
        <div className="awning h-1 shrink-0" aria-hidden />
        <AutoSignOut />
      </div>
    );
  }

  // Applications wait outside the trading shell: pending shops may prepare
  // their listings, declined shops see only their decision.
  if (retailer.status === "pending" || retailer.status === "rejected") {
    return <StatusGate retailer={retailer}>{children}</StatusGate>;
  }

  if (!retailer.active || retailer.status === "suspended") {
    return (
      <div className="flex min-h-dvh flex-1 flex-col">
        <div className="awning h-1 shrink-0" aria-hidden />
        <header className="border-b border-crust/60 bg-white">
          <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-5">
            <Logo size="sm" />
            <span className="h-5 w-px bg-crust" aria-hidden />
            <p className="min-w-0 truncate text-sm font-medium text-cocoa">
              {retailer.businessName}
            </p>
          </div>
        </header>
        <main className="flex flex-1 items-center justify-center px-5 py-16">
          <div className="w-full max-w-sm text-center animate-rise">
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-wheat text-cocoa">
              <CirclePause className="size-6" aria-hidden />
            </div>
            <h1 className="mt-5 font-display text-2xl text-espresso">
              Your partner account is paused
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ash">
              Card acceptance for {retailer.businessName} is on hold for now. Settlements already
              made to you are not affected. Contact the Foodline partner team and we will help you
              get back to selling.
            </p>
            <form action={logout} className="mt-7">
              <Button type="submit" size="lg" variant="secondary" className="w-full">
                Sign out
              </Button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <div className="awning h-1 shrink-0" aria-hidden />
      <header className="border-b border-crust/60 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-5">
          <Logo size="sm" href="/retailer" />
          <span className="h-5 w-px shrink-0 bg-crust" aria-hidden />
          <p className="min-w-0 truncate text-sm font-medium text-cocoa">
            {retailer.businessName}
          </p>
          {retailer.isDemo && <DemoBadge className="shrink-0" />}
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <RetailerNav variant="top" />
            <form action={logout}>
              <button
                type="submit"
                aria-label="Sign out"
                className="flex size-11 items-center justify-center rounded-full text-ash transition-colors hover:bg-wheat hover:text-cocoa"
              >
                <LogOut className="size-5" aria-hidden />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10">
        {children}
      </main>
      <RetailerNav variant="bottom" />
    </div>
  );
}
