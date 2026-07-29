import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { productUnits, products } from "@/db/schema";
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

  const units = await db
    .select()
    .from(productUnits)
    .where(eq(productUnits.productId, id))
    .orderBy(asc(productUnits.sortOrder));

  const categories = [
    ...new Set((await db.select({ category: products.category }).from(products)).map((r) => r.category)),
  ].sort();

  return (
    <div className="space-y-5">
      <PageTitle
        title={product.name}
        sub={product.active ? "Live in the shop." : "Archived, hidden from shoppers."}
      />
      <ProductForm
        categories={categories}
        product={{
          id: product.id,
          name: product.name,
          description: product.description,
          category: product.category,
          imageKey: product.imageKey,
          units: units.map((u) => ({
            id: u.id,
            unitLabel: u.unitLabel,
            priceKobo: u.priceKobo,
            stockQty: u.stockQty,
            active: u.active,
          })),
        }}
      />
    </div>
  );
}
