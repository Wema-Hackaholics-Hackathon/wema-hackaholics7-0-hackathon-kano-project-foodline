import { and, asc, eq, inArray, like, or, sql, type SQL } from "drizzle-orm";
import type { Db } from "@/db";
import { productUnits, products, retailers } from "@/db/schema";
import { rankByDistance, formatDistance, type Point } from "./geo";

// The catalog is per shop. A retailer lists a product at the price they need
// (cost) with a suggested markup; an admin sets the final markup and approves
// it. Customers only ever see cost + markup as one price.

/** Customer-facing price from the retailer's cost and the admin's markup. */
export function applyMarkup(costKobo: number, markupBps: number): number {
  return Math.round(costKobo * (1 + markupBps / 10_000));
}

/** Round a computed price up to a clean ₦10 so shelves look priced, not calculated. */
export function tidyPrice(kobo: number): number {
  const step = 1000; // ₦10 in kobo
  return Math.ceil(kobo / step) * step;
}

export function priceFor(costKobo: number, markupBps: number): number {
  return tidyPrice(applyMarkup(costKobo, markupBps));
}

/** Markup actually realised on a unit, in basis points. */
export function realisedMarkupBps(costKobo: number, priceKobo: number): number {
  if (costKobo <= 0) return 0;
  return Math.round(((priceKobo - costKobo) / costKobo) * 10_000);
}

// ---------------------------------------------------------------------------
// Areas and stores
// ---------------------------------------------------------------------------

export type Area = { state: string; lgas: string[] };

/** States and LGAs that actually have a live partner store. */
export async function listAreas(db: Db): Promise<Area[]> {
  const rows = await db
    .selectDistinct({ state: retailers.state, lga: retailers.lga })
    .from(retailers)
    .where(and(eq(retailers.status, "approved"), eq(retailers.active, true)));

  const byState = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.state) continue;
    const set = byState.get(row.state) ?? new Set<string>();
    if (row.lga) set.add(row.lga);
    byState.set(row.state, set);
  }
  return [...byState.entries()]
    .map(([state, lgas]) => ({ state, lgas: [...lgas].sort() }))
    .sort((a, b) => a.state.localeCompare(b.state));
}

export type StoreCard = {
  id: string;
  businessName: string;
  address: string | null;
  state: string | null;
  lga: string | null;
  geoLabel: string | null;
  distanceKm: number | null;
  distanceLabel: string | null;
  productCount: number;
  isDemo: boolean;
};

/** Live stores, optionally narrowed to an area, nearest first. */
export async function listStores(
  db: Db,
  opts: { state?: string | null; lga?: string | null; from?: Point | null } = {}
): Promise<StoreCard[]> {
  const filters: SQL[] = [eq(retailers.status, "approved"), eq(retailers.active, true)];
  if (opts.state) filters.push(eq(retailers.state, opts.state));
  if (opts.lga) filters.push(eq(retailers.lga, opts.lga));

  const rows = await db
    .select()
    .from(retailers)
    .where(and(...filters))
    .orderBy(asc(retailers.businessName));

  const counts = rows.length
    ? await db
        .select({ retailerId: products.retailerId, n: sql<number>`count(*)` })
        .from(products)
        .where(
          and(
            inArray(
              products.retailerId,
              rows.map((r) => r.id)
            ),
            eq(products.status, "approved"),
            eq(products.active, true)
          )
        )
        .groupBy(products.retailerId)
    : [];
  const countBy = new Map(counts.map((c) => [c.retailerId, Number(c.n)]));

  return rankByDistance(rows, opts.from ?? null).map(({ store, distanceKm }) => ({
    id: store.id,
    businessName: store.businessName,
    address: store.address,
    state: store.state,
    lga: store.lga,
    geoLabel: store.geoLabel,
    distanceKm,
    distanceLabel: distanceKm == null ? null : formatDistance(distanceKm),
    productCount: countBy.get(store.id) ?? 0,
    isDemo: store.isDemo,
  }));
}

// ---------------------------------------------------------------------------
// A single store's shelf
// ---------------------------------------------------------------------------

export type ShelfUnit = {
  id: string;
  unitLabel: string;
  priceKobo: number;
  stockQty: number;
};

export type ShelfProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  imageKey: string | null;
  units: ShelfUnit[];
  fromKobo: number;
};

/** Approved, in-stock listings for one store. Costs and markups never leave here. */
export async function listShelf(
  db: Db,
  retailerId: string,
  opts: { q?: string | null; category?: string | null } = {}
): Promise<{ items: ShelfProduct[]; categories: string[] }> {
  const filters: SQL[] = [
    eq(products.retailerId, retailerId),
    eq(products.status, "approved"),
    eq(products.active, true),
  ];
  if (opts.q) {
    const term = `%${opts.q}%`;
    filters.push(or(like(products.name, term), like(products.category, term))!);
  }
  if (opts.category) filters.push(eq(products.category, opts.category));

  const rows = await db
    .select()
    .from(products)
    .where(and(...filters))
    .orderBy(asc(products.category), asc(products.name));

  const allCategories = [
    ...new Set(
      (
        await db
          .select({ category: products.category })
          .from(products)
          .where(
            and(
              eq(products.retailerId, retailerId),
              eq(products.status, "approved"),
              eq(products.active, true)
            )
          )
      ).map((r) => r.category)
    ),
  ].sort();

  if (rows.length === 0) return { items: [], categories: allCategories };

  const units = await db
    .select()
    .from(productUnits)
    .where(
      and(
        inArray(
          productUnits.productId,
          rows.map((r) => r.id)
        ),
        eq(productUnits.active, true)
      )
    )
    .orderBy(asc(productUnits.sortOrder));

  const byProduct = new Map<string, typeof units>();
  for (const unit of units) {
    const list = byProduct.get(unit.productId);
    if (list) list.push(unit);
    else byProduct.set(unit.productId, [unit]);
  }

  const items: ShelfProduct[] = [];
  for (const row of rows) {
    const list = byProduct.get(row.id) ?? [];
    if (list.length === 0) continue;
    items.push({
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      imageKey: row.imageKey,
      units: list.map((u) => ({
        id: u.id,
        unitLabel: u.unitLabel,
        priceKobo: u.priceKobo,
        stockQty: u.stockQty,
      })),
      fromKobo: Math.min(...list.map((u) => u.priceKobo)),
    });
  }
  return { items, categories: allCategories };
}

/** Which store owns these units? Used to keep a basket to a single shop. */
export async function retailerForUnits(
  db: Db,
  unitIds: string[]
): Promise<{ retailerId: string | null; mixed: boolean }> {
  if (unitIds.length === 0) return { retailerId: null, mixed: false };
  const rows = await db
    .select({ retailerId: products.retailerId })
    .from(productUnits)
    .innerJoin(products, eq(productUnits.productId, products.id))
    .where(inArray(productUnits.id, unitIds));
  const ids = [...new Set(rows.map((r) => r.retailerId).filter(Boolean))] as string[];
  return { retailerId: ids[0] ?? null, mixed: ids.length > 1 };
}
