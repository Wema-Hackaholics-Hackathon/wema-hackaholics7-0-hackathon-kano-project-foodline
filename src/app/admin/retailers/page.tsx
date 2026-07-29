import { asc } from "drizzle-orm";
import { Store } from "lucide-react";
import { getDb } from "@/db";
import { retailers } from "@/db/schema";
import { toDateOnly } from "@/lib/dates";
import { Button, Card, EmptyState, PageTitle } from "@/components/ui";
import { RetailersTable, type RetailerRow } from "./retailers-table";

export const dynamic = "force-dynamic";

export default async function RetailersPage() {
  const db = getDb();
  const rows = await db.select().from(retailers).orderBy(asc(retailers.businessName));

  const tableRows: RetailerRow[] = rows.map((r) => ({
    id: r.id,
    businessName: r.businessName,
    contactPhone: r.contactPhone,
    bankName: r.settlementBankName,
    accountNumber: r.settlementAccountNumber,
    accountName: r.settlementAccountName,
    hasRecipient: Boolean(r.paystackRecipientCode),
    active: r.active,
    isDemo: r.isDemo,
    createdAt: toDateOnly(r.createdAt),
  }));

  return (
    <div className="space-y-5">
      <PageTitle
        title="Partner stores"
        sub={`${rows.length} store${rows.length === 1 ? "" : "s"} accepting the Foodline Card.`}
        right={<Button href="/admin/retailers/new">Add retailer</Button>}
      />

      {tableRows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Store className="size-6" />}
            title="No partner stores yet"
            body="Add a store, verify the account we settle into, and they can start accepting cards the same day."
            action={<Button href="/admin/retailers/new">Add retailer</Button>}
          />
        </Card>
      ) : (
        <RetailersTable rows={tableRows} />
      )}
    </div>
  );
}
