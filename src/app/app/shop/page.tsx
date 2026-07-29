import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, inArray, like, or, sql } from "drizzle-orm";
import { Search, SearchX } from "lucide-react";
import { getDb } from "@/db";
import { productUnits, products } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { formatNairaWhole } from "@/lib/money";
import { Button, Card, EmptyState, PageTitle, cn } from "@/components/ui";
import { ProductImage } from "./product-image";

export const metadata: Metadata = { title: "Shop foodstuff" };

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  await requireRole("customer");
  const { q: rawQ, category: rawCategory } = await searchParams;
  const q = (rawQ ?? "").trim().slice(0, 60);
  const category = (rawCategory ?? "").trim();

  const db = getDb();

  const categoryRows = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .where(eq(products.active, true))
    .orderBy(asc(products.category));
  const categories = categoryRows.map((r) => r.category);
  const activeCategory = categories.includes(category) ? category : "";

  const conditions = [eq(products.active, true)];
  if (activeCategory) conditions.push(eq(products.category, activeCategory));
  if (q) {
    const pattern = `%${q.replace(/[%_]/g, " ")}%`;
    conditions.push(
      or(
        like(products.name, pattern),
        like(products.description, pattern),
        like(products.category, pattern)
      )!
    );
  }

  const items = await db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      imageKey: products.imageKey,
    })
    .from(products)
    .where(and(...conditions))
    .orderBy(asc(products.category), asc(products.name));

  const priceByProduct = new Map<string, number>();
  if (items.length > 0) {
    const priceRows = await db
      .select({
        productId: productUnits.productId,
        minPrice: sql<number>`min(${productUnits.priceKobo})`,
      })
      .from(productUnits)
      .where(
        and(
          eq(productUnits.active, true),
          inArray(
            productUnits.productId,
            items.map((p) => p.id)
          )
        )
      )
      .groupBy(productUnits.productId);
    for (const row of priceRows) priceByProduct.set(row.productId, row.minPrice);
  }

  const chip = (label: string, value: string) => {
    const active = value === activeCategory;
    const href = `/app/shop${buildQuery({ q, category: value })}`;
    return (
      <Link
        key={label}
        href={href}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex h-10 shrink-0 items-center rounded-full border px-4 text-[13px] font-medium whitespace-nowrap transition-colors",
          active
            ? "border-terra bg-terra-tint text-terra-deep"
            : "border-crust bg-white text-cocoa hover:border-cocoa/40"
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="animate-rise">
      <PageTitle
        title="The market"
        sub="Everyday foodstuff at partner-store prices, on your credit line."
      />

      <form action="/app/shop" method="get" role="search" className="mb-4">
        {activeCategory && <input type="hidden" name="category" value={activeCategory} />}
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-4 top-1/2 size-4.5 -translate-y-1/2 text-ash"
            aria-hidden
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Search rice, beans, oil..."
            aria-label="Search foodstuff"
            className="h-12 w-full rounded-full border border-crust bg-white pl-11 pr-4 text-[15px] text-espresso placeholder:text-ash/70 transition-shadow focus:border-terra focus:outline-none focus:ring-2 focus:ring-terra/20"
          />
        </div>
      </form>

      <div
        className="-mx-5 mb-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="navigation"
        aria-label="Categories"
      >
        {chip("All", "")}
        {categories.map((c) => chip(c, c))}
      </div>

      {items.length === 0 ? (
        <Card className="p-0">
          <EmptyState
            icon={<SearchX className="size-6" aria-hidden />}
            title={q ? `Nothing matches "${q}"` : "The shelves are being stocked"}
            body={
              q
                ? "Try a shorter word, or browse a category instead."
                : "Fresh foodstuff is on the way. Check back shortly."
            }
            action={
              (q || activeCategory) && (
                <Button href="/app/shop" variant="secondary" size="sm">
                  Show everything
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4 lg:grid-cols-4">
          {items.map((p) => {
            const fromPrice = priceByProduct.get(p.id);
            return (
              <li key={p.id}>
                <Link href={`/app/shop/${p.id}`} className="group block h-full">
                  <Card className="h-full p-3 transition-shadow group-hover:shadow-2">
                    <div className="aspect-square overflow-hidden rounded-md bg-wheat">
                      <ProductImage
                        src={p.imageKey}
                        alt={p.name}
                        className="size-full transition-transform duration-300 group-hover:scale-[1.04]"
                      />
                    </div>
                    <p className="mt-2.5 text-[11px] font-medium uppercase tracking-wide text-ash">
                      {p.category}
                    </p>
                    <h3 className="mt-0.5 text-sm font-medium leading-snug text-espresso">
                      {p.name}
                    </h3>
                    {fromPrice !== undefined && (
                      <p className="mt-1 text-sm font-semibold text-terra-deep tnum">
                        From {formatNairaWhole(fromPrice)}
                      </p>
                    )}
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function buildQuery({ q, category }: { q: string; category: string }): string {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (category) params.set("category", category);
  const s = params.toString();
  return s ? `?${s}` : "";
}
