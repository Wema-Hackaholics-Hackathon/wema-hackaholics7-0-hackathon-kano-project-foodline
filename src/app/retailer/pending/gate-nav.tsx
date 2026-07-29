"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { redirect, usePathname } from "next/navigation";
import { cn } from "@/components/ui";

function matches(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

/**
 * A shop waiting on a decision may only use the routes its status allows.
 * The check lives here rather than in the layout because a layout cannot see
 * the pathname, and redirecting from the layout to a route inside the same
 * layout would loop.
 */
export function GateGuard({
  allow,
  to,
  children,
}: {
  allow: string[];
  to: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (!allow.some((base) => matches(pathname, base))) redirect(to);
  return <>{children}</>;
}

export function GateTabs({ tabs }: { tabs: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Application sections"
      className="border-b border-crust/60 bg-white"
    >
      <div className="mx-auto flex w-full max-w-3xl items-center gap-1 px-5">
        {tabs.map((tab) => {
          const active = matches(pathname, tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px flex h-12 items-center border-b-2 px-3 text-sm font-medium transition-colors",
                active
                  ? "border-terra text-terra-deep"
                  : "border-transparent text-ash hover:text-cocoa"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
