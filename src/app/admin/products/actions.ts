"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { productUnits, products, retailers } from "@/db/schema";
import { apiUser } from "@/lib/session";
import { uid } from "@/lib/ids";
import { formatNaira, parseNairaToKobo } from "@/lib/money";
import { priceFor } from "@/lib/catalog";
import { logEvent } from "@/lib/ledger";
import { formatBps, parseMarkupPercent } from "../approvals/review-state";

export type ProductState = { errors: Record<string, string> };

function revalidateCatalog() {
  revalidatePath("/admin/products");
  revalidatePath("/admin/approvals");
  revalidatePath("/admin");
  revalidatePath("/app/shop");
}

export async function toggleProductActive(productId: string, active: boolean): Promise<void> {
  const admin = await apiUser("admin");
  if (!admin) return;
  const db = getDb();
  const product = (
    await db.select().from(products).where(eq(products.id, productId)).limit(1)
  )[0];
  if (!product) return;
  // Bringing an archived listing back means putting it on the shelf again. A
  // listing still waiting on a decision keeps its pending status either way.
  const status = active && product.status === "archived" ? "approved" : product.status;
  await db
    .update(products)
    .set({ active, status, updatedAt: new Date() })
    .where(eq(products.id, productId));
  revalidateCatalog();
}

export async function bulkSetActive(ids: string[], active: boolean): Promise<void> {
  const admin = await apiUser("admin");
  if (!admin || ids.length === 0) return;
  const db = getDb();
  await db
    .update(products)
    .set({ active, updatedAt: new Date() })
    .where(inArray(products.id, ids));
  if (active) {
    await db
      .update(products)
      .set({ status: "approved", updatedAt: new Date() })
      .where(and(inArray(products.id, ids), eq(products.status, "archived")));
  }
  await logEvent(db, {
    type: "config_change",
    actor: `admin:${admin.id}`,
    message: `${ids.length} product(s) set ${active ? "available" : "unavailable"}`,
  });
  revalidateCatalog();
}

export async function archiveProduct(productId: string): Promise<void> {
  const admin = await apiUser("admin");
  if (!admin) return;
  const db = getDb();
  const product = (
    await db.select().from(products).where(eq(products.id, productId)).limit(1)
  )[0];
  if (!product) return;
  await db
    .update(products)
    .set({ status: "archived", active: false, updatedAt: new Date() })
    .where(eq(products.id, productId));
  await db.update(productUnits).set({ active: false }).where(eq(productUnits.productId, productId));
  await logEvent(db, {
    type: "config_change",
    actor: `admin:${admin.id}`,
    message: `Product ${product.name} archived`,
    data: { productId, retailerId: product.retailerId },
  });
  revalidateCatalog();
  redirect("/admin/products");
}

