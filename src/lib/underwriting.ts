import { applyBps, floorToNaira } from "./money";
import { addDays, addMonthsClamped, diffDays, nextDateWithDay, todayLagos } from "./dates";
import type { LendingConfig } from "./settings";

// Deterministic salary detection over cached bank transactions. The same code
// path serves live (Mono-pulled) and demo (seeded) data, and every run's full
// working is persisted to salary_detections for the audit trail.

export type TxLike = {
  id: string;
  narration: string;
  amountKobo: number;
  type: "credit" | "debit";
  date: string; // ISO
};

export type RuleResult = { rule: string; passed: boolean; detail: string };

export type SalaryDetection = {
  eligible: boolean;
  avgAmountKobo: number | null;
  monthsFound: number;
  payDayOfMonth: number | null;
  employerGuess: string | null;
  nextPayDate: string | null;
  reasons: RuleResult[];
  evidence: {
    matchedTransactions: { id: string; date: string; amountKobo: number; narration: string }[];
    intervalsDays: number[];
    amountSpreadPct: number | null;
    candidateStreams: number;
  };
};

const STOPWORDS = new Set([
  "transfer", "trf", "from", "to", "via", "nip", "neft", "ft", "tnf", "the", "and",
  "for", "of", "ref", "reference", "credit", "payment", "pmt", "pay", "inward",
  "mobile", "app", "ussd", "web", "banking", "bank", "ltd", "limited", "plc", "nig",
]);

function narrationTokens(narration: string): Set<string> {
  return new Set(
    narration
      .toLowerCase()
      .replace(/[^a-z\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t))
  );
}

function tokenOverlap(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let common = 0;
  for (const t of a) if (b.has(t)) common++;
  return common / Math.min(a.size, b.size);
}

