"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Inbox, LayoutDashboard, ReceiptText, ScanLine } from "lucide-react";
import { cn } from "@/components/ui";

const TABS = [
  { href: "/retailer", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/retailer/orders", label: "Orders", icon: Inbox, exact: false },
  { href: "/retailer/redeem", label: "Accept card", icon: ScanLine, exact: false },
  { href: "/retailer/history", label: "History", icon: ReceiptText, exact: false },
] as const;

export function RetailerNav({ variant }: { variant: "top" | "bottom" }) {
  const pathname = usePathname();
  const isActive = (tab: (typeof TABS)[number]) =>
    tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);

  if (variant === "top") {
    return (
      <nav aria-label="Retailer sections" className="hidden items-center gap-1 md:flex">
        {TABS.map((tab) => {
          const active = isActive(tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center rounded-full px-4 text-sm font-medium transition-colors",
                active ? "bg-terra-tint text-terra-deep" : "text-cocoa hover:bg-wheat"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav
      aria-label="Retailer sections"
      className="fixed inset-x-0 bottom-0 z-20 border-t border-crust bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="grid grid-cols-4">
        {TABS.map((tab) => {
          const active = isActive(tab);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                active ? "text-terra-deep" : "text-ash"
              )}
            >
              <Icon className="size-5" aria-hidden />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
