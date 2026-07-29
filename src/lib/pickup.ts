import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { customers, retailers } from "@/db/schema";
import { geocodeAddress, formatDistance, rankByDistance, type Point } from "./geo";

// Recommending a pickup store. Coordinates are resolved once and cached on the
// row, so the checkout screen is a plain database read on every later visit
// and never blocks on Google.

export type StoreSuggestion = {
  id: string;
  businessName: string;
  address: string | null;
  area: string | null;
  distanceKm: number | null;
  distanceLabel: string | null;
  isDemo: boolean;
};

/** Resolve and cache a customer's home coordinates. Returns null if unknown. */
export async function ensureCustomerPoint(
  db: Db,
  customerId: string
): Promise<{ point: Point | null; label: string | null }> {
  const row = (
    await db
      .select({
        lat: customers.lat,
        lng: customers.lng,
        geoLabel: customers.geoLabel,
        address: customers.address,
      })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1)
  )[0];
  if (!row) return { point: null, label: null };
  if (row.lat != null && row.lng != null) {
    return { point: { lat: row.lat, lng: row.lng }, label: row.geoLabel };
  }
  if (!row.address) return { point: null, label: null };

  const geo = await geocodeAddress(row.address);
  if (!geo) return { point: null, label: null };
  await db
    .update(customers)
    .set({
      lat: geo.lat,
      lng: geo.lng,
      geoLabel: geo.label,
      state: geo.state,
      lga: geo.lga,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));
  return { point: { lat: geo.lat, lng: geo.lng }, label: geo.label };
}

/** Resolve and cache a retailer's coordinates. */
export async function ensureRetailerPoint(db: Db, retailerId: string): Promise<void> {
  const row = (
    await db
      .select({ lat: retailers.lat, address: retailers.address })
      .from(retailers)
      .where(eq(retailers.id, retailerId))
      .limit(1)
  )[0];
  if (!row || row.lat != null || !row.address) return;
  const geo = await geocodeAddress(row.address);
  if (!geo) return;
  await db
    .update(retailers)
    .set({ lat: geo.lat, lng: geo.lng, geoLabel: geo.label, state: geo.state, lga: geo.lga })
    .where(eq(retailers.id, retailerId));
}

/**
 * Active stores ranked nearest first. Stores without coordinates still
 * appear, just last, so the customer always has somewhere to collect.
 */
export async function suggestPickupStores(
  db: Db,
  customerId: string
): Promise<{ stores: StoreSuggestion[]; fromLabel: string | null }> {
  const { point, label } = await ensureCustomerPoint(db, customerId);
  const active = await db.select().from(retailers).where(eq(retailers.active, true));

  const ranked = rankByDistance(active, point);
  return {
    fromLabel: label,
    stores: ranked.map(({ store, distanceKm }) => ({
      id: store.id,
      businessName: store.businessName,
      address: store.address,
      area: store.geoLabel,
      distanceKm,
      distanceLabel: distanceKm == null ? null : formatDistance(distanceKm),
      isDemo: store.isDemo,
    })),
  };
}