function median(nums: number[]): number {
  const s = [...nums].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

type Stream = { txs: TxLike[] };

/**
 * Cluster credit transactions into candidate income streams: two credits
 * belong together when their amounts are within the tolerance band of the
 * stream median OR their narrations clearly share an employer signature.
 */
function buildStreams(credits: TxLike[], tolerancePct: number): Stream[] {
  const streams: Stream[] = [];
  const sorted = [...credits].sort((a, b) => a.date.localeCompare(b.date));
  for (const tx of sorted) {
    const txTokens = narrationTokens(tx.narration);
    let placed = false;
    for (const stream of streams) {
      const med = median(stream.txs.map((t) => t.amountKobo));
      const amountClose = Math.abs(tx.amountKobo - med) / med <= tolerancePct / 100;
      const narrationClose =
        stream.txs.some((t) => tokenOverlap(narrationTokens(t.narration), txTokens) >= 0.6) &&
        Math.abs(tx.amountKobo - med) / med <= (tolerancePct * 2) / 100;
      if (amountClose || narrationClose) {
        stream.txs.push(tx);
        placed = true;
        break;
      }
    }
    if (!placed) streams.push({ txs: [tx] });
  }
  return streams;
}

/** Count consecutive months (ending at the stream's latest month) with a credit */
function consecutiveMonths(txs: TxLike[]): { count: number; monthsList: string[] } {
  const months = [...new Set(txs.map((t) => t.date.slice(0, 7)))].sort();
  if (months.length === 0) return { count: 0, monthsList: [] };
  let count = 1;
  for (let i = months.length - 1; i > 0; i--) {
    const [y1, m1] = months[i].split("-").map(Number);
    const [y0, m0] = months[i - 1].split("-").map(Number);
    if (y1 * 12 + m1 - (y0 * 12 + m0) === 1) count++;
    else break;
  }
  return { count, monthsList: months.slice(-count) };
}

function guessEmployer(txs: TxLike[]): string | null {
  const counts = new Map<string, number>();
  for (const tx of txs) {
    for (const token of narrationTokens(tx.narration)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  const frequent = [...counts.entries()]
    .filter(([, n]) => n >= Math.max(2, Math.floor(txs.length / 2)))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
  if (frequent.length === 0) return null;
  return frequent.map((t) => t[0].toUpperCase() + t.slice(1)).join(" ");
}

export function detectSalary(transactions: TxLike[], config: LendingConfig): SalaryDetection {
  const reasons: RuleResult[] = [];
  // Ignore small credits: below 40% of the salary floor nothing can qualify
  const minConsidered = Math.round(config.salaryFloorKobo * 0.4);
  const credits = transactions.filter((t) => t.type === "credit" && t.amountKobo >= minConsidered);

  const streams = buildStreams(credits, config.tolerancePct);

  // Score: recency-anchored consecutive months, then regular spacing, then size
  let best: {
    stream: Stream;
    months: number;
    intervals: number[];
    score: number;
  } | null = null;

  for (const stream of streams) {
    if (stream.txs.length < 2) continue;
    const { count } = consecutiveMonths(stream.txs);
    const dates = stream.txs.map((t) => t.date.slice(0, 10)).sort();
    const intervals: number[] = [];
    for (let i = 1; i < dates.length; i++) intervals.push(diffDays(dates[i], dates[i - 1]));
    const monthlyIntervals = intervals.filter((d) => d >= 24 && d <= 38).length;
    const spacingScore = intervals.length ? monthlyIntervals / intervals.length : 0;
    const avg = stream.txs.reduce((s, t) => s + t.amountKobo, 0) / stream.txs.length;
    const score = count * 10 + spacingScore * 5 + Math.min(avg / config.salaryFloorKobo, 3);
    if (!best || score > best.score) best = { stream, months: count, intervals, score };
  }

  if (!best) {
    reasons.push({
      rule: "recurring_stream_found",
      passed: false,
      detail: `No recurring credit stream found among ${credits.length} qualifying credits`,
    });
    return {
      eligible: false,
      avgAmountKobo: null,
      monthsFound: 0,
      payDayOfMonth: null,
      employerGuess: null,
      nextPayDate: null,
      reasons,
      evidence: {
        matchedTransactions: [],
        intervalsDays: [],
        amountSpreadPct: null,
        candidateStreams: streams.length,
      },
    };
  }

  reasons.push({
    rule: "recurring_stream_found",
    passed: true,
    detail: `Found a recurring credit stream with ${best.stream.txs.length} payments`,
  });

  const txs = best.stream.txs;
  // Average over the window the rules evaluate: the last minSalaryMonths payments
  const recent = [...txs]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, config.minSalaryMonths);
  const avgAmountKobo = Math.round(recent.reduce((s, t) => s + t.amountKobo, 0) / recent.length);

  // Rule 1: consecutive months
  const monthsOk = best.months >= config.minSalaryMonths;
  reasons.push({
    rule: "min_consecutive_months",
    passed: monthsOk,
    detail: `${best.months} consecutive month(s) with salary, need ${config.minSalaryMonths}`,
  });

  // Rule 2: amounts within tolerance band of the average
  const deviations = txs.map((t) => Math.abs(t.amountKobo - avgAmountKobo) / avgAmountKobo);
  const maxDeviationPct = Math.round(Math.max(...deviations) * 1000) / 10;
  const toleranceOk = maxDeviationPct <= config.tolerancePct;
  reasons.push({
    rule: "amounts_within_tolerance",
    passed: toleranceOk,
    detail: `Largest deviation ${maxDeviationPct}% vs allowed ±${config.tolerancePct}%`,
  });

  // Rule 3: salary floor
  const floorOk = avgAmountKobo >= config.salaryFloorKobo;
  reasons.push({
    rule: "salary_floor",
    passed: floorOk,
    detail: `Average ₦${Math.round(avgAmountKobo / 100).toLocaleString()} vs floor ₦${Math.round(config.salaryFloorKobo / 100).toLocaleString()}`,
  });

  // Rule 4: freshness: latest salary within ~45 days
  const latestDate = txs.map((t) => t.date.slice(0, 10)).sort().at(-1)!;
  const freshOk = diffDays(todayLagos(), latestDate) <= 45;
  reasons.push({
    rule: "recent_salary",
    passed: freshOk,
    detail: `Most recent salary on ${latestDate}`,
  });

  const payDayOfMonth = median(txs.map((t) => Number(t.date.slice(8, 10))));
  const nextPayDate = nextDateWithDay(todayLagos(), payDayOfMonth);
  const eligible = monthsOk && toleranceOk && floorOk && freshOk;

  return {
    eligible,
    avgAmountKobo,
    monthsFound: best.months,
    payDayOfMonth,
    employerGuess: guessEmployer(txs),
    nextPayDate,
    reasons,
    evidence: {
      matchedTransactions: txs.map((t) => ({
        id: t.id,
        date: t.date.slice(0, 10),
        amountKobo: t.amountKobo,
        narration: t.narration,
      })),
      intervalsDays: best.intervals,
      amountSpreadPct: maxDeviationPct,
      candidateStreams: streams.length,
    },
  };
}

/** Limit = limitPercent% of verified salary, clamped, floored to clean ₦1,000 */
export function computeLimit(avgSalaryKobo: number, config: LendingConfig): number {
  const raw = Math.round((avgSalaryKobo * config.limitPercent) / 100);
  const clamped = Math.min(Math.max(raw, config.minLimitKobo), config.maxLimitKobo);
  return floorToNaira(clamped, 1000);
}

export type Schedule = {
  totalRepayableKobo: number;
  marginKobo: number;
  installments: { seq: number; dueDate: string; amountKobo: number }[];
};

/**
 * Split (principal + margin) into N installments due on the customer's
 * detected pay dates. Rounding remainder lands on the first installment.
 */
export function buildSchedule(
  principalKobo: number,
  marginBps: number,
  installmentsCount: number,
  nextPayDate: string,
  payDayOfMonth: number
): Schedule {
  const marginKobo = applyBps(principalKobo, marginBps);
  const total = principalKobo + marginKobo;
  const base = Math.floor(total / installmentsCount);
  const remainder = total - base * installmentsCount;

  const installments = [];
  let due = nextPayDate;
  for (let seq = 1; seq <= installmentsCount; seq++) {
    installments.push({
      seq,
      dueDate: due,
      amountKobo: seq === 1 ? base + remainder : base,
    });
    due = nextDateWithDay(addDays(due, 20), payDayOfMonth);
  }
  return { totalRepayableKobo: total, marginKobo, installments };
}

/** Salary-signature match for the debit trigger: right amount, right window */
export function matchesSalarySignature(
  inflow: { amountKobo: number; date: string },
  customer: { salaryAmountKobo: number; nextPayDate: string },
  config: LendingConfig
): { matches: boolean; detail: string } {
  const deviation =
    Math.abs(inflow.amountKobo - customer.salaryAmountKobo) / customer.salaryAmountKobo;
  const amountOk = deviation <= config.tolerancePct / 100;
  const daysFromExpected = Math.abs(diffDays(inflow.date.slice(0, 10), customer.nextPayDate));
  const windowOk = daysFromExpected <= Math.max(config.fallbackDebitDays + 2, 5);
  const detail = `amount within ${Math.round(deviation * 1000) / 10}% (allowed ${config.tolerancePct}%), ${daysFromExpected} day(s) from expected pay date`;
  return { matches: amountOk && windowOk, detail };
}

/** The standing mandate cap: limit x multiplier, valid mandateMonths months */
export function mandateTerms(creditLimitKobo: number, config: LendingConfig) {
  const startDate = todayLagos();
  return {
    amountCapKobo: Math.round(creditLimitKobo * config.mandateCapMultiplier),
    startDate,
    endDate: addMonthsClamped(startDate, config.mandateMonths),
  };
}
