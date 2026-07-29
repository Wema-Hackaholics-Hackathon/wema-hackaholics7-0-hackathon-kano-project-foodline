"use server";

// The basket never trusts localStorage. This action returns the current
// server truth for a set of cart lines: live prices, live stock, and the
// customer's live credit position.

import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, productUnits, products } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { availableCreditKobo, outstandingKobo } from "@/lib/debit-engine";

export type ValidatedLine = {
  productUnitId: string;
  productId: string;
  productName: string;
  imageKey: string | null;
  unitLabel: string;
  priceKobo: number;
  stockQty: number;
  /** false when the product or unit has been retired from the catalog */
  available: boolean;
};

export type CartValidation =
  | {
      ok: true;
      lines: ValidatedLine[];
      limitKobo: number;
      outstandingKobo: number;
      availableKobo: number;
      nextPayDate: string | null;
      salaryDayOfMonth: number | null;
    }
  | { ok: false; error: string };

export async function validateCart(
  lines: { productUnitId: string; qty: number }[]
): Promise<CartValidation> {
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

  const unitIds = [...new Set(lines.map((l) => l.productUnitId))].slice(0, 100);
  const rows =
    unitIds.length === 0
      ? []
      : await db
          .select({
            unitId: productUnits.id,
            productId: products.id,
            productName: products.name,
            imageKey: products.imageKey,
            unitLabel: productUnits.unitLabel,
            priceKobo: productUnits.priceKobo,
            stockQty: productUnits.stockQty,
            unitActive: productUnits.active,
            productActive: products.active,
          })
          .from(productUnits)
          .innerJoin(products, eq(productUnits.productId, products.id))
          .where(and(inArray(productUnits.id, unitIds)));

  const byId = new Map(rows.map((r) => [r.unitId, r]));
  const validated: ValidatedLine[] = unitIds.map((id) => {
    const row = byId.get(id);
    if (!row) {
      return {
        productUnitId: id,
        productId: "",
        productName: "Removed item",
        imageKey: null,
        unitLabel: "",
        priceKobo: 0,
        stockQty: 0,
        available: false,
      };
    }
    return {
      productUnitId: row.unitId,
      productId: row.productId,
      productName: row.productName,
      imageKey: row.imageKey,
      unitLabel: row.unitLabel,
      priceKobo: row.priceKobo,
      stockQty: row.stockQty,
      available: row.unitActive && row.productActive,
    };
  });

  const outstanding = await outstandingKobo(db, user.id);
  const available = await availableCreditKobo(db, user.id);

  return {
    ok: true,
    lines: validated,
    limitKobo: customer.creditLimitKobo,
    outstandingKobo: outstanding,
    availableKobo: available,
    nextPayDate: customer.nextPayDate,
    salaryDayOfMonth: customer.salaryDayOfMonth,
  };
}
