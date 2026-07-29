import Link from "next/link";
import { Play } from "lucide-react";
import { Logo } from "@/components/logo";

const FOOTER_LINK_CLS =
  "inline-flex min-h-11 items-center text-sm text-cream/70 transition-colors hover:text-cream";

/** Espresso footer: identity, hackathon credit and the project links. */
export function LandingFooter() {
  return (
    <footer className="bg-espresso text-cream">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-6 sm:py-16">
        <div className="gap-10 md:flex md:items-start md:justify-between">
          <div className="max-w-xs">
            <Logo on="dark" href="/" />
            <p className="mt-2 text-sm text-cream/60">foodline.com.ng</p>
            <p className="mt-4 text-[13px] leading-relaxed text-cream/50">
              Built for Wema Bank Hackaholics 7.0, Problem Statement 1: Open Banking.
            </p>
          </div>
          <nav
            aria-label="Footer"
            className="mt-10 grid grid-cols-2 gap-8 md:mt-0 md:gap-16"
          >
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream/40">
                Get started
              </p>
              <ul className="mt-3 space-y-1">
                <li>
                  <Link href="/join" className={FOOTER_LINK_CLS}>
                    Get your credit line
                  </Link>
                </li>
                <li>
                  <Link href="/login" className={FOOTER_LINK_CLS}>
                    Sign in
                  </Link>
                </li>
                <li>
                  <Link href="/partner" className={FOOTER_LINK_CLS}>
                    Become a partner store
                  </Link>
                </li>
                <li>
                  <Link href="/login" className={FOOTER_LINK_CLS}>
                    Partner sign-in
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cream/40">
                Project
              </p>
              <ul className="mt-3 space-y-1">
                <li>
                  <a
                    href="https://github.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={FOOTER_LINK_CLS}
                  >
                    GitHub repository
                  </a>
                </li>
                <li>
                  <a
                    href="https://www.youtube.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${FOOTER_LINK_CLS} gap-1.5`}
                  >
                    <Play className="size-4" aria-hidden />
                    Watch the 90-second demo
                  </a>
                </li>
              </ul>
            </div>
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-cream/10 pt-6 text-[13px] text-cream/50 sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; 2026 Foodline. Made in Lagos.</p>
          <p>Secured by Mono, settled by Paystack.</p>
        </div>
      </div>
    </footer>
  );
}
