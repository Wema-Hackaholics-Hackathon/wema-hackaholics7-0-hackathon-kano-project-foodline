"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { retailers, users } from "@/db/schema";
import { uid } from "@/lib/ids";
import { hashPassword } from "@/lib/password";
import { createSession } from "@/lib/session";
import { logEvent } from "@/lib/ledger";
import { geocodeAddress } from "@/lib/geo";
import { getConfig } from "@/lib/settings";
import { listBanks, resolveAccount, PaystackError } from "@/lib/paystack";
import {
  BUSINESS_TYPES,
  type ApplyErrors,
  type ApplyState,
  type BankOption,
  type VerifyState,
} from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Accepts 0803 123 4567, 08031234567, +2348031234567, 2348031234567
const PHONE_RE = /^(?:\+?234|0)([789]\d{9})$/;

/** Settlement banks for the picker, sorted by name. Empty list on failure. */
export async function loadBanks(): Promise<BankOption[]> {
  try {
    const banks = await listBanks();
    return banks
      .map((b) => ({ code: b.code, name: b.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

/** Paystack name check on the settlement account, before we ever pay into it. */
export async function verifyBankAccount(
  accountNumber: string,
  bankCode: string
): Promise<VerifyState> {
  const number = accountNumber.replace(/\D/g, "");
  if (!/^\d{10}$/.test(number)) {
    return { accountName: null, error: "Account numbers are 10 digits." };
  }
  if (!bankCode) {
    return { accountName: null, error: "Choose your settlement bank first." };
  }
  try {
    const result = await resolveAccount(number, bankCode);
    return { accountName: result.accountName, error: null };
  } catch (err) {
    if (err instanceof PaystackError) {
      return { accountName: null, error: `${err.message}. Check the number and try again.` };
    }
    return {
      accountName: null,
      error: "We could not reach the bank just now. Try again in a moment.",
    };
  }
}

/**
 * Create the partner account. The shop lands as pending: an admin approves it
 * before it trades, and the Paystack payout recipient is only created then.
 */
export async function submitApplication(
  _prev: ApplyState,
  form: FormData
): Promise<ApplyState> {
  const businessName = String(form.get("businessName") ?? "").trim().replace(/\s+/g, " ");
  const businessType = String(form.get("businessType") ?? "").trim();
  const yearsRaw = String(form.get("yearsTrading") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const rcNumber = String(form.get("rcNumber") ?? "").trim();
  const ownerName = String(form.get("ownerName") ?? "").trim().replace(/\s+/g, " ");
  const phoneRaw = String(form.get("phone") ?? "").replace(/[\s()-]/g, "");
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const address = String(form.get("address") ?? "").trim();
  const bankCode = String(form.get("bankCode") ?? "").trim();
  const bankName = String(form.get("bankName") ?? "").trim();
  const accountNumber = String(form.get("accountNumber") ?? "").replace(/\D/g, "");
  const resolvedName = String(form.get("resolvedName") ?? "").trim();
  const typedAccountName = String(form.get("typedAccountName") ?? "").trim();
  const skipVerification = String(form.get("skipVerification") ?? "") === "1";

  const db = getDb();
  const config = await getConfig(db);

  const errors: ApplyErrors = {};

  if (businessName.length < 2) {
    errors.businessName = "Enter the shop name your customers know.";
  }
  if (!BUSINESS_TYPES.includes(businessType as (typeof BUSINESS_TYPES)[number])) {
    errors.businessType = "Choose the description that fits your shop best.";
  }
  const yearsTrading = Number.parseInt(yearsRaw, 10);
  if (!/^\d{1,2}$/.test(yearsRaw) || Number.isNaN(yearsTrading) || yearsTrading > 80) {
    errors.yearsTrading = "Enter how many years you have been trading, 0 if you started this year.";
  }
  if (description.length < 10) {
    errors.description = "Tell us in one line what you sell, for example rice, beans and palm oil.";
  } else if (description.length > 400) {
    errors.description = "Keep this under 400 characters.";
  }
  if (rcNumber && rcNumber.length > 30) {
    errors.rcNumber = "That RC number looks too long. Check it and try again.";
  }
  if (ownerName.length < 2 || !ownerName.includes(" ")) {
    errors.ownerName = "Enter the owner's full name, first and last.";
  }
  const phoneMatch = phoneRaw.match(PHONE_RE);
  if (!phoneMatch) {
    errors.phone = "Enter a Nigerian mobile number, like 0803 123 4567 or +234 803 123 4567.";
  }
  if (!EMAIL_RE.test(email)) {
    errors.email = "Enter a valid email address. You will sign in with it.";
  }
  if (password.length < 8) {
    errors.password = "Use at least 8 characters.";
  }
  if (address.length < 10) {
    errors.address = "Enter the full shop address, including the area and state.";
  }
  if (!bankCode || !bankName) {
    errors.bankCode = "Choose the bank we should settle into.";
  }
  if (!/^\d{10}$/.test(accountNumber)) {
    errors.accountNumber = "Account numbers are 10 digits.";
  }

  // Settlement name: Paystack's answer when it was verified, the typed name
  // when demo mode let them through without a live lookup.
  let accountName = "";
  let bankVerified = false;
  if (resolvedName) {
    accountName = resolvedName;
    bankVerified = true;
  } else if (config.demoMode && skipVerification) {
    if (typedAccountName.length < 2) {
      errors.accountName = "Type the account name exactly as your bank has it.";
    }
    accountName = typedAccountName;
    bankVerified = false;
  } else {
    errors.accountName = config.demoMode
      ? "Verify the account, or use the demo path below and type the name yourself."
      : "Verify your settlement account before you submit. We only pay into a verified account.";
  }

  if (Object.keys(errors).length > 0) return { errors, emailTaken: false };

  const takenMsg =
    "This email already has a Foodline account. Sign in instead, we will take you to your shop.";
  const existing = (
    await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  )[0];
  if (existing) return { errors: { email: takenMsg }, emailTaken: true };

  const id = uid();
  const now = new Date();
  const phone = `+234${phoneMatch![1]}`;

  try {
    await db.insert(users).values({
      id,
      role: "retailer",
      name: businessName,
      email,
      phone,
      passwordHash: await hashPassword(password),
      createdAt: now,
    });
  } catch {
    // Unique email index tripped by a concurrent signup
    return { errors: { email: takenMsg }, emailTaken: true };
  }

  // Cached at signup so the nearest-store ranking never waits on a live
  // geocode. A miss is not fatal: the admin can still approve the shop.
  const geo = await geocodeAddress(address).catch(() => null);

  try {
    await db.insert(retailers).values({
      id,
      businessName,
      ownerName,
      contactPhone: phone,
      address,
      state: geo?.state ?? null,
      lga: geo?.lga ?? null,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      geoLabel: geo?.label ?? null,
      rcNumber: rcNumber || null,
      businessType,
      yearsTrading,
      description,
      settlementBankCode: bankCode,
      settlementBankName: bankName,
      settlementAccountNumber: accountNumber,
      settlementAccountName: accountName,
      bankVerified,
      status: "pending",
      active: true,
      isDemo: false,
      createdAt: now,
    });
  } catch {
    // Never strand a half-made account: drop the user row and let them retry
    await db.delete(users).where(eq(users.id, id));
    return {
      errors: {
        form: "We could not save your application just now. Nothing was created, please submit again.",
      },
      emailTaken: false,
    };
  }

  const area = geo?.label ?? address;
  await logEvent(db, {
    type: "config_change",
    actor: `retailer:${id}`,
    message: `Partner application received: ${businessName} (${businessType}), ${area}. Settlement to ${bankName} ${accountNumber}, ${
      bankVerified ? "account name verified with Paystack" : "account name not yet verified"
    }.`,
    data: { retailerId: id, bankVerified, state: geo?.state ?? null, lga: geo?.lga ?? null },
  });

  await createSession(id, "retailer");
  revalidatePath("/admin/retailers");
  redirect("/retailer/pending");
}
