import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import type { retailers } from "@/db/schema";
import { logout } from "@/lib/auth-actions";
import { Logo } from "@/components/logo";
import { Pill } from "@/components/ui";
import { GateGuard, GateTabs } from "./gate-nav";

export type RetailerRow = typeof retailers.$inferSelect;

const PENDING_TABS = [
  { href: "/retailer/pending", label: "Application" },
  { href: "/retailer/products", label: "Products" },
];

/**
 * The shell a partner sees before an admin has approved the shop. A pending
 * shop may prepare its listings; a declined shop sees only its decision. Every
 * other retailer route sends them back to their status screen.
 */
export function StatusGate({
  retailer,
  children,
}: {
  retailer: RetailerRow;
  children: ReactNode;
}) {
  const declined = retailer.status === "rejected";
  const home = declined ? "/retailer/rejected" : "/retailer/pending";
  const allow = declined ? [home] : ["/retailer/pending", "/retailer/products"];

  return (
    <div className="flex min-h-dvh flex-1 flex-col">
      <div className="awning h-1 shrink-0" aria-hidden />
      <header className="border-b border-crust/60 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-3xl items-center gap-3 px-5">
          <Logo size="sm" href={home} />
          <span className="h-5 w-px shrink-0 bg-crust" aria-hidden />
          <p className="min-w-0 truncate text-sm font-medium text-cocoa">
            {retailer.businessName}
          </p>
          <Pill tone={declined ? "neutral" : "warn"} className="hidden shrink-0 sm:inline-flex">
            {declined ? "Not approved" : "Under review"}
          </Pill>
          <form action={logout} className="ml-auto shrink-0">
            <button
              type="submit"
              aria-label="Sign out"
              className="flex size-11 items-center justify-center rounded-full text-ash transition-colors hover:bg-wheat hover:text-cocoa"
            >
              <LogOut className="size-5" aria-hidden />
            </button>
          </form>
        </div>
      </header>

      {!declined && <GateTabs tabs={PENDING_TABS} />}

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-6 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
        <GateGuard allow={allow} to={home}>
          {children}
        </GateGuard>
      </main>
    </div>
  );
}
