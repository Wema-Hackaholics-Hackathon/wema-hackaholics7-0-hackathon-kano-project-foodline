import { getDb } from "@/db";
import { getConfig } from "@/lib/settings";
import { PageTitle } from "@/components/ui";
import { LendingForm } from "./lending-form";

export const dynamic = "force-dynamic";

export default async function LendingConfigPage() {
  const db = getDb();
  const config = await getConfig(db);
  return (
    <div className="space-y-5">
      <PageTitle
        title="Lending configuration"
        sub="The rules the underwriting and collections engine follows. Every change is recorded in the ledger."
      />
      <LendingForm config={config} />
    </div>
  );
}
