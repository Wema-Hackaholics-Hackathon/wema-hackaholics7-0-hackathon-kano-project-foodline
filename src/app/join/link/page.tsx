import type { Metadata } from "next";
import { Ban, EyeOff, Lock } from "lucide-react";
import { getDb } from "@/db";
import { getConfig } from "@/lib/settings";
import { requireJoinPage } from "../flow";
import { JoinHeader } from "../join-ui";
import { LinkConnect } from "./link-connect";

export const metadata: Metadata = { title: "Connect your salary account" };

const ASSURANCES = [
  { icon: EyeOff, text: "Read-only. Mono shows us your statement, nothing else." },
  { icon: Lock, text: "We never see your password, PIN or card details." },
  { icon: Ban, text: "We cannot move your money. Not now, not ever." },
] as const;

export default async function LinkPage() {
  const { user, customer } = await requireJoinPage("link");
  const db = getDb();
  const config = await getConfig(db);

  return (
    <main className="flex-1 flex flex-col bg-espresso text-cream px-5 py-6">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        <JoinHeader step={3} on="dark" back="/join/profile" showSignOut />

        <div className="mt-8 animate-rise">
          <h1 className="font-display text-[28px] leading-tight text-cream">
            Connect your salary account
          </h1>
          <p className="text-sm text-cream/65 mt-2 leading-relaxed">
            We verify your salary to set your limit. Mono gives us read-only access: we never see
            your password or PIN, and we cannot move your money.
          </p>
        </div>

        <ul className="mt-6 space-y-3">
          {ASSURANCES.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-center gap-3 rounded-md border border-cream/10 bg-espresso-2 px-4 py-3"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-mango/15 text-mango">
                <Icon className="size-4" aria-hidden />
              </span>
              <p className="text-[13px] text-cream/75 leading-snug">{text}</p>
            </li>
          ))}
        </ul>

        <p className="text-xs text-cream/45 mt-4 leading-relaxed">
          Link the account your salary lands in, {user.name.split(" ")[0]}. That is the account we
          read, and later the one your repayments come from.
        </p>

        <LinkConnect
          name={user.name}
          email={user.email}
          bvn={customer.bvn}
          demoMode={config.demoMode}
        />
      </div>
    </main>
  );
}
