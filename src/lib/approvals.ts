import { and, eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { productUnits, products, retailers, users } from "@/db/schema";
import { logEvent } from "./ledger";
import { formatNaira } from "./money";
import { priceFor, realisedMarkupBps } from "./catalog";
import { createTransferRecipient } from "./paystack";

// Everything a partner submits lands as pending and needs an admin decision:
// shop applications, and every product listing with its markup.

export type PendingCounts = { retailers: number; products: number; total: number };

export async function pendingCounts(db: Db): Promise<PendingCounts> {
  const [r] = await db
    .select({ n: sql<number>`count(*)` })
    .from(retailers)
    .where(eq(retailers.status, "pending"));
  const [p] = await db
    .select({ n: sql<number>`count(*)` })
    .from(products)
    .where(eq(products.status, "pending"));
  const rn = Number(r?.n ?? 0);
  const pn = Number(p?.n ?? 0);
  return { retailers: rn, products: pn, total: rn + pn };
}

// ---------------------------------------------------------------------------
// Shop applications
// ---------------------------------------------------------------------------

export async function approveRetailer(
  db: Db,
  retailerId: string,
  adminId: string
): Promise<{ ok: boolean; warning?: string }> {
  const retailer = (
    await db.select().from(retailers).where(eq(retailers.id, retailerId)).limit(1)
  )[0];
  if (!retailer) return { ok: false };

  const now = new Date();
  let warning: string | undefined;

  // Create the payout recipient at approval time, so an unapproved shop never
  // exists on Paystack. Failure is not fatal: it can be relinked later.
  let recipientCode = retailer.paystackRecipientCode;
  if (!recipientCode) {
    try {
      recipientCode = await createTransferRecipient({
        name: retailer.settlementAccountName,
        accountNumber: retailer.settlementAccountNumber,
        bankCode: retailer.settlementBankCode,
      });
    } catch (err) {
      recipientCode = null;
      warning = `Approved, but the Paystack payout recipient could not be created (${
        err instanceof Error ? err.message : "unknown error"
      }). Relink it from the store list before they trade.`;
    }
  }

  await db
    .update(retailers)
    .set({
      status: "approved",
      active: true,
      paystackRecipientCode: recipientCode,
      reviewedBy: `admin:${adminId}`,
      reviewedAt: now,
      rejectionReason: null,
    })
    .where(eq(retailers.id, retailerId));

  await logEvent(db, {
    type: "config_change",
    actor: `admin:${adminId}`,
    message: `Partner store approved: ${retailer.businessName}${
      retailer.state ? `, ${retailer.lga ?? ""} ${retailer.state}`.replace(/\s+/g, " ") : ""
    }`,
    data: { retailerId, bankVerified: retailer.bankVerified },
  });
  return { ok: true, warning };
}

export async function rejectRetailer(
  db: Db,
  retailerId: string,
  adminId: string,
  reason: string
): Promise<void> {
  const retailer = (
    await db.select().from(retailers).where(eq(retailers.id, retailerId)).limit(1)
  )[0];
  if (!retailer) return;
  await db
    .update(retailers)
    .set({
      status: "rejected",
      active: false,
      rejectionReason: reason,
      reviewedBy: `admin:${adminId}`,
      reviewedAt: new Date(),
    })
    .where(eq(retailers.id, retailerId));
  await logEvent(db, {
    type: "config_change",
    actor: `admin:${adminId}`,
    message: `Partner store application declined: ${retailer.businessName}. Reason: ${reason}`,
    data: { retailerId },
  });
}

// ---------------------------------------------------------------------------
// Product listings
// ---------------------------------------------------------------------------

/**
 * Approve a listing at the given markup. Every unit's customer price is
 * recomputed from its cost, so the markup is applied consistently and the
 * retailer's cost is never exposed.
 */
export async function approveProduct(
  db: Db,
  productId: string,
  adminId: string,
  markupBps: number
): Promise<{ ok: boolean; priced: number }> {
  const product = (
    await db.select().from(products).where(eq(products.id, productId)).limit(1)
  )[0];
  if (!product) return { ok: false, priced: 0 };

  const units = await db
    .select()
    .from(productUnits)
    .where(eq(productUnits.productId, productId));

  for (const unit of units) {
    await db
      .update(productUnits)
      .set({ priceKobo: priceFor(unit.costKobo, markupBps) })
      .where(eq(productUnits.id, unit.id));
  }

  const now = new Date();
  await db
    .update(products)
    .set({
      status: "approved",
      active: true,
      markupBps,
      reviewedBy: `admin:${adminId}`,
      reviewedAt: now,
      rejectionReason: null,
      updatedAt: now,
    })
    .where(eq(products.id, productId));

  const sample = units[0];
  await logEvent(db, {
    type: "config_change",
    actor: `admin:${adminId}`,
    message: `Listing approved: ${product.name} at ${markupBps / 100}% markup${
      sample
        ? ` (${sample.unitLabel}: cost ${formatNaira(sample.costKobo)}, sells at ${formatNaira(
            priceFor(sample.costKobo, markupBps)
          )})`
        : ""
    }`,
    data: { productId, markupBps, suggestedMarkupBps: product.suggestedMarkupBps },
  });
  return { ok: true, priced: units.length };
}

export async function rejectProduct(
  db: Db,
  productId: string,
  adminId: string,
  reason: string
): Promise<void> {
  const product = (
    await db.select().from(products).where(eq(products.id, productId)).limit(1)
  )[0];
  if (!product) return;
  await db
    .update(products)
    .set({
      status: "rejected",
      active: false,
      rejectionReason: reason,
      reviewedBy: `admin:${adminId}`,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(products.id, productId));
  await logEvent(db, {
    type: "config_change",
    actor: `admin:${adminId}`,
    message: `Listing declined: ${product.name}. Reason: ${reason}`,
    data: { productId },
  });
}

export type PendingProduct = {
  id: string;
  name: string;
  description: string;
  category: string;
  imageKey: string | null;
  suggestedMarkupBps: number;
  submittedBy: string | null;
  createdAt: Date;
  storeName: string;
  storeId: string | null;
  units: {
    id: string;
    unitLabel: string;
    costKobo: number;
    stockQty: number;
    suggestedPriceKobo: number;
  }[];
};

export async function listPendingProducts(db: Db): Promise<PendingProduct[]> {
  const rows = await db
    .select({ product: products, storeName: retailers.businessName, storeId: retailers.id })
    .from(products)
    .leftJoin(retailers, eq(products.retailerId, retailers.id))
    .where(eq(products.status, "pending"))
    .orderBy(products.createdAt);

  if (rows.length === 0) return [];
  const units = await db.select().from(productUnits);
  const byProduct = new Map<string, typeof units>();
  for (const unit of units) {
    const list = byProduct.get(unit.productId);
    if (list) list.push(unit);
    else byProduct.set(unit.productId, [unit]);
  }

  return rows.map(({ product, storeName, storeId }) => ({
    id: product.id,
    name: product.name,
    description: product.description,
    category: product.category,
    imageKey: product.imageKey,
    suggestedMarkupBps: product.suggestedMarkupBps,
    submittedBy: product.submittedBy,
    createdAt: product.createdAt,
    storeName: storeName ?? "Foodline catalog",
    storeId,
    units: (byProduct.get(product.id) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((u) => ({
        id: u.id,
        unitLabel: u.unitLabel,
        costKobo: u.costKobo,
        stockQty: u.stockQty,
        suggestedPriceKobo: priceFor(u.costKobo, product.suggestedMarkupBps),
      })),
  }));
}

export type PendingRetailer = {
  id: string;
  businessName: string;
  ownerName: string | null;
  email: string;
  contactPhone: string | null;
  address: string | null;
  state: string | null;
  lga: string | null;
  rcNumber: string | null;
  businessType: string | null;
  yearsTrading: number | null;
  description: string | null;
  bankName: string;
  accountNumber: string;
  accountName: string;
  bankVerified: boolean;
  createdAt: Date;
};

export async function listPendingRetailers(db: Db): Promise<PendingRetailer[]> {
  const rows = await db
    .select({ retailer: retailers, email: users.email })
    .from(retailers)
    .innerJoin(users, eq(retailers.id, users.id))
    .where(eq(retailers.status, "pending"))
    .orderBy(retailers.createdAt);

  return rows.map(({ retailer, email }) => ({
    id: retailer.id,
    businessName: retailer.businessName,
    ownerName: retailer.ownerName,
    email,
    contactPhone: retailer.contactPhone,
    address: retailer.address,
    state: retailer.state,
    lga: retailer.lga,
    rcNumber: retailer.rcNumber,
    businessType: retailer.businessType,
    yearsTrading: retailer.yearsTrading,
    description: retailer.description,
    bankName: retailer.settlementBankName,
    accountNumber: retailer.settlementAccountNumber,
    accountName: retailer.settlementAccountName,
    bankVerified: retailer.bankVerified,
    createdAt: retailer.createdAt,
  }));
}

/** Realised markup on an approved unit, for admin views only. */
export { realisedMarkupBps };

export async function countApprovedProducts(db: Db, retailerId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(products)
    .where(and(eq(products.retailerId, retailerId), eq(products.status, "approved")));
  return Number(row?.n ?? 0);
}
