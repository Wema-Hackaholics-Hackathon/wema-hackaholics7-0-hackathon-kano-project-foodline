import { and, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import {
  customers,
  installments as installmentsTable,
  loans,
  mandates,
  orderItems,
  orders,
  productUnits,
  products,
} from "@/db/schema";
import { uid, voucherCode, randomToken } from "./ids";
import { formatNaira } from "./money";
import { logEvent } from "./ledger";
import { getConfig } from "./settings";
import { buildSchedule } from "./underwriting";
import { availableCreditKobo } from "./debit-engine";

export type CartLine = { productUnitId: string; qty: number };

export type CheckoutResult =
  | { ok: true; orderId: string; voucherCode: string }
  | { ok: false; error: string };

export async function placeOrder(
  db: Db,
  customerId: string,
  lines: CartLine[],
  installmentsCount: number
): Promise<CheckoutResult> {
  if (lines.length === 0) return { ok: false, error: "Your basket is empty." };
  const config = await getConfig(db);

  const plan = config.installmentPlans.find((p) => p.installments === installmentsCount);
  if (!plan) return { ok: false, error: "That repayment plan is not available." };

  const customer = (
    await db.select().from(customers).where(eq(customers.id, customerId)).limit(1)
  )[0];
  if (!customer) return { ok: false, error: "Customer not found." };
  if (customer.stage !== "active") {
    return { ok: false, error: "Finish setting up your credit line before shopping." };
  }
  if (!customer.nextPayDate || !customer.salaryDayOfMonth) {
    return { ok: false, error: "Salary details missing. Contact support." };
  }

  const mandate = (
    await db
      .select()
      .from(mandates)
      .where(and(eq(mandates.customerId, customerId), eq(mandates.status, "approved")))
      .limit(1)
  )[0];
  if (!mandate) {
    return { ok: false, error: "Your repayment mandate is not active. Contact support." };
  }

  const unitIds = lines.map((l) => l.productUnitId);
  const unitRows = await db
    .select({ unit: productUnits, product: products })
    .from(productUnits)
    .innerJoin(products, eq(productUnits.productId, products.id))
    .where(inArray(productUnits.id, unitIds));

  const byId = new Map(unitRows.map((r) => [r.unit.id, r]));
  let totalKobo = 0;
  for (const line of lines) {
    const row = byId.get(line.productUnitId);
    if (!row || !row.unit.active || !row.product.active) {
      return { ok: false, error: "An item in your basket is no longer available." };
    }
    if (line.qty < 1 || line.qty > 50) return { ok: false, error: "Invalid quantity." };
    if (row.unit.stockQty < line.qty) {
      return {
        ok: false,
        error: `Only ${row.unit.stockQty} of ${row.product.name} (${row.unit.unitLabel}) left in stock.`,
      };
    }
    totalKobo += row.unit.priceKobo * line.qty;
  }

  const available = await availableCreditKobo(db, customerId);
  if (totalKobo > available) {
    return {
      ok: false,
      error: `This order (${formatNaira(totalKobo)}) is above your available credit of ${formatNaira(available)}.`,
    };
  }

  const schedule = buildSchedule(
    totalKobo,
    plan.marginBps,
    installmentsCount,
    customer.nextPayDate,
    customer.salaryDayOfMonth
  );
  // The standing mandate must cover existing exposure + this order's repayment
  const exposureAfter = customer.creditLimitKobo - available + schedule.totalRepayableKobo;
  if (exposureAfter > mandate.amountCapKobo) {
    return {
      ok: false,
      error: "This order would exceed your mandate cap. Try fewer installments or a smaller basket.",
    };
  }

  const now = new Date();
  const orderId = uid();
  const code = voucherCode();
  const qrToken = randomToken(24);

  await db.insert(orders).values({
    id: orderId,
    customerId,
    status: "issued",
    totalKobo,
    voucherCode: code,
    qrToken,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + config.cardExpiryHours * 3_600_000),
  });

  for (const line of lines) {
    const row = byId.get(line.productUnitId)!;
    await db.insert(orderItems).values({
      id: uid(),
      orderId,
      productId: row.product.id,
      productUnitId: row.unit.id,
      productName: row.product.name,
      unitLabel: row.unit.unitLabel,
      unitPriceKobo: row.unit.priceKobo,
      qty: line.qty,
      lineTotalKobo: row.unit.priceKobo * line.qty,
    });
    await db
      .update(productUnits)
      .set({ stockQty: row.unit.stockQty - line.qty })
      .where(eq(productUnits.id, row.unit.id));
  }

  const loanId = uid();
  await db.insert(loans).values({
    id: loanId,
    customerId,
    orderId,
    mandateId: mandate.id,
    principalKobo: totalKobo,
    marginBps: plan.marginBps,
    totalRepayableKobo: schedule.totalRepayableKobo,
    installmentsCount,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  for (const inst of schedule.installments) {
    await db.insert(installmentsTable).values({
      id: uid(),
      loanId,
      seq: inst.seq,
      dueDate: inst.dueDate,
      amountKobo: inst.amountKobo,
      status: "scheduled",
    });
  }

  await logEvent(db, {
    type: "order_issued",
    customerId,
    orderId,
    message: `Foodline Card ${code} issued for ${formatNaira(totalKobo)} (expires in ${config.cardExpiryHours}h)`,
  });
  await logEvent(db, {
    type: "loan_created",
    customerId,
    orderId,
    loanId,
    message: `Loan of ${formatNaira(totalKobo)} + ${plan.marginBps / 100}% margin = ${formatNaira(schedule.totalRepayableKobo)} over ${installmentsCount} installment(s), first due ${schedule.installments[0].dueDate}`,
    data: { schedule },
  });

  return { ok: true, orderId, voucherCode: code };
}
