"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarClock, CreditCard, House, Store } from "lucide-react";
import { cn } from "@/components/ui";

const TABS = [
  { href: "/app", label: "Home", icon: House },
  { href: "/app/shop", label: "Shop", icon: Store },
  { href: "/app/cards", label: "Cards", icon: CreditCard },
  { href: "/app/repayments", label: "Repay", icon: CalendarClock },
] as const;

function isActive(pathname: string, href: string): boolean {
  if (href === "/app") return pathname === "/app";
  if (href === "/app/cards") {
    return pathname.startsWith("/app/cards") || pathname.startsWith("/app/card/");
  }
  return pathname.startsWith(href);
}

/** Phone: fixed bottom tab bar with safe-area padding */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-crust bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="grid grid-cols-4">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors",
                active ? "text-terra" : "text-ash hover:text-cocoa"
              )}
            >
              <Icon className="size-5" aria-hidden />
              <span>{label}</span>
              <span
                className={cn("size-1 rounded-full", active ? "bg-terra" : "bg-transparent")}
                aria-hidden
              />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

/** Desktop: inline links in the top bar */
export function DesktopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {TABS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors",
              active
                ? "bg-terra-tint text-terra-deep"
                : "text-cocoa hover:bg-wheat hover:text-espresso"
            )}
          >
            <Icon className="size-4.5" aria-hidden />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
