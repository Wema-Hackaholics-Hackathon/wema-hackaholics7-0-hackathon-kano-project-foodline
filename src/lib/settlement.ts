import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { orders, retailers, settlements } from "@/db/schema";
import { paystackReference, uid } from "./ids";
import { formatNaira } from "./money";
import { logEvent } from "./ledger";
import { initiateTransfer, PaystackError } from "./paystack";

// Handover requires BOTH sides to confirm: the retailer (who has checked the
// order against what is on the counter) and the customer (who is standing
// there receiving it). Money moves only when both have tapped confirm, so a
// leaked voucher code on its own cannot trigger a payout.

export type OrderRow = typeof orders.$inferSelect;

export type ConfirmOutcome =
  | {
      ok: true;
      state: "awaiting_customer";
      orderId: string;
      voucherCode: string;
      amountKobo: number;
    }
  | {
      ok: true;
      state: "awaiting_retailer";
      orderId: string;
      voucherCode: string;
      amountKobo: number;
    }
  | {
      ok: true;
      state: "settled";
      orderId: string;
      voucherCode: string;
      amountKobo: number;
      settlementStatus: "success" | "pending";
      reference: string;
      retailerId: string;
    }
  | { ok: false; error: string };

/** Shared matching rule: >= 32 chars is the QR token, else the short code. */
export function matchOrderWhere(codeOrToken: string) {
  const needle = codeOrToken.trim();
  return needle.length >= 32
    ? eq(orders.qrToken, needle)
    : eq(orders.voucherCode, needle.toUpperCase().replace(/\s/g, ""));
}

function validateOrder(order: OrderRow | undefined): string | null {
  if (!order) return "Card not found. Check the code and try again.";
  if (order.status === "settled") return "This card has already been used.";
  if (order.status === "cancelled") return "This card was cancelled.";
  if (order.status === "expired" || order.expiresAt.getTime() < Date.now()) {
    return "This card has expired. The customer can place a new order.";
  }
  return null;
}

/**
 * The retailer's half of the handover. Scanning the QR or entering the code
 * is what counts as their confirmation.
 */
export async function confirmByRetailer(
  db: Db,
  input: { codeOrToken: string; retailerId: string }
): Promise<ConfirmOutcome> {
  const order = (await db.select().from(orders).where(matchOrderWhere(input.codeOrToken)).limit(1))[0];
  const invalid = validateOrder(order);
  if (invalid) {
    if (order && order.status !== "expired" && order.expiresAt.getTime() < Date.now()) {
      await db.update(orders).set({ status: "expired" }).where(eq(orders.id, order.id));
    }
    return { ok: false, error: invalid };
  }

  const retailer = (
    await db
      .select()
      .from(retailers)
      .where(and(eq(retailers.id, input.retailerId), eq(retailers.active, true)))
      .limit(1)
  )[0];
  if (!retailer) return { ok: false, error: "Your retailer account is not active." };

  if (order!.retailerConfirmedAt) {
    // Already confirmed by a store: only settle-if-ready, do not double log
    return finalizeIfReady(db, order!);
  }

  const now = new Date();
  await db
    .update(orders)
    .set({ retailerConfirmedAt: now, redeemedByRetailerId: retailer.id })
    .where(eq(orders.id, order!.id));
  await logEvent(db, {
    type: "order_redeemed",
    customerId: order!.customerId,
    orderId: order!.id,
    actor: `retailer:${retailer.id}`,
    message: `${retailer.businessName} confirmed card ${order!.voucherCode} for ${formatNaira(order!.totalKobo)}${
      order!.customerConfirmedAt ? "" : ", waiting for the customer to confirm collection"
    }`,
  });

  const refreshed = { ...order!, retailerConfirmedAt: now, redeemedByRetailerId: retailer.id };
  return finalizeIfReady(db, refreshed);
}

/** The customer's half: they are at the counter receiving the goods. */
export async function confirmByCustomer(
  db: Db,
  input: { orderId: string; customerId: string }
): Promise<ConfirmOutcome> {
  const order = (await db.select().from(orders).where(eq(orders.id, input.orderId)).limit(1))[0];
  if (!order || order.customerId !== input.customerId) {
    return { ok: false, error: "Card not found." };
  }
  const invalid = validateOrder(order);
  if (invalid) return { ok: false, error: invalid };

  if (order.customerConfirmedAt) return finalizeIfReady(db, order);

  const now = new Date();
  await db
    .update(orders)
    .set({ customerConfirmedAt: now })
    .where(eq(orders.id, order.id));
  await logEvent(db, {
    type: "order_redeemed",
    customerId: order.customerId,
    orderId: order.id,
    actor: `customer:${order.customerId}`,
    message: `Customer confirmed collection of card ${order.voucherCode}${
      order.retailerConfirmedAt ? "" : ", waiting for the store to confirm"
    }`,
  });

  return finalizeIfReady(db, { ...order, customerConfirmedAt: now });
}

