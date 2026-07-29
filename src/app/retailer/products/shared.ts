// Shared types and pure helpers for the retailer catalog screens.
// Kept out of actions.ts because a "use server" file may only export async
// functions, and out of the client form's import graph of @/lib/catalog,
// which reaches Cloudflare bindings through @/lib/geo.

export type ListingState = { errors: Record<string, string> };

export type ListingStatus = "pending" | "approved" | "rejected" | "archived";

export type UnitInput = {
  id: string;
  unitLabel: string;
  /** What this shop is paid for the unit. Theirs to see, never a customer's. */
  costKobo: number;
  /** Customer-facing shelf price, set by Foodline on approval. */
  priceKobo: number;
  stockQty: number;
  active: boolean;
};

export type ListingInput = {
  id: string;
  name: string;
  description: string;
  category: string;
  imageKey: string | null;
  status: ListingStatus;
  suggestedMarkupBps: number;
  rejectionReason: string | null;
  units: UnitInput[];
};

export const DEFAULT_MARKUP_PERCENT = 10;

/**
 * Live client-side echo of priceFor() in @/lib/catalog, for the preview under
 * each unit row while the retailer types. Every stored price is written by the
 * server with the real helper, so this only ever shows an estimate.
 */
export function previewShelfPrice(costKobo: number, markupBps: number): number {
  const withMarkup = Math.round(costKobo * (1 + markupBps / 10_000));
  const step = 1000; // prices tidy up to a clean ₦10
  return Math.ceil(withMarkup / step) * step;
}

/** "1 mudu, 50kg bag" or "1 mudu and 3 more" for a compact card header. */
export function unitSummary(units: { unitLabel: string }[]): string {
  if (units.length === 0) return "No units yet";
  if (units.length === 1) return units[0].unitLabel;
  if (units.length === 2) return `${units[0].unitLabel}, ${units[1].unitLabel}`;
  return `${units[0].unitLabel} and ${units.length - 1} more`;
}

/** 280000 kobo -> "2800", 280050 kobo -> "2800.50", for editable inputs. */
export function koboToInput(kobo: number): string {
  return kobo % 100 === 0 ? String(Math.round(kobo / 100)) : (kobo / 100).toFixed(2);
}
