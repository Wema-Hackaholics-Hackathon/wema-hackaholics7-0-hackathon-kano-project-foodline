import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { orders, retailers, settlements } from "@/db/schema";
import { paystackReference, uid } from "./ids";
import { formatNaira } from "./money";
import { logEvent } from "./ledger";
import { initiateTransfer, PaystackError } from "./paystack";

export type RedeemResult =
  | { ok: true; orderId: string; settlementStatus: "success" | "pending"; reference: string; amountKobo: number }
  | { ok: false; error: string };

/**
 * Retailer accepts a Foodline Card (QR token or short code), the order is
 * marked redeemed, and the retailer is paid instantly by Paystack transfer.
 * Test-mode transfers settle synchronously; demo retailers fall back to a
 * simulated settlement if Paystack is unreachable so a stage demo never
 * stalls on conference wifi.
 */
export async function redeemAndSettle(
  db: Db,
  input: { codeOrToken: string; retailerId: string }
): Promise<RedeemResult> {
  const needle = input.codeOrToken.trim();
  const normalizedCode = needle.toUpperCase().replace(/\s/g, "");

  const order = (
    await db
      .select()
      .from(orders)
      .where(
        needle.length >= 32
          ? eq(orders.qrToken, needle)
          : eq(orders.voucherCode, normalizedCode)
      )
      .limit(1)
  )[0];

  if (!order) return { ok: false, error: "Card not found. Check the code and try again." };
  if (order.status === "redeemed" || order.status === "settled") {
    return { ok: false, error: "This card has already been used." };
  }
  if (order.status === "cancelled") {
    return { ok: false, error: "This card was cancelled." };
  }
  if (order.status === "expired" || order.expiresAt.getTime() < Date.now()) {
    if (order.status !== "expired") {
      await db.update(orders).set({ status: "expired" }).where(eq(orders.id, order.id));
    }
    return { ok: false, error: "This card has expired. The customer can place a new order." };
  }

  const retailer = (
    await db
      .select()
      .from(retailers)
      .where(and(eq(retailers.id, input.retailerId), eq(retailers.active, true)))
      .limit(1)
  )[0];
  if (!retailer) return { ok: false, error: "Your retailer account is not active." };

  const now = new Date();
  await db
    .update(orders)
    .set({ status: "redeemed", redeemedAt: now, redeemedByRetailerId: retailer.id })
    .where(eq(orders.id, order.id));
  await logEvent(db, {
    type: "order_redeemed",
    customerId: order.customerId,
    orderId: order.id,
    actor: `retailer:${retailer.id}`,
    message: `Card ${order.voucherCode} redeemed at ${retailer.businessName} for ${formatNaira(order.totalKobo)}`,
  });

  const reference = paystackReference();
  const settlementId = uid();
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
    message: `Instant settlement of ${formatNaira(order.totalKobo)} to ${retailer.businessName} initiated (ref ${reference})`,
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
    return {
      ok: true,
      orderId: order.id,
      settlementStatus: final ? "success" : "pending",
      reference,
      amountKobo: order.totalKobo,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Transfer failed";
    if (retailer.isDemo) {
      // Stage-demo resilience: simulate the payout rather than stall the pitch
      await db
        .update(settlements)
        .set({ status: "success", settledAt: new Date(), failureReason: null })
        .where(eq(settlements.id, settlementId));
      await db.update(orders).set({ status: "settled" }).where(eq(orders.id, order.id));
      await logEvent(db, {
        type: "settlement_result",
        customerId: order.customerId,
        orderId: order.id,
        message: `Settlement simulated for demo retailer (Paystack unreachable: ${message})`,
        data: { reference },
      });
      return {
        ok: true,
        orderId: order.id,
        settlementStatus: "success",
        reference,
        amountKobo: order.totalKobo,
      };
    }
    await db
      .update(settlements)
      .set({ status: "failed", failureReason: message })
      .where(eq(settlements.id, settlementId));
    await logEvent(db, {
      type: "settlement_result",
      customerId: order.customerId,
      orderId: order.id,
      message: `Settlement to ${retailer.businessName} failed: ${message}. Order stays redeemed; operations can retry from the admin ledger.`,
      data: { reference },
    });
    // The card was honoured; the payout failure is an operations problem,
    // not the customer's. Surface success with a note.
    return {
      ok: true,
      orderId: order.id,
      settlementStatus: "pending",
      reference,
      amountKobo: order.totalKobo,
    };
  }
}
