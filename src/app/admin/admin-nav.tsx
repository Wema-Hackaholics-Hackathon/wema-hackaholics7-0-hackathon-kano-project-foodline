"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Package,
  Store,
  Banknote,
  SlidersHorizontal,
  ScrollText,
  PlayCircle,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { cn } from "@/components/ui";
import { logout } from "@/lib/auth-actions";

const ITEMS = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/products", label: "Catalog", icon: Package, exact: false },
  { href: "/admin/retailers", label: "Partner stores", icon: Store, exact: false },
  { href: "/admin/loans", label: "Loan book", icon: Banknote, exact: false },
  { href: "/admin/lending", label: "Lending config", icon: SlidersHorizontal, exact: false },
  { href: "/admin/ledger", label: "Audit ledger", icon: ScrollText, exact: false },
  { href: "/admin/demo", label: "Demo panel", icon: PlayCircle, exact: false },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-1">
      {ITEMS.map((item) => {
        const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-sm px-3 h-11 text-[15px] transition-colors",
              active ? "bg-cream/10 text-cream" : "text-cream/65 hover:text-cream hover:bg-cream/5"
            )}
          >
            {active && (
              <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-mango" aria-hidden />
            )}
            <Icon className="size-4.5 shrink-0" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SignOut() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="w-full text-left text-[13px] text-cream/60 hover:text-cream h-11 flex items-center"
      >
        Sign out
      </button>
    </form>
  );
}

export function AdminSidebar({ name }: { name: string }) {
  return (
    <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-espresso flex-col p-4">
      <div className="px-3 py-2">
        <Logo on="dark" href="/admin" />
      </div>
      <div className="mt-6 flex-1">
        <NavLinks />
      </div>
      <div className="border-t border-cream/10 pt-3 px-3">
        <p className="text-sm text-cream truncate">{name}</p>
        <p className="text-[13px] text-cream/50">Operations</p>
        <SignOut />
      </div>
    </aside>
  );
}

export function AdminTopBar({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <div className="flex items-center justify-between bg-espresso px-4 h-14">
        <Logo on="dark" size="sm" href="/admin" />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-label="Open menu"
          className="flex size-11 items-center justify-center text-cream"
        >
          <Menu className="size-5" />
        </button>
      </div>
      {open && (
        <div className="fixed inset-0 z-50 flex">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-espresso/60"
          />
          <div
            className="relative ml-auto h-full w-72 bg-espresso p-4 flex flex-col animate-rise"
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
          >
            <div className="flex items-center justify-between px-3 py-2">
              <Logo on="dark" />
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="flex size-11 items-center justify-center text-cream"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-4 flex-1">
              <NavLinks onNavigate={() => setOpen(false)} />
            </div>
            <div className="border-t border-cream/10 pt-3 px-3">
              <p className="text-sm text-cream truncate">{name}</p>
              <SignOut />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
