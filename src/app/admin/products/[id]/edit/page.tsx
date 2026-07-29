import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { productUnits, products, retailers } from "@/db/schema";
import { PageTitle } from "@/components/ui";
import { ProductForm } from "../../product-form";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = getDb();

  const product = (await db.select().from(products).where(eq(products.id, id)).limit(1))[0];
  if (!product) notFound();

  const [units, categoryRows, shops] = await Promise.all([
    db
      .select()
      .from(productUnits)
      .where(eq(productUnits.productId, id))
      .orderBy(asc(productUnits.sortOrder)),
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
        title={product.name}
        sub={product.active ? "Live in the shop." : "Archived, hidden from shoppers."}
      />
      <ProductForm
        categories={categories}
        shops={shops}
        product={{
          id: product.id,
          name: product.name,
          description: product.description,
          category: product.category,
          imageKey: product.imageKey,
          retailerId: product.retailerId,
          markupBps: product.markupBps,
          suggestedMarkupBps: product.suggestedMarkupBps,
          status: product.status,
          units: units.map((u) => ({
            id: u.id,
            unitLabel: u.unitLabel,
            priceKobo: u.priceKobo,
            costKobo: u.costKobo,
            stockQty: u.stockQty,
            active: u.active,
          })),
        }}
      />
    </div>
  );
}
