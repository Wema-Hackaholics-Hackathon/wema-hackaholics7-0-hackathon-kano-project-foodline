import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { Package, Plus, SquarePen } from "lucide-react";
import { getDb } from "@/db";
import { productUnits, products, retailers } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { priceFor } from "@/lib/catalog";
import { formatNaira } from "@/lib/money";
import { Button, Card, EmptyState, Notice, PageTitle, Pill, cn, type Tone } from "@/components/ui";
import { unitSummary, type ListingStatus } from "./shared";
import { Thumb } from "./thumb";
import { StockStepper } from "./stock-stepper";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your products" };

const FILTERS = [
  { key: "all", label: "All", status: null },
  { key: "live", label: "Live", status: "approved" },
  { key: "pending", label: "Pending review", status: "pending" },
  { key: "changes", label: "Needs changes", status: "rejected" },
  { key: "archived", label: "Archived", status: "archived" },
] as const;

type FilterKey = (typeof FILTERS)[number]["key"];

const STATUS_META: Record<ListingStatus, { tone: Tone; label: string }> = {
  approved: { tone: "good", label: "Live" },
  pending: { tone: "warn", label: "Pending review" },
  rejected: { tone: "bad", label: "Needs changes" },
  archived: { tone: "neutral", label: "Archived" },
};

const SAVED_NOTICE: Record<string, string> = {
  created:
    "Listing sent for review. The Foodline team sets the shelf price and puts it in front of customers once it is approved.",
  updated:
    "Changes saved and sent for review. The listing returns to the shop as soon as the Foodline team approves it.",
  archived: "Listing archived. Customers can no longer see it, and your past settlements are unchanged.",
};

