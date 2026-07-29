import type { Metadata } from "next";
import Link from "next/link";
import { requireJoinPage } from "./flow";
import { JoinHeader } from "./join-ui";
import { AccountForm } from "./account-form";

export const metadata: Metadata = { title: "Create your account" };

export default async function JoinPage() {
  await requireJoinPage("account");

  return (
    <main className="flex-1 flex flex-col px-5 py-6">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        <JoinHeader
          step={1}
          right={
            <p className="text-[13px] text-ash">
              <span className="hidden min-[400px]:inline">Already have an account? </span>
              <Link href="/login" className="text-terra-deep font-medium hover:underline">
                Sign in
              </Link>
            </p>
          }
        />

        <div className="mt-8 animate-rise">
          <h1 className="font-display text-[28px] leading-tight text-espresso">
            Create your account
          </h1>
          <p className="text-sm text-ash mt-2 leading-relaxed">
            A food credit line for salary earners. Shop foodstuff today, repay from your salary on
            payday. Setup takes about three minutes.
          </p>
        </div>

        <AccountForm />
      </div>
    </main>
  );
}
