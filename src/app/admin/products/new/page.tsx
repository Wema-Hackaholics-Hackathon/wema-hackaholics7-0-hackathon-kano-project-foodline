import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { products, retailers } from "@/db/schema";
import { Notice, PageTitle } from "@/components/ui";
import { ProductForm } from "../product-form";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const db = getDb();

  const [categoryRows, shops] = await Promise.all([
    db.select({ category: products.category }).from(products),
    db
      .select({ id: retailers.id, businessName: retailers.businessName })
      .from(retailers)
      .where(and(eq(retailers.status, "approved"), eq(retailers.active, true)))
      .orderBy(asc(retailers.businessName)),
  ]);

  const categories = [...new Set(categoryRows.map((r) => r.category))].sort();

  return (
    <div className="space-y-5">
      <PageTitle
        title="Add product"
        sub="Pick the shop that stocks it, set what the shop receives and the Foodline markup. It goes on the shelf as soon as you save."
      />
      {shops.length === 0 && (
        <Notice tone="note">
          No partner shop is approved yet, so this product will sit in the Foodline catalog with no
          shop attached. Approve a shop first if a customer needs somewhere to collect it.
        </Notice>
      )}
      <ProductForm categories={categories} shops={shops} />
    </div>
  );
}
