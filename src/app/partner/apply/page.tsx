import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDbAsync } from "@/db";
import { getConfig } from "@/lib/settings";
import { getSessionUser, HOME_PATH } from "@/lib/session";
import { Logo } from "@/components/logo";
import { DemoBadge, Notice } from "@/components/ui";
import { loadBanks } from "./actions";
import { ApplyForm } from "./apply-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Apply to join",
  description:
    "Apply to sell foodstuff on Foodline. Tell us about your shop and the account we should settle into.",
};

export default async function PartnerApplyPage() {
  // Already signed in: no one needs two accounts
  const user = await getSessionUser();
  if (user) redirect(HOME_PATH[user.role]);

  const db = await getDbAsync();
  const [config, banks] = await Promise.all([getConfig(db), loadBanks()]);

  return (
    <>
      <div className="awning h-1 shrink-0" aria-hidden />
      <header className="border-b border-crust/60 bg-white">
        <div className="mx-auto flex h-14 w-full max-w-2xl items-center gap-3 px-5">
          <Logo size="sm" href="/partner" />
          <span className="h-5 w-px shrink-0 bg-crust" aria-hidden />
          <p className="min-w-0 truncate text-sm font-medium text-cocoa">Partner application</p>
          {config.demoMode && <DemoBadge className="ml-auto shrink-0" />}
        </div>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-8">
        <div className="animate-rise">
          <h1 className="font-display text-[28px] leading-tight text-espresso md:text-[32px]">
            Apply to join Foodline
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-ash">
            Four short sections, about five minutes. We review every application within one working
            day and call you if anything needs clearing up.
          </p>

          {banks.length === 0 && (
            <Notice tone="warn" className="mt-5" title="Bank list unavailable">
              We could not load the bank list from Paystack just now. Refresh this page in a moment,
              and if it keeps failing, email support@foodline.com.ng and we will take your details
              by hand.
            </Notice>
          )}

          <div className="mt-6">
            <ApplyForm banks={banks} demoMode={config.demoMode} />
          </div>

          <p className="mt-6 text-center text-sm text-ash">
            Already a partner?{" "}
            <Link href="/login" className="font-medium text-terra-deep hover:underline">
              Sign in to your shop
            </Link>
          </p>
        </div>
      </main>
    </>
  );
}