export default async function RetailerProducts({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; saved?: string }>;
}) {
  const user = await requireRole("retailer");
  const { status, saved } = await searchParams;
  const db = getDb();

  const active: FilterKey =
    (FILTERS.find((f) => f.key === status)?.key as FilterKey | undefined) ?? "all";

  const shop = (
    await db.select().from(retailers).where(eq(retailers.id, user.id)).limit(1)
  )[0];

  const rows = await db
    .select()
    .from(products)
    .where(eq(products.retailerId, user.id))
    .orderBy(asc(products.name));

  const units = rows.length
    ? await db
        .select()
        .from(productUnits)
        .where(
          inArray(
            productUnits.productId,
            rows.map((row) => row.id)
          )
        )
        .orderBy(asc(productUnits.sortOrder))
    : [];
  const byProduct = new Map<string, typeof units>();
  for (const unit of units) {
    const list = byProduct.get(unit.productId);
    if (list) list.push(unit);
    else byProduct.set(unit.productId, [unit]);
  }

  const counts: Record<FilterKey, number> = {
    all: rows.length,
    live: 0,
    pending: 0,
    changes: 0,
    archived: 0,
  };
  for (const row of rows) {
    if (row.status === "approved") counts.live += 1;
    else if (row.status === "pending") counts.pending += 1;
    else if (row.status === "rejected") counts.changes += 1;
    else counts.archived += 1;
  }

  const wanted = FILTERS.find((f) => f.key === active)?.status ?? null;
  const shown = wanted ? rows.filter((row) => row.status === wanted) : rows;

  const savedMessage = saved ? SAVED_NOTICE[saved] : undefined;

  return (
    <div className="animate-rise space-y-5">
      <PageTitle
        title="Your products"
        sub={
          rows.length === 0
            ? "What your shop sells on Foodline."
            : `${counts.live} live, ${counts.pending} waiting on review.`
        }
        right={
          <Button href="/retailer/products/new">
            <Plus className="size-4" aria-hidden />
            Add a product
          </Button>
        }
      />

      {savedMessage && <Notice tone="good">{savedMessage}</Notice>}

      {shop && shop.status === "pending" && (
        <Notice tone="note" title="Your shop is still being reviewed">
          You can build your shelf now. Listings go live once the Foodline team approves both your
          shop and the listing itself.
        </Notice>
      )}

      {rows.length > 0 && (
        <nav aria-label="Filter your listings" className="-mx-1 overflow-x-auto px-1 pb-1">
          <ul className="flex w-max gap-2">
            {FILTERS.map((filter) => {
              const isActive = filter.key === active;
              return (
                <li key={filter.key}>
                  <Link
                    href={filter.key === "all" ? "/retailer/products" : `/retailer/products?status=${filter.key}`}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-medium transition-colors",
                      isActive
                        ? "border-terra/25 bg-terra-tint text-terra-deep"
                        : "border-crust bg-white text-cocoa hover:bg-wheat"
                    )}
                  >
                    {filter.label}
                    <span className="tnum text-[13px] text-ash">{counts[filter.key]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {shown.length === 0 ? (
        <Card className="p-0">
          {rows.length === 0 ? (
            <EmptyState
              icon={<Package className="size-6" aria-hidden />}
              title="Your shelf is empty"
              body="Add what you sell, with the amount you need to receive for each unit. The Foodline team sets the shelf price and approves the listing before customers see it."
              action={<Button href="/retailer/products/new">Add a product</Button>}
            />
          ) : (
            <EmptyState
              icon={<Package className="size-6" aria-hidden />}
              title="Nothing under this filter"
              body="You have no listings with this status right now."
              action={
                <Button href="/retailer/products" variant="secondary">
                  Show all listings
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <ul className="space-y-3">
          {shown.map((product) => {
            const list = byProduct.get(product.id) ?? [];
            const meta = STATUS_META[product.status];
            const totalStock = list.reduce((sum, unit) => sum + unit.stockQty, 0);
            const isLive = product.status === "approved";
            const showsSuggestion = product.status === "pending" || product.status === "rejected";

            return (
              <Card as="li" key={product.id}>
                <div className="flex items-start gap-3">
                  <Thumb src={product.imageKey} alt={product.name} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                      <p className="text-[15px] font-medium text-espresso">{product.name}</p>
                      <Pill tone={meta.tone}>{meta.label}</Pill>
                    </div>
                    <p className="mt-0.5 text-[13px] text-ash">{product.category}</p>
                    <p className="mt-0.5 text-[13px] text-ash">
                      {unitSummary(list)}
                      {list.length > 0 && (
                        <>
                          {", "}
                          <span className="tnum">{totalStock}</span> in stock
                        </>
                      )}
                    </p>
                  </div>
                </div>

                {product.status === "rejected" && (
                  <Notice tone="bad" title="The Foodline team asked for a change" className="mt-3">
                    <p>
                      {product.rejectionReason ??
                        "No reason was recorded. Contact the Foodline partner team and they will explain."}
                    </p>
                    <p className="mt-2">
                      <Link
                        href={`/retailer/products/${product.id}/edit`}
                        className="font-medium text-bad"
                      >
                        Edit and resubmit
                      </Link>
                    </p>
                  </Notice>
                )}

                {list.length > 0 && (
                  <ul className="mt-3 divide-y divide-crust/60 border-t border-crust/60">
                    {list.map((unit) => (
                      <li
                        key={unit.id}
                        className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-espresso">
                            {unit.unitLabel}
                            {!unit.active && (
                              <span className="ml-2 text-[13px] font-normal text-ash">
                                Not on sale
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-[13px] text-ash">
                            You receive{" "}
                            <span className="tnum text-cocoa">{formatNaira(unit.costKobo)}</span>
                          </p>
                        </div>

                        <div className="flex items-center gap-4">
                          {isLive && (
                            <div className="text-right">
                              <p className="text-[12px] text-ash">Shelf price</p>
                              <p className="tnum text-[15px] font-medium text-espresso">
                                {formatNaira(unit.priceKobo)}
                              </p>
                            </div>
                          )}
                          {showsSuggestion && (
                            <div className="text-right">
                              <p className="text-[12px] text-ash">Suggested shelf price</p>
                              <p className="tnum text-[15px] font-medium text-cocoa">
                                {formatNaira(priceFor(unit.costKobo, product.suggestedMarkupBps))}
                              </p>
                            </div>
                          )}
                          {isLive ? (
                            <StockStepper
                              unitId={unit.id}
                              label={`${product.name}, ${unit.unitLabel}`}
                              stockQty={unit.stockQty}
                            />
                          ) : (
                            <p className="tnum text-[13px] text-ash">{unit.stockQty} in stock</p>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}

                {product.status === "pending" && (
                  <p className="mt-3 text-[13px] leading-relaxed text-ash">
                    You suggested a {product.suggestedMarkupBps / 100}% markup. The Foodline team
                    sets the final shelf price when they approve this listing. What you receive does
                    not change.
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-crust/60 pt-3">
                  <Link
                    href={`/retailer/products/${product.id}/edit`}
                    className="inline-flex h-11 items-center gap-1.5 text-sm font-medium text-terra-deep hover:underline"
                  >
                    <SquarePen className="size-4" aria-hidden />
                    {product.status === "rejected"
                      ? "Edit and resubmit"
                      : product.status === "archived"
                        ? "Edit and relist"
                        : "Edit listing"}
                  </Link>
                  {isLive && (
                    <p className="text-[13px] text-ash">
                      Stock saves on its own. Price or unit changes go back for review.
                    </p>
                  )}
                </div>
              </Card>
            );
          })}
        </ul>
      )}
    </div>
  );
}
