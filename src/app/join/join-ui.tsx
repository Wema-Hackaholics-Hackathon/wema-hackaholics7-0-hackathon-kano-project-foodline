import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/logo";
import { StepBar, cn } from "@/components/ui";
import { logout } from "@/lib/auth-actions";

// Shared presentation for the /join flow: the stepped header and the dark
// (espresso) form primitives used on the trust screens. No hooks in here so
// both server and client components can use these.

export const JOIN_STEPS = ["Account", "Profile", "Link bank", "Salary", "Mandate"] as const;

export function JoinHeader({
  step,
  on = "light",
  back,
  right,
  showSignOut,
}: {
  /** 1-based step in the 5-step journey */
  step: number;
  on?: "light" | "dark";
  /** Optional back affordance target */
  back?: string;
  right?: ReactNode;
  showSignOut?: boolean;
}) {
  const dark = on === "dark";
  return (
    <header>
      <div className="flex items-center gap-2 min-h-11">
        {back && (
          <Link
            href={back}
            aria-label="Go back"
            className={cn(
              "flex size-11 -ml-3 items-center justify-center rounded-full transition-colors",
              dark ? "text-cream/70 hover:text-cream hover:bg-cream/10" : "text-cocoa hover:bg-wheat"
            )}
          >
            <ArrowLeft className="size-5" />
          </Link>
        )}
        <Logo on={on} size="sm" />
        <div className="ml-auto flex items-center gap-1">
          {right}
          {showSignOut && (
            <form action={logout}>
              <button
                type="submit"
                className={cn(
                  "h-11 px-3 text-[13px] rounded-full transition-colors",
                  dark ? "text-cream/60 hover:text-cream" : "text-ash hover:text-cocoa"
                )}
              >
                Sign out
              </button>
            </form>
          )}
        </div>
      </div>
      <StepBar total={JOIN_STEPS.length} current={step} className="mt-3" />
      <p className={cn("mt-2 text-xs", dark ? "text-cream/60" : "text-ash")}>
        Step {step} of {JOIN_STEPS.length}: {JOIN_STEPS[step - 1]}
      </p>
    </header>
  );
}

/** Input styling for espresso trust screens (mirrors inputCls from the kit). */
export const darkInputCls =
  "w-full h-12 rounded-md border border-cream/20 bg-espresso-2 px-4 text-[15px] text-cream placeholder:text-cream/40 focus:border-mango focus:outline-none focus:ring-2 focus:ring-mango/25 transition-shadow disabled:opacity-60";

/** Field wrapper for espresso trust screens (mirrors Field from the kit). */
export function DarkField({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("block", className)}>
      <span className="block text-sm font-medium text-cream/85 mb-1.5">{label}</span>
      {children}
      {hint && !error && (
        <span className="block text-[13px] text-cream/55 mt-1.5 leading-snug">{hint}</span>
      )}
      {error && <span className="block text-[13px] text-[#ffb4ab] mt-1.5">{error}</span>}
    </label>
  );
}

/** Sticky bottom CTA container: pinned on phones, inline on desktop. */
export function PinnedCta({
  children,
  on = "light",
  className,
}: {
  children: ReactNode;
  on?: "light" | "dark";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 mt-auto -mx-5 px-5 pt-6 pb-[calc(env(safe-area-inset-bottom)+16px)]",
        on === "dark"
          ? "bg-gradient-to-t from-espresso via-espresso/95 to-transparent"
          : "bg-gradient-to-t from-oat via-oat/95 to-transparent",
        "md:static md:mx-0 md:bg-none md:p-0 md:pt-4",
        className
      )}
    >
      {children}
    </div>
  );
}

/** "around the 26th" style ordinals for pay days. */
export function ordinal(n: number): string {
  const v = n % 100;
  if (v >= 11 && v <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** 450 bps -> "4.5", 400 -> "4" */
export function bpsToPct(bps: number): string {
  const pct = bps / 100;
  return Number.isInteger(pct) ? String(pct) : pct.toFixed(1);
}