export async function saveProduct(_prev: ProductState, form: FormData): Promise<ProductState> {
  const admin = await apiUser("admin");
  if (!admin) return { errors: { form: "Your session expired. Sign in again." } };

  const id = String(form.get("id") ?? "").trim();
  const name = String(form.get("name") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const category = String(form.get("category") ?? "").trim();
  const imageKey = String(form.get("imageKey") ?? "").trim() || null;
  const retailerId = String(form.get("retailerId") ?? "").trim() || null;

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Give the product a name.";
  if (!description) errors.description = "Write a short description shoppers will read.";
  if (!category) errors.category = "Choose or type a category.";

  const markupBps = parseMarkupPercent(String(form.get("markupPercent") ?? ""));
  if (markupBps === null) {
    errors.markup = "Set a markup between 0% and 200%, for example 10.";
  }

  const unitIds = form.getAll("unitId").map((v) => String(v));
  const labels = form.getAll("unitLabel").map((v) => String(v).trim());
  const costs = form.getAll("unitCost").map((v) => String(v).trim());
  const stocks = form.getAll("unitStock").map((v) => String(v).trim());
  const actives = form.getAll("unitActive").map((v) => String(v) === "1");

  const units: {
    id: string | null;
    label: string;
    costKobo: number;
    stock: number;
    active: boolean;
  }[] = [];

  for (let i = 0; i < labels.length; i++) {
    if (!labels[i] && !costs[i]) continue;
    if (!labels[i]) {
      errors.units = "Every unit needs a label, for example 1 mudu.";
      break;
    }
    const costKobo = parseNairaToKobo(costs[i]);
    if (costKobo === null || costKobo <= 0) {
      errors.units = `Set what the shop receives for "${labels[i]}".`;
      break;
    }
    const stock = Number(stocks[i] || "0");
    if (!Number.isInteger(stock) || stock < 0) {
      errors.units = `Stock for "${labels[i]}" must be a whole number.`;
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
    errors.units = "Add at least one sellable unit.";
  }
  if (Object.keys(errors).length > 0) return { errors };

  const db = getDb();
  const markup = markupBps as number;

  let shopName = "Foodline catalog";
  if (retailerId) {
    const shop = (
      await db
        .select({ businessName: retailers.businessName })
        .from(retailers)
        .where(eq(retailers.id, retailerId))
        .limit(1)
    )[0];
    if (!shop) {
      return { errors: { retailerId: "That shop no longer exists. Pick another one." } };
    }
    shopName = shop.businessName;
  }

  const now = new Date();
  let productId = id;
  let statusNote = "";

  if (id) {
    const existingProduct = (
      await db.select().from(products).where(eq(products.id, id)).limit(1)
    )[0];
    if (!existingProduct) {
      return { errors: { form: "That product no longer exists. It may have been deleted." } };
    }
    // An admin edit never changes where a listing sits in the review flow: a
    // live product stays live, a pending one stays pending until it is approved.
    await db
      .update(products)
      .set({ name, description, category, imageKey, retailerId, markupBps: markup, updatedAt: now })
      .where(eq(products.id, id));
    statusNote =
      existingProduct.status === "approved"
        ? "live"
        : `still ${existingProduct.status}`;

    const existingUnits = await db
      .select({ id: productUnits.id })
      .from(productUnits)
      .where(eq(productUnits.productId, id));
    const keep = new Set(units.map((u) => u.id).filter(Boolean) as string[]);
    const remove = existingUnits.filter((row) => !keep.has(row.id)).map((row) => row.id);
    if (remove.length > 0) {
      await db.delete(productUnits).where(inArray(productUnits.id, remove));
    }
  } else {
    productId = uid();
    // Admin listings skip the queue: the person setting the markup is the
    // person who would approve it.
    await db.insert(products).values({
      id: productId,
      retailerId,
      name,
      description,
      category,
      imageKey,
      status: "approved",
      suggestedMarkupBps: markup,
      markupBps: markup,
      submittedBy: `admin:${admin.id}`,
      reviewedBy: `admin:${admin.id}`,
      reviewedAt: now,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
    statusNote = "live";
  }

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const priceKobo = priceFor(u.costKobo, markup);
    if (u.id) {
      await db
        .update(productUnits)
        .set({
          unitLabel: u.label,
          costKobo: u.costKobo,
          priceKobo,
          stockQty: u.stock,
          active: u.active,
          sortOrder: i,
        })
        .where(eq(productUnits.id, u.id));
    } else {
      await db.insert(productUnits).values({
        id: uid(),
        productId,
        unitLabel: u.label,
        costKobo: u.costKobo,
        priceKobo,
        stockQty: u.stock,
        active: u.active,
        sortOrder: i,
      });
    }
  }

  const sample = units[0];
  await logEvent(db, {
    type: "config_change",
    actor: `admin:${admin.id}`,
    message: `Product ${name} ${id ? "updated" : "created"} for ${shopName} at ${formatBps(
      markup
    )} markup, ${units.length} unit(s), ${statusNote}${
      sample
        ? ` (${sample.label}: shop receives ${formatNaira(sample.costKobo)}, customer pays ${formatNaira(
            priceFor(sample.costKobo, markup)
          )})`
        : ""
    }`,
    data: { productId, retailerId, markupBps: markup, units: units.length },
  });

  revalidateCatalog();
  redirect("/admin/products");
}