/** Settle only when both sides have confirmed. */
async function finalizeIfReady(db: Db, order: OrderRow): Promise<ConfirmOutcome> {
  const base = {
    ok: true as const,
    orderId: order.id,
    voucherCode: order.voucherCode,
    amountKobo: order.totalKobo,
  };
  if (!order.retailerConfirmedAt) return { ...base, state: "awaiting_retailer" };
  if (!order.customerConfirmedAt) return { ...base, state: "awaiting_customer" };
  if (order.status === "settled") {
    return {
      ...base,
      state: "settled",
      settlementStatus: "success",
      reference: "",
      retailerId: order.redeemedByRetailerId ?? "",
    };
  }

  const retailerId = order.redeemedByRetailerId;
  if (!retailerId) return { ...base, state: "awaiting_retailer" };
  const retailer = (
    await db.select().from(retailers).where(eq(retailers.id, retailerId)).limit(1)
  )[0];
  if (!retailer) return { ok: false, error: "The confirming store could not be found." };

  const now = new Date();
  await db
    .update(orders)
    .set({ status: "redeemed", redeemedAt: now })
    .where(eq(orders.id, order.id));

  const settled = await settleOrder(db, order, retailer);
  return {
    ...base,
    state: "settled",
    settlementStatus: settled.status,
    reference: settled.reference,
    retailerId,
  };
}

type RetailerRow = typeof retailers.$inferSelect;

/** Instant Paystack payout to the retailer that honoured the card. */
async function settleOrder(
  db: Db,
  order: OrderRow,
  retailer: RetailerRow
): Promise<{ status: "success" | "pending"; reference: string }> {
  const reference = paystackReference();
  const settlementId = uid();
  const now = new Date();

  await db.insert(settlements).values({
    id: settlementId,
    orderId: order.id,
    retailerId: retailer.id,
    amountKobo: order.totalKobo,
    status: "pending",
    reference,
    createdAt: now,
  });
  await logEvent(db, {
    type: "settlement_initiated",
    customerId: order.customerId,
    orderId: order.id,
    message: `Both sides confirmed. Settlement of ${formatNaira(order.totalKobo)} to ${retailer.businessName} initiated (ref ${reference})`,
    data: { settlementId, retailerId: retailer.id },
  });

  try {
    if (!retailer.paystackRecipientCode) {
      throw new PaystackError("Retailer has no Paystack recipient on file", 0);
    }
    const transfer = await initiateTransfer({
      amountKobo: order.totalKobo,
      recipientCode: retailer.paystackRecipientCode,
      reference,
      reason: `Foodline settlement ${order.voucherCode}`,
    });
    const final = transfer.status === "success";
    await db
      .update(settlements)
      .set({
        status: final ? "success" : "pending",
        paystackTransferCode: transfer.transfer_code,
        settledAt: final ? new Date() : null,
      })
      .where(eq(settlements.id, settlementId));
    if (final) {
      await db.update(orders).set({ status: "settled" }).where(eq(orders.id, order.id));
    }
    await logEvent(db, {
      type: "settlement_result",
      customerId: order.customerId,
      orderId: order.id,
      message: final
        ? `Settlement of ${formatNaira(order.totalKobo)} to ${retailer.businessName} succeeded (${transfer.transfer_code})`
        : `Settlement queued with Paystack (status: ${transfer.status}); awaiting webhook confirmation`,
      data: { reference, transferCode: transfer.transfer_code, status: transfer.status },
    });
    return { status: final ? "success" : "pending", reference };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transfer failed";
    if (retailer.isDemo) {
      // Stage resilience: simulate the payout rather than stall the pitch
      await db
        .update(settlements)
        .set({ status: "success", settledAt: new Date() })
        .where(eq(settlements.id, settlementId));
      await db.update(orders).set({ status: "settled" }).where(eq(orders.id, order.id));
      await logEvent(db, {
        type: "settlement_result",
        customerId: order.customerId,
        orderId: order.id,
        message: `Settlement simulated for demo retailer (Paystack unreachable: ${message})`,
        data: { reference },
      });
      return { status: "success", reference };
    }
    await db
      .update(settlements)
      .set({ status: "failed", failureReason: message })
      .where(eq(settlements.id, settlementId));
    await logEvent(db, {
      type: "settlement_result",
      customerId: order.customerId,
      orderId: order.id,
      message: `Settlement to ${retailer.businessName} failed: ${message}. The goods were released; operations can retry from the ledger.`,
      data: { reference },
    });
    return { status: "pending", reference };
  }
}
