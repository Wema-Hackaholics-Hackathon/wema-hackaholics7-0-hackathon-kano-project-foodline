"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { productUnits, products } from "@/db/schema";
import { apiUser } from "@/lib/session";
import { uid } from "@/lib/ids";
import { parseNairaToKobo } from "@/lib/money";
import { logEvent } from "@/lib/ledger";

export type ProductState = { errors: Record<string, string> };

function revalidateCatalog() {
  revalidatePath("/admin/products");
  revalidatePath("/app/shop");
}

export async function toggleProductActive(productId: string, active: boolean): Promise<void> {
  const admin = await apiUser("admin");
  if (!admin) return;
  const db = getDb();
  await db
    .update(products)
    .set({ active, updatedAt: new Date() })
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
    .set({ active: false, updatedAt: new Date() })
    .where(eq(products.id, productId));
  await db.update(productUnits).set({ active: false }).where(eq(productUnits.productId, productId));
  await logEvent(db, {
    type: "config_change",
    actor: `admin:${admin.id}`,
    message: `Product ${product.name} archived`,
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

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Give the product a name.";
  if (!description) errors.description = "Write a short description shoppers will read.";
  if (!category) errors.category = "Choose or type a category.";

  const unitIds = form.getAll("unitId").map((v) => String(v));
  const labels = form.getAll("unitLabel").map((v) => String(v).trim());
  const prices = form.getAll("unitPrice").map((v) => String(v).trim());
  const stocks = form.getAll("unitStock").map((v) => String(v).trim());
  const actives = form.getAll("unitActive").map((v) => String(v) === "1");

  const units: {
    id: string | null;
    label: string;
    priceKobo: number;
    stock: number;
    active: boolean;
  }[] = [];

  for (let i = 0; i < labels.length; i++) {
    if (!labels[i] && !prices[i]) continue;
    if (!labels[i]) {
      errors.units = "Every unit needs a label, for example 1 mudu.";
      break;
    }
    const priceKobo = parseNairaToKobo(prices[i]);
    if (priceKobo === null || priceKobo <= 0) {
      errors.units = `Set a valid price for "${labels[i]}".`;
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
      priceKobo,
      stock,
      active: actives[i],
    });
  }
  if (!errors.units && units.length === 0) {
    errors.units = "Add at least one sellable unit.";
  }
  if (Object.keys(errors).length > 0) return { errors };

  const db = getDb();
  const now = new Date();
  let productId = id;

  if (id) {
    await db
      .update(products)
      .set({ name, description, category, imageKey, updatedAt: now })
      .where(eq(products.id, id));
    const existing = await db
      .select({ id: productUnits.id })
      .from(productUnits)
      .where(eq(productUnits.productId, id));
    const keep = new Set(units.map((u) => u.id).filter(Boolean) as string[]);
    const remove = existing.filter((row) => !keep.has(row.id)).map((row) => row.id);
    if (remove.length > 0) {
      await db.delete(productUnits).where(inArray(productUnits.id, remove));
    }
  } else {
    productId = uid();
    await db.insert(products).values({
      id: productId,
      name,
      description,
      category,
      imageKey,
      active: true,
      createdAt: now,
      updatedAt: now,
    });
  }

  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u.id) {
      await db
        .update(productUnits)
        .set({
          unitLabel: u.label,
          priceKobo: u.priceKobo,
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
        priceKobo: u.priceKobo,
        stockQty: u.stock,
        active: u.active,
        sortOrder: i,
      });
    }
  }

  await logEvent(db, {
    type: "config_change",
    actor: `admin:${admin.id}`,
    message: `Product ${name} ${id ? "updated" : "created"} with ${units.length} unit(s)`,
  });

  revalidateCatalog();
  redirect("/admin/products");
}
