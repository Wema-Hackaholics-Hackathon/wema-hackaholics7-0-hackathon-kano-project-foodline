import { Notice, PageTitle } from "@/components/ui";
import { loadBanks } from "../actions";
import { RetailerForm } from "../retailer-form";

export const dynamic = "force-dynamic";

export default async function NewRetailerPage() {
  const banks = await loadBanks();
  return (
    <div className="space-y-5">
      <PageTitle
        title="Add retailer"
        sub="Onboard a partner store and link the account we settle into."
      />
      {banks.length === 0 && (
        <Notice tone="warn">
          The bank list could not be loaded from Paystack. Check the API key and refresh before
          adding a retailer.
        </Notice>
      )}
      <RetailerForm banks={banks} />
    </div>
  );
}
