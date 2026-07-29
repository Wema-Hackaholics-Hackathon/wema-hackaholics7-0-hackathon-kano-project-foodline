import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { LogOut } from "lucide-react";
import { getDb } from "@/db";
import { customers } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { logout } from "@/lib/auth-actions";
import { Logo } from "@/components/logo";
import { DemoBadge } from "@/components/ui";
import { CartProvider, FloatingBasket } from "./cart-context";
import { DesktopNav, TabBar } from "./nav";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireRole("customer");
  const db = getDb();
  const customer = (
    await db.select().from(customers).where(eq(customers.id, user.id)).limit(1)
  )[0];
  if (!customer || customer.stage !== "active") redirect("/join");

  return (
    <CartProvider>
      <div className="flex min-h-dvh flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-crust/70 bg-oat/95 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-5">
            <div className="flex items-center gap-2.5">
              <Logo size="sm" href="/app" />
              {customer.isDemo && <DemoBadge />}
            </div>
            <div className="flex items-center gap-2">
              <DesktopNav />
              <form action={logout}>
                <button
                  type="submit"
                  aria-label="Log out"
                  title="Log out"
                  className="flex size-11 items-center justify-center rounded-full text-ash transition-colors hover:bg-wheat hover:text-cocoa"
                >
                  <LogOut className="size-5" aria-hidden />
                </button>
              </form>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6 pb-[calc(env(safe-area-inset-bottom)+96px)] md:pb-12">
          {children}
        </main>

        <FloatingBasket />
        <TabBar />
      </div>
    </CartProvider>
  );
}
