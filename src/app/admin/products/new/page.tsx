import { getDb } from "@/db";
import { products } from "@/db/schema";
import { PageTitle } from "@/components/ui";
import { ProductForm } from "../product-form";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const db = getDb();
  const categories = [
    ...new Set((await db.select({ category: products.category }).from(products)).map((r) => r.category)),
  ].sort();

  return (
    <div className="space-y-5">
      <PageTitle title="Add product" sub="It appears in the shop as soon as you save it." />
      <ProductForm categories={categories} />
    </div>
  );
}
