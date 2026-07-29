import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { mandates } from "@/db/schema";
import { getConfig } from "@/lib/settings";
import { mandateTerms } from "@/lib/underwriting";
import type { TransferDestination } from "@/lib/mono";
import { requireJoinPage } from "../flow";
import { JoinHeader } from "../join-ui";
import { MandateFlow, type ExistingMandate } from "./mandate-flow";

export const metadata: Metadata = { title: "Authorise your repayment mandate" };

export default async function MandatePage() {
  const { customer } = await requireJoinPage("mandate");
  const db = getDb();
  const config = await getConfig(db);
  const terms = mandateTerms(customer.creditLimitKobo, config);

  // A mandate may already be mid-authorization (page refresh, return visit)
  const latest =
    (
      await db
        .select()
        .from(mandates)
        .where(eq(mandates.customerId, customer.id))
        .orderBy(desc(mandates.createdAt))
        .limit(1)
    )[0] ?? null;

  const existing: ExistingMandate | null = latest
    ? {
        status: latest.status,
        readyToDebit: latest.readyToDebit,
        createdAtMs: latest.createdAt.getTime(),
        destinations: (latest.transferDestinations as TransferDestination[] | null) ?? null,
      }
    : null;

  return (
    <main className="flex-1 flex flex-col bg-espresso text-cream px-5 py-6">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        <JoinHeader step={5} on="dark" back="/join/limit" showSignOut />

        <div className="mt-8 animate-rise">
          <h1 className="font-display text-[28px] leading-tight text-cream">
            Authorise your repayment mandate
          </h1>
          <p className="text-sm text-cream/65 mt-2 leading-relaxed">
            One authorisation covers every purchase on your Foodline. Your bank holds the mandate,
            and you stay in control.
          </p>
        </div>

        <MandateFlow
          isDemo={customer.isDemo}
          bankName={customer.bankName ?? "your bank"}
          last4={(latest?.accountNumber ?? customer.accountNumber ?? "").slice(-4)}
          capKobo={latest?.amountCapKobo ?? terms.amountCapKobo}
          months={config.mandateMonths}
          endDate={latest?.endDate ?? terms.endDate}
          existing={existing}
        />
      </div>
    </main>
  );
}
