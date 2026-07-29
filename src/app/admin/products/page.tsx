import Link from "next/link";
import { and, asc, eq, isNull, like, or, type SQL } from "drizzle-orm";
import { Package } from "lucide-react";
import { getDb } from "@/db";
import { productUnits, products, retailers } from "@/db/schema";
import { Button, Card, EmptyState, PageTitle, Select, inputCls } from "@/components/ui";
import { ProductsTable, unitSummary, type ProductRow } from "./products-table";

export const dynamic = "force-dynamic";

const FOODLINE = "foodline";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; shop?: string }>;
}) {
  const { q, category, shop } = await searchParams;
  const db = getDb();

  const filters: SQL[] = [];
  if (q) {
    const term = `%${q}%`;
    filters.push(or(like(products.name, term), like(products.category, term))!);
  }
  if (category) filters.push(eq(products.category, category));
  if (shop === FOODLINE) filters.push(isNull(products.retailerId));
  else if (shop) filters.push(eq(products.retailerId, shop));

  const rows = await db
    .select({ product: products, shopName: retailers.businessName })
    .from(products)
    .leftJoin(retailers, eq(products.retailerId, retailers.id))
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

  const allShops = await db
    .select({ id: retailers.id, businessName: retailers.businessName })
    .from(retailers)
    .orderBy(asc(retailers.businessName));

  const tableRows: ProductRow[] = rows.map(({ product: p, shopName }) => {
    const list = byProduct.get(p.id) ?? [];
    return {
      id: p.id,
      name: p.name,
      category: p.category,
      imageKey: p.imageKey,
      shopName: shopName ?? "Foodline catalog",
      status: p.status,
      markupBps: p.markupBps,
      active: p.active,
      unitSummary: unitSummary(list),
      totalStock: list.reduce((s, u) => s + u.stockQty, 0),
    };
  });

  const pendingCount = tableRows.filter((r) => r.status === "pending").length;
  const filtered = Boolean(q || category || shop);

  return (
    <div className="space-y-5">
      <PageTitle
        title="Catalog"
        sub={`${rows.length} listing${
          rows.length === 1 ? "" : "s"
        } across partner shops, priced in real market units.`}
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
          <label className="min-w-45">
            <span className="block text-sm font-medium text-cocoa mb-1.5">Shop</span>
            <Select name="shop" defaultValue={shop ?? ""}>
              <option value="">All shops</option>
              <option value={FOODLINE}>Foodline catalog</option>
              {allShops.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.businessName}
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

      {pendingCount > 0 && (
        <p className="text-[13px] text-ash">
          {pendingCount} listing{pendingCount === 1 ? " is" : "s are"} still waiting on a markup
          decision.{" "}
          <Link href="/admin/approvals?tab=listings" className="text-terra-deep hover:underline">
            Open Approvals
          </Link>
          .
        </p>
      )}

      {tableRows.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package className="size-6" />}
            title={filtered ? "No products match that search" : "No products yet"}
            body={
              filtered
                ? "Try a different word, or clear the filter to see the whole catalog."
                : "Add a product for a partner shop, or wait for a shop to send its first listing in."
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
