// Shared types and constants for the approvals queue. Kept out of actions.ts
// because a "use server" module may only export async functions.

export type ReviewState = { error: string | null };

export const IDLE_REVIEW: ReviewState = { error: null };

/** Quick-set markups offered next to the markup field, in basis points. */
export const MARKUP_PRESETS_BPS = [500, 1000, 1500, 2000] as const;

/** A decline has to say why, so the shop owner gets a usable answer. */
export const MIN_REASON_CHARS = 5;

export const MAX_MARKUP_PCT = 200;

/** "10", "12.5" -> basis points, or null when the field is not a usable percent. */
export function parseMarkupPercent(input: string): number | null {
  const cleaned = input.replace(/[%\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const pct = parseFloat(cleaned);
  if (pct < 0 || pct > MAX_MARKUP_PCT) return null;
  return Math.round(pct * 100);
}

/** 1250 bps -> "12.5%" */
export function formatBps(bps: number): string {
  const pct = bps / 100;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(2).replace(/0$/, "")}%`;
}
