"use server";

// Checkout preparation and confirmation. The client basket (localStorage) is
// never trusted: prepareCheckout returns the server truth for every line and
// computes the repayment schedules; confirmOrder re-validates everything again
// inside placeOrder before any money moves.

import { revalidatePath } from "next/cache";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, mandates, productUnits, products } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { availableCreditKobo } from "@/lib/debit-engine";
import { getConfig } from "@/lib/settings";
import { buildSchedule } from "@/lib/underwriting";
import { placeOrder, type CheckoutResult } from "@/lib/checkout";

export type RawLine = { productUnitId: string; qty: number };

export type QuoteLine = {
  productUnitId: string;
  productName: string;
  unitLabel: string;
  priceKobo: number;
  qty: number;
  lineTotalKobo: number;
};

export type PlanQuote = {
  installments: number;
  marginBps: number;
  marginKobo: number;
  totalRepayableKobo: number;
  schedule: { seq: number; dueDate: string; amountKobo: number }[];
  /** false when this plan's total would push exposure past the mandate cap */
  withinMandateCap: boolean;
};

export type CheckoutPrep =
  | {
      ok: true;
      lines: QuoteLine[];
      /** names of basket items that are sold out or retired since adding */
      removed: string[];
      /** true when a quantity was reduced to match live stock */
      adjusted: boolean;
      subtotalKobo: number;
      availableKobo: number;
      limitKobo: number;
      plans: PlanQuote[];
    }
  | { ok: false; error: string };

function sanitize(lines: RawLine[]): RawLine[] {
  return lines
    .filter((l) => typeof l.productUnitId === "string" && Number.isFinite(l.qty))
    .slice(0, 50)
    .map((l) => ({
      productUnitId: l.productUnitId,
      qty: Math.max(1, Math.min(50, Math.round(l.qty))),
    }));
}

export async function prepareCheckout(rawLines: RawLine[]): Promise<CheckoutPrep> {
  const user = await getSessionUser();
  if (!user || user.role !== "customer") {
    return { ok: false, error: "Your session has ended. Sign in again to continue." };
  }

  const db = getDb();
  const customer = (
    await db.select().from(customers).where(eq(customers.id, user.id)).limit(1)
  )[0];
  if (!customer || customer.stage !== "active") {
    return { ok: false, error: "Finish setting up your credit line before shopping." };
  }
  if (!customer.nextPayDate || !customer.salaryDayOfMonth) {
    return {
      ok: false,
      error:
        "We are missing your verified salary dates, so we cannot plan your repayments. Contact support and we will sort it out.",
    };
  }

  const mandate = (
    await db
      .select()
      .from(mandates)
      .where(and(eq(mandates.customerId, user.id), eq(mandates.status, "approved")))
      .limit(1)
  )[0];
  if (!mandate) {
    return {
      ok: false,
      error: "Your repayment mandate is not active, so we cannot open a new plan. Contact support.",
    };
  }

  const clean = sanitize(rawLines);
  if (clean.length === 0) return { ok: false, error: "Your basket is empty." };

  const rows = await db
    .select({ unit: productUnits, product: products })
    .from(productUnits)
    .innerJoin(products, eq(productUnits.productId, products.id))
    .where(
      inArray(
        productUnits.id,
        clean.map((l) => l.productUnitId)
      )
    );
  const byId = new Map(rows.map((r) => [r.unit.id, r]));

  const lines: QuoteLine[] = [];
  const removed: string[] = [];
  let adjusted = false;
  for (const l of clean) {
    const row = byId.get(l.productUnitId);
    if (!row || !row.unit.active || !row.product.active || row.unit.stockQty === 0) {
      removed.push(row ? `${row.product.name} (${row.unit.unitLabel})` : "An item");
      continue;
    }
    const qty = Math.min(l.qty, row.unit.stockQty);
    if (qty < l.qty) adjusted = true;
    lines.push({
      productUnitId: row.unit.id,
      productName: row.product.name,
      unitLabel: row.unit.unitLabel,
      priceKobo: row.unit.priceKobo,
      qty,
      lineTotalKobo: row.unit.priceKobo * qty,
    });
  }
  if (lines.length === 0) {
    return {
      ok: false,
      error: "Nothing in your basket is still available. Head back to the market and restock.",
    };
  }

  const subtotalKobo = lines.reduce((s, l) => s + l.lineTotalKobo, 0);
  const config = await getConfig(db);
  const availableKobo = await availableCreditKobo(db, user.id);

  const plans: PlanQuote[] = config.installmentPlans.map((p) => {
    const schedule = buildSchedule(
      subtotalKobo,
      p.marginBps,
      p.installments,
      customer.nextPayDate!,
      customer.salaryDayOfMonth!
    );
    // Mirror placeOrder's cap check so a doomed plan is disabled up front
    const exposureAfter =
      customer.creditLimitKobo - availableKobo + schedule.totalRepayableKobo;
    return {
      installments: p.installments,
      marginBps: p.marginBps,
      marginKobo: schedule.marginKobo,
      totalRepayableKobo: schedule.totalRepayableKobo,
      schedule: schedule.installments,
      withinMandateCap: exposureAfter <= mandate.amountCapKobo,
    };
  });

  return {
    ok: true,
    lines,
    removed,
    adjusted,
    subtotalKobo,
    availableKobo,
    limitKobo: customer.creditLimitKobo,
    plans,
  };
}

export async function confirmOrder(
  rawLines: RawLine[],
  installmentsCount: number
): Promise<CheckoutResult> {
  const user = await getSessionUser();
  if (!user || user.role !== "customer") {
    return { ok: false, error: "Your session has ended. Sign in again to continue." };
  }
  const db = getDb();
  const result = await placeOrder(db, user.id, sanitize(rawLines), installmentsCount);
  if (result.ok) {
    revalidatePath("/app");
    revalidatePath("/app/shop");
    revalidatePath("/app/cards");
    revalidatePath("/app/repayments");
  }
  return result;
}
