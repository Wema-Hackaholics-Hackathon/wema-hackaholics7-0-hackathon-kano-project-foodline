"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { orderItems, orders, retailers, users } from "@/db/schema";
import { apiUser } from "@/lib/session";
import { confirmByRetailer } from "@/lib/settlement";

// ---------------------------------------------------------------------------
// Types shared with the client flow
// ---------------------------------------------------------------------------

export type LookupItem = {
  qty: number;
  productName: string;
  unitLabel: string;
  lineTotalKobo: number;
};

export type InvalidKind = "not_found" | "used" | "expired" | "cancelled" | "auth";

export type LookupResult =
  | {
      ok: true;
      /** Canonical code or token to hand straight to the confirm action */
      canonical: string;
      customerName: string;
      voucherCode: string;
      totalKobo: number;
      expiresAtMs: number;
      items: LookupItem[];
    }
  | { ok: false; kind: InvalidKind; message: string };

export type ConfirmResult =
  | {
      ok: true;
      state: "settled";
      /** What the shop receives, after Foodline's markup is retained */
      amountKobo: number;
      /** What the customer paid on their credit line */
      customerPaidKobo: number;
      reference: string;
      settlementStatus: "success" | "pending";
      bankName: string;
      accountLast4: string;
      atMs: number;
    }
  | {
      /** Retailer has confirmed; money moves once the customer confirms too */
      ok: true;
      state: "awaiting_customer";
      amountKobo: number;
      voucherCode: string;
    }
  | { ok: false; message: string };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Mirrors the matching rule in src/lib/settlement.ts: length >= 32 means the
 * long QR token, anything shorter is the human voucher code. Codes are
 * uppercased, spaces stripped, and accepted with or without the FL- prefix.
 */
function canonicalize(raw: string): string {
  const needle = raw.trim();
  if (needle.length >= 32) return needle;
  const code = needle.toUpperCase().replace(/\s/g, "").replace(/^FL-?/, "");
  return `FL-${code}`;
}

/** "Adaeze Obiajulu" -> "Adaeze O." for the review screen */
function shortName(full: string): string {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Foodline customer";
  const first = parts[0];
  if (parts.length === 1) return first;
  return `${first} ${parts[parts.length - 1][0].toUpperCase()}.`;
}

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

/** Read-only card lookup for the review screen. Mutates nothing. */
export async function lookup(codeOrToken: string): Promise<LookupResult> {
  const user = await apiUser("retailer");
  if (!user) {
    return {
      ok: false,
      kind: "auth",
      message: "Your session has ended. Sign in again to continue.",
    };
  }

  const raw = codeOrToken.trim();
  if (!raw) {
    return { ok: false, kind: "not_found", message: "Enter a card code to look up." };
  }

  const db = getDb();
  const canonical = canonicalize(raw);
  const order = (
    await db
      .select()
      .from(orders)
      .where(raw.length >= 32 ? eq(orders.qrToken, raw) : eq(orders.voucherCode, canonical))
      .limit(1)
  )[0];

  if (!order) {
    return {
      ok: false,
      kind: "not_found",
      message: "We could not find a card with that code. Check it and try again.",
    };
  }
  if (order.status === "redeemed" || order.status === "settled") {
    return {
      ok: false,
      kind: "used",
      message: "This card has already been used. Each Foodline Card can only be accepted once.",
    };
  }
  if (order.status === "cancelled") {
    return {
      ok: false,
      kind: "cancelled",
      message: "This card was cancelled. Ask the customer to place a new order.",
    };
  }
  if (order.status === "expired" || order.expiresAt.getTime() < Date.now()) {
    return {
      ok: false,
      kind: "expired",
      message: "This card has expired. The customer can place a new order for a fresh card.",
    };
  }

  const [items, customerRows] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, order.customerId))
      .limit(1),
  ]);

  return {
    ok: true,
    canonical,
    customerName: shortName(customerRows[0]?.name ?? ""),
    voucherCode: order.voucherCode,
    totalKobo: order.totalKobo,
    expiresAtMs: order.expiresAt.getTime(),
    items: items.map((item) => ({
      qty: item.qty,
      productName: item.productName,
      unitLabel: item.unitLabel,
      lineTotalKobo: item.lineTotalKobo,
    })),
  };
}

/**
 * The retailer's half of the handover. Settlement only fires once the
 * customer has confirmed collection too.
 */
export async function confirmRedeem(codeOrToken: string): Promise<ConfirmResult> {
  const user = await apiUser("retailer");
  if (!user) {
    return { ok: false, message: "Your session has ended. Sign in again to continue." };
  }

  const db = getDb();
  const result = await confirmByRetailer(db, {
    codeOrToken: canonicalize(codeOrToken),
    retailerId: user.id,
  });
  if (!result.ok) return { ok: false, message: result.error };

  revalidatePath("/retailer");
  revalidatePath("/retailer/orders");
  revalidatePath("/retailer/history");

  if (result.state !== "settled") {
    return {
      ok: true,
      state: "awaiting_customer",
      amountKobo: result.amountKobo,
      voucherCode: result.voucherCode,
    };
  }

  const retailer = (
    await db.select().from(retailers).where(eq(retailers.id, user.id)).limit(1)
  )[0];

  return {
    ok: true,
    state: "settled",
    amountKobo: result.retailerAmountKobo,
    customerPaidKobo: result.amountKobo,
    reference: result.reference,
    settlementStatus: result.settlementStatus,
    bankName: retailer?.settlementBankName ?? "your settlement account",
    accountLast4: (retailer?.settlementAccountNumber ?? "").slice(-4),
    atMs: Date.now(),
  };
}

/** Poll target: has the customer confirmed since we showed the waiting state? */
export async function checkHandover(
  codeOrToken: string
): Promise<ConfirmResult> {
  return confirmRedeem(codeOrToken);
}
