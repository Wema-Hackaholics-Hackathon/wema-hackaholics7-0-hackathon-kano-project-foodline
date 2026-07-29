// All amounts move through the system as integer kobo.

const NGN = new Intl.NumberFormat("en-NG", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NGN_WHOLE = new Intl.NumberFormat("en-NG", {
  maximumFractionDigits: 0,
});

/** 1250000 kobo -> "₦12,500.00" */
export function formatNaira(kobo: number): string {
  return `₦${NGN.format(kobo / 100)}`;
}

/** 1250000 kobo -> "₦12,500" (for dashboards and hero figures) */
export function formatNairaWhole(kobo: number): string {
  return `₦${NGN_WHOLE.format(Math.round(kobo / 100))}`;
}

/** "12500" | "12,500.50" naira input -> kobo, or null if not a valid amount */
export function parseNairaToKobo(input: string): number | null {
  const cleaned = input.replace(/[₦,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

/** Percentage in basis points applied to a kobo amount, rounded to whole kobo */
export function applyBps(kobo: number, bps: number): number {
  return Math.round((kobo * bps) / 10_000);
}

/** Round kobo down to the nearest whole naira multiple (e.g. nearest ₦1,000) */
export function floorToNaira(kobo: number, nairaStep: number): number {
  const step = nairaStep * 100;
  return Math.floor(kobo / step) * step;
}
