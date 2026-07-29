"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { retailers, users } from "@/db/schema";
import { apiUser } from "@/lib/session";
import { uid } from "@/lib/ids";
import { hashPassword } from "@/lib/password";
import { logEvent } from "@/lib/ledger";
import {
  createTransferRecipient,
  listBanks,
  resolveAccount,
  PaystackError,
} from "@/lib/paystack";

export type ResolveState = {
  accountName: string | null;
  error: string | null;
};

export type RetailerState = { errors: Record<string, string> };

export async function loadBanks(): Promise<{ code: string; name: string }[]> {
  const admin = await apiUser("admin");
  if (!admin) return [];
  try {
    const banks = await listBanks();
    return banks
      .map((b) => ({ code: b.code, name: b.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

export async function resolveSettlementAccount(
  _prev: ResolveState,
  form: FormData
): Promise<ResolveState> {
  const admin = await apiUser("admin");
  if (!admin) return { accountName: null, error: "Your session expired." };

  const accountNumber = String(form.get("accountNumber") ?? "").trim();
  const bankCode = String(form.get("bankCode") ?? "").trim();
  if (!/^\d{10}$/.test(accountNumber)) {
    return { accountName: null, error: "Account numbers are 10 digits." };
  }
  if (!bankCode) return { accountName: null, error: "Choose the settlement bank first." };

  try {
    const result = await resolveAccount(accountNumber, bankCode);
    return { accountName: result.accountName, error: null };
  } catch (err) {
    const message =
      err instanceof PaystackError ? err.message : "Could not reach Paystack. Try again.";
    return { accountName: null, error: message };
  }
}

export async function toggleRetailerActive(retailerId: string, active: boolean): Promise<void> {
  const admin = await apiUser("admin");
  if (!admin) return;
  const db = getDb();
  await db.update(retailers).set({ active }).where(eq(retailers.id, retailerId));
  await logEvent(db, {
    type: "config_change",
    actor: `admin:${admin.id}`,
    message: `Retailer ${active ? "activated" : "deactivated"}`,
    data: { retailerId },
  });
  revalidatePath("/admin/retailers");
}

export async function relinkRecipient(retailerId: string): Promise<void> {
  const admin = await apiUser("admin");
  if (!admin) return;
  const db = getDb();
  const retailer = (
    await db.select().from(retailers).where(eq(retailers.id, retailerId)).limit(1)
  )[0];
  if (!retailer) return;
  try {
    const code = await createTransferRecipient({
      name: retailer.settlementAccountName,
      accountNumber: retailer.settlementAccountNumber,
      bankCode: retailer.settlementBankCode,
    });
    await db
      .update(retailers)
      .set({ paystackRecipientCode: code })
      .where(eq(retailers.id, retailerId));
    await logEvent(db, {
      type: "config_change",
      actor: `admin:${admin.id}`,
      message: `Paystack recipient linked for ${retailer.businessName}`,
    });
  } catch (err) {
    await logEvent(db, {
      type: "config_change",
      actor: `admin:${admin.id}`,
      message: `Paystack recipient linking failed for ${retailer.businessName}: ${
        err instanceof Error ? err.message : "unknown error"
      }`,
    });
  }
  revalidatePath("/admin/retailers");
}

export async function createRetailer(
  _prev: RetailerState,
  form: FormData
): Promise<RetailerState> {
  const admin = await apiUser("admin");
  if (!admin) return { errors: { form: "Your session expired. Sign in again." } };

  const businessName = String(form.get("businessName") ?? "").trim();
  const contactPhone = String(form.get("contactPhone") ?? "").trim();
  const address = String(form.get("address") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const bankCode = String(form.get("bankCode") ?? "").trim();
  const bankName = String(form.get("bankName") ?? "").trim();
  const accountNumber = String(form.get("accountNumber") ?? "").trim();
  const accountName = String(form.get("resolvedName") ?? "").trim();

  const errors: Record<string, string> = {};
  if (!businessName) errors.businessName = "Enter the shop name customers will see.";
  if (!email) errors.email = "Enter a login email for the shop.";
  if (password.length < 8) errors.password = "The temporary password needs at least 8 characters.";
  if (!accountName) errors.accountNumber = "Verify the settlement account before saving.";
  if (!bankCode) errors.bankCode = "Choose the settlement bank.";
  if (Object.keys(errors).length > 0) return { errors };

  const db = getDb();
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return { errors: { email: "That email is already registered." } };
  }

  const id = uid();
  const now = new Date();
  await db.insert(users).values({
    id,
    role: "retailer",
    name: businessName,
    email,
    phone: contactPhone || null,
    passwordHash: await hashPassword(password),
    createdAt: now,
  });

  let recipientCode: string | null = null;
  let recipientError: string | null = null;
  try {
    recipientCode = await createTransferRecipient({
      name: accountName,
      accountNumber,
      bankCode,
    });
  } catch (err) {
    recipientError = err instanceof Error ? err.message : "Paystack recipient could not be created";
  }

  await db.insert(retailers).values({
    id,
    businessName,
    contactPhone: contactPhone || null,
    address: address || null,
    settlementBankCode: bankCode,
    settlementBankName: bankName,
    settlementAccountNumber: accountNumber,
    settlementAccountName: accountName,
    paystackRecipientCode: recipientCode,
    active: true,
    isDemo: false,
    createdAt: now,
  });

  await logEvent(db, {
    type: "config_change",
    actor: `admin:${admin.id}`,
    message: `Retailer ${businessName} onboarded, settlement to ${bankName} ${accountNumber} (${accountName})${
      recipientError ? `; Paystack recipient pending: ${recipientError}` : ""
    }`,
  });

  revalidatePath("/admin/retailers");
  redirect("/admin/retailers");
}
