"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { productUnits, products, retailers } from "@/db/schema";
import { apiUser } from "@/lib/session";
import { uid } from "@/lib/ids";
import { parseNairaToKobo } from "@/lib/money";
import { priceFor } from "@/lib/catalog";
import { logEvent } from "@/lib/ledger";
import type { ListingState } from "./shared";

// A shop lists a product at the price it needs (cost) with a suggested markup.
// Everything it saves lands as "pending" and waits for an admin to set the
// final markup, so nothing here ever writes a customer-facing price that the
// Foodline team has not signed off.

async function revalidateShelf(): Promise<void> {
  revalidatePath("/retailer/products");
  revalidatePath("/admin/approvals");
  revalidatePath("/app/shop");
}

// ---------------------------------------------------------------------------
// Create and edit
// ---------------------------------------------------------------------------

type ParsedUnit = {
  id: string | null;
  label: string;
  costKobo: number;
  stock: number;
  active: boolean;
};

export async function saveListing(_prev: ListingState, form: FormData): Promise<ListingState> {
  const user = await apiUser("retailer");
  if (!user) {
    return { errors: { form: "Your session has ended. Sign in again to save this listing." } };
  }

  const db = getDb();
  const shop = (
    await db.select().from(retailers).where(eq(retailers.id, user.id)).limit(1)
  )[0];
  if (!shop) {
    return {
      errors: { form: "We could not find your shop profile. Contact the Foodline partner team." },
    };
  }

  const id = String(form.get("id") ?? "").trim();
  const existing = id
    ? (await db.select().from(products).where(eq(products.id, id)).limit(1))[0]
    : undefined;
  if (id && (!existing || existing.retailerId !== user.id)) {
    return { errors: { form: "That listing is not on your shelf, so it cannot be edited here." } };
  }

  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const category = String(form.get("category") ?? "").trim();
  const imageKey = String(form.get("imageKey") ?? "").trim() || null;
  const markupRaw = String(form.get("suggestedMarkup") ?? "").trim();

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Give the product a name shoppers will recognise.";
  if (!description) errors.description = "Write a short description of what is in the pack.";
  if (!category) errors.category = "Choose an existing category or type a new one.";

  const markupPercent = Number(markupRaw);
  if (!markupRaw || !Number.isFinite(markupPercent) || markupPercent < 0 || markupPercent > 100) {
    errors.suggestedMarkup = "Suggest a markup between 0 and 100 percent.";
  }
  const suggestedMarkupBps = errors.suggestedMarkup ? 1000 : Math.round(markupPercent * 100);

  const unitIds = form.getAll("unitId").map((v) => String(v));
  const labels = form.getAll("unitLabel").map((v) => String(v).trim());
  const costs = form.getAll("unitCost").map((v) => String(v).trim());
  const stocks = form.getAll("unitStock").map((v) => String(v).trim());
  const actives = form.getAll("unitActive").map((v) => String(v) === "1");

  const units: ParsedUnit[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (!labels[i] && !costs[i]) continue;
    if (!labels[i]) {
      errors.units = "Every unit needs a name, for example 1 mudu or 50kg bag.";
      break;
    }
    const costKobo = parseNairaToKobo(costs[i]);
    if (costKobo === null || costKobo <= 0) {
      errors.units = `Enter what you receive for "${labels[i]}", in naira.`;
      break;
    }
    const stock = Number(stocks[i] || "0");
    if (!Number.isInteger(stock) || stock < 0) {
      errors.units = `Stock for "${labels[i]}" must be a whole number, 0 or more.`;
      break;
    }
    units.push({
      id: unitIds[i] && unitIds[i] !== "new" ? unitIds[i] : null,
      label: labels[i],
      costKobo,
      stock,
      active: actives[i],
    });
  }
  if (!errors.units && units.length === 0) {
    errors.units = "Add at least one unit you sell this in.";
  }

  if (Object.keys(errors).length > 0) return { errors };

  const now = new Date();
  let productId = id;

  if (existing) {
    await db
      .update(products)
      .set({
        name,
        description,
        category,
        imageKey,
        suggestedMarkupBps,
        // Price or stock changes need a fresh decision, so every save goes
        // back to the review queue and off the shelf until it is approved.
        status: "pending",
        active: true,
        rejectionReason: null,
        submittedBy: `retailer:${user.id}`,
        reviewedBy: null,
        reviewedAt: null,
        updatedAt: now,
      })
      .where(eq(products.id, existing.id));

    const rows = await db
      .select({ id: productUnits.id })
      .from(productUnits)
      .where(eq(productUnits.productId, existing.id));
    const keep = new Set(units.map((u) => u.id).filter((v): v is string => Boolean(v)));
    const remove = rows.filter((row) => !keep.has(row.id)).map((row) => row.id);
    if (remove.length > 0) {
      await db.delete(productUnits).where(inArray(productUnits.id, remove));
    }
  } else {
    productId = uid();
    await db.insert(products).values({
      id: productId,
      retailerId: user.id,
      name,
      description,
      category,
      imageKey,
      status: "pending",
      suggestedMarkupBps,
      submittedBy: `retailer:${user.id}`,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (let i = 0; i < units.length; i++) {
    const unit = units[i];
    // Provisional only: the admin recomputes every price from cost at approval.
    const provisionalPrice = priceFor(unit.costKobo, suggestedMarkupBps);
    if (unit.id) {
      await db
        .update(productUnits)
        .set({
          unitLabel: unit.label,
          costKobo: unit.costKobo,
          priceKobo: provisionalPrice,
          stockQty: unit.stock,
          active: unit.active,
          sortOrder: i,
        })
        .where(eq(productUnits.id, unit.id));
    } else {
      await db.insert(productUnits).values({
        id: uid(),
        productId,
        unitLabel: unit.label,
        costKobo: unit.costKobo,
        priceKobo: provisionalPrice,
        stockQty: unit.stock,
        active: unit.active,
        sortOrder: i,
      });
    }
  }

  await logEvent(db, {
    type: "config_change",
    actor: `retailer:${user.id}`,
    message: `Store ${shop.businessName} submitted listing ${name} for review`,
    data: {
      productId,
      retailerId: user.id,
      units: units.length,
      suggestedMarkupBps,
      resubmission: Boolean(existing),
      previousStatus: existing?.status ?? null,
    },
  });

  await revalidateShelf();
  redirect(`/retailer/products?saved=${existing ? "updated" : "created"}`);
}

// ---------------------------------------------------------------------------
// Stock only: no re-approval, because running out of rice is not a price change
// ---------------------------------------------------------------------------

export async function setUnitStock(
  unitId: string,
  stockQty: number
): Promise<{ ok: boolean; error?: string }> {
  const user = await apiUser("retailer");
  if (!user) return { ok: false, error: "Your session has ended. Sign in again." };
  if (!Number.isInteger(stockQty) || stockQty < 0 || stockQty > 100_000) {
    return { ok: false, error: "Stock must be a whole number between 0 and 100,000." };
  }

  const db = getDb();
  const row = (
    await db
      .select({ id: productUnits.id, retailerId: products.retailerId })
      .from(productUnits)
      .innerJoin(products, eq(productUnits.productId, products.id))
      .where(eq(productUnits.id, unitId))
      .limit(1)
  )[0];
  if (!row || row.retailerId !== user.id) {
    return { ok: false, error: "That unit is not on your shelf." };
  }

  await db.update(productUnits).set({ stockQty }).where(eq(productUnits.id, unitId));
  revalidatePath("/retailer/products");
  revalidatePath("/app/shop");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Archive
// ---------------------------------------------------------------------------

export async function archiveListing(productId: string): Promise<void> {
  const user = await apiUser("retailer");
  if (!user) return;

  const db = getDb();
  const product = (
    await db.select().from(products).where(eq(products.id, productId)).limit(1)
  )[0];
  if (!product || product.retailerId !== user.id) return;

  await db
    .update(products)
    .set({ status: "archived", active: false, updatedAt: new Date() })
    .where(eq(products.id, productId));

  await logEvent(db, {
    type: "config_change",
    actor: `retailer:${user.id}`,
    message: `Listing archived by the shop: ${product.name}`,
    data: { productId, retailerId: user.id, previousStatus: product.status },
  });

  await revalidateShelf();
  redirect("/retailer/products?status=archived&saved=archived");
}
