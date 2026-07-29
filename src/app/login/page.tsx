import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDbAsync } from "@/db";
import { getConfig } from "@/lib/settings";
import { getSessionUser, HOME_PATH } from "@/lib/session";
import { SEED_LOGINS } from "@/lib/seed";
import { Logo } from "@/components/logo";
import { Card, DemoBadge } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await getSessionUser();
  if (user) redirect(HOME_PATH[user.role]);

  const { next } = await searchParams;
  const db = await getDbAsync();
  const config = await getConfig(db);

  return (
    <main className="flex-1 flex flex-col px-5 py-8 md:justify-center">
      <div className="w-full max-w-sm mx-auto animate-rise">
        <div className="mb-8 text-center">
          <Logo size="lg" href="/" />
          <p className="text-sm text-ash mt-2">Welcome back. Your foodstuff, sorted.</p>
        </div>
        <Card className="p-6">
          <LoginForm next={next} />
        </Card>
        <p className="text-center text-sm text-ash mt-6">
          New to Foodline?{" "}
          <Link href="/join" className="text-terra-deep font-medium hover:underline">
            Get your food credit line
          </Link>
        </p>

        {config.demoMode && (
          <details className="mt-8 group">
            <summary className="flex items-center justify-center gap-2 text-[13px] text-ash cursor-pointer list-none select-none hover:text-cocoa">
              <DemoBadge /> Judge access, one tap per role
            </summary>
            <Card className="mt-3 p-4 text-[13px] space-y-2.5">
              {(
                [
                  ["Customer", SEED_LOGINS.customer],
                  ["Retailer", SEED_LOGINS.retailer],
                  ["Admin", SEED_LOGINS.admin],
                ] as const
              ).map(([label, cred]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span className="font-medium text-cocoa">{label}</span>
                  <code className="text-ash text-[12px] truncate">
                    {cred.email} / {cred.password}
                  </code>
                </div>
              ))}
            </Card>
          </details>
        )}
      </div>
    </main>
  );
}
