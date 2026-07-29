import { and, asc, eq, like, or, type SQL } from "drizzle-orm";
import { Package } from "lucide-react";
import { getDb } from "@/db";
import { productUnits, products } from "@/db/schema";
import { Button, Card, EmptyState, PageTitle, Select, inputCls } from "@/components/ui";
import { ProductsTable, unitSummary, type ProductRow } from "./products-table";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const db = getDb();

  const filters: SQL[] = [];
  if (q) {
    const term = `%${q}%`;
    filters.push(or(like(products.name, term), like(products.category, term))!);
  }
  if (category) filters.push(eq(products.category, category));

  const rows = await db
    .select()
    .from(products)
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(asc(products.category), asc(products.name));

  const units = await db.select().from(productUnits).orderBy(asc(productUnits.sortOrder));
  const byProduct = new Map<string, typeof units>();
  for (const u of units) {
    const list = byProduct.get(u.productId);
    if (list) list.push(u);
    else byProduct.set(u.productId, [u]);
  }

  const allCategories = [
    ...new Set((await db.select({ category: products.category }).from(products)).map((r) => r.category)),
  ].sort();

  const tableRows: ProductRow[] = rows.map((p) => {
    const list = byProduct.get(p.id) ?? [];
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      imageKey: p.imageKey,
      active: p.active,
      unitSummary: unitSummary(list),
      totalStock: list.reduce((s, u) => s + u.stockQty, 0),
    };
  });

  const filtered = Boolean(q || category);

  return (
    <div className="space-y-5">
      <PageTitle
        title="Catalog"
        sub={`${rows.length} product${rows.length === 1 ? "" : "s"} priced in real market units.`}
        right={<Button href="/admin/products/new">Add product</Button>}
      />

      <Card className="p-4">
        <form method="GET" className="flex flex-wrap gap-2 items-end">
          <label className="flex-1 min-w-45">
            <span className="block text-sm font-medium text-cocoa mb-1.5">Search</span>
            <input
              name="q"
              defaultValue={q ?? ""}
              placeholder="Rice, oil, beans"
              className={inputCls}
            />
          </label>
          <label className="min-w-45">
            <span className="block text-sm font-medium text-cocoa mb-1.5">Category</span>
            <Select name="category" defaultValue={category ?? ""}>
              <option value="">All categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
          </label>
          <Button type="submit" className="h-12">
            Filter
          </Button>
          {filtered && (
            <Button href="/admin/products" variant="secondary" className="h-12">
              Clear
            </Button>
          )}
        </form>
      </Card>

      {tableRows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package className="size-6" />}
            title={filtered ? "No products match that search" : "No products yet"}
            body={
              filtered
                ? "Try a different word, or clear the filter to see the whole catalog."
                : "Add your first product and the shop opens for customers straight away."
            }
            action={
              filtered ? (
                <Button href="/admin/products" variant="secondary">
                  Clear filter
                </Button>
              ) : (
                <Button href="/admin/products/new">Add product</Button>
              )
            }
          />
        </Card>
      ) : (
        <ProductsTable rows={tableRows} />
      )}
    </div>
  );
}
