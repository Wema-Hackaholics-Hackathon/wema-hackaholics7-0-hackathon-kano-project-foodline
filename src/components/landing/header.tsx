import Link from "next/link";
import { Logo } from "@/components/logo";

/**
 * Sticky translucent landing header. Sits on the espresso hero and stays
 * legible over the light sections as a dark bar with a blur.
 */
export function LandingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-cream/10 bg-espresso/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-4 sm:px-6">
        <span className="sm:hidden">
          <Logo on="dark" size="sm" href="/" />
        </span>
        <span className="hidden sm:block">
          <Logo on="dark" href="/" />
        </span>
        <nav aria-label="Primary" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/login"
            className="inline-flex h-11 items-center rounded-full px-3 text-sm font-medium text-cream/90 transition-colors hover:bg-cream/10 hover:text-cream sm:px-5 sm:text-[15px]"
          >
            Sign in
          </Link>
          <Link
            href="/join"
            className="inline-flex h-11 items-center rounded-full bg-terra px-4 text-sm font-medium text-white shadow-1 transition-colors hover:bg-terra-deep sm:px-6 sm:text-[15px]"
          >
            Get your credit line
          </Link>
        </nav>
      </div>
    </header>
  );
}
