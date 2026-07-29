// Date helpers. Business dates (pay dates, due dates) are YYYY-MM-DD strings
// interpreted in Africa/Lagos time.

const LAGOS_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Africa/Lagos",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Current date in Lagos as YYYY-MM-DD */
export function todayLagos(): string {
  return LAGOS_FMT.format(new Date());
}

export function toDateOnly(d: Date): string {
  return LAGOS_FMT.format(d);
}

/** Days in a given month (month is 1-12) */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Add months to a YYYY-MM-DD, clamping the day to the target month length */
export function addMonthsClamped(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const total = y * 12 + (m - 1) + months;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  const nd = Math.min(d, daysInMonth(ny, nm));
  return `${ny}-${String(nm).padStart(2, "0")}-${String(nd).padStart(2, "0")}`;
}

export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Difference a - b in whole days */
export function diffDays(a: string, b: string): number {
  const ta = Date.parse(`${a}T00:00:00Z`);
  const tb = Date.parse(`${b}T00:00:00Z`);
  return Math.round((ta - tb) / 86_400_000);
}

/** "2026-08-28" -> "28 Aug 2026" */
export function formatDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** "2026-08-28" -> "28 Aug" */
export function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-NG", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-NG", {
    timeZone: "Africa/Lagos",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Next date with the given day-of-month strictly after `after`,
 * clamped for short months (salary paid on the 31st pays on the 30th in Sept).
 */
export function nextDateWithDay(after: string, dayOfMonth: number): string {
  const [y, m] = after.split("-").map(Number);
  const candidateThisMonth = `${y}-${String(m).padStart(2, "0")}-${String(
    Math.min(dayOfMonth, daysInMonth(y, m))
  ).padStart(2, "0")}`;
  if (diffDays(candidateThisMonth, after) > 0) return candidateThisMonth;
  const nm = m === 12 ? 1 : m + 1;
  const ny = m === 12 ? y + 1 : y;
  return `${ny}-${String(nm).padStart(2, "0")}-${String(
    Math.min(dayOfMonth, daysInMonth(ny, nm))
  ).padStart(2, "0")}`;
}
