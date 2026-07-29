"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { createSession, newUserId } from "@/lib/session";
import { loadJoin, resumePath } from "./flow";

export type AccountErrors = {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
};

export type AccountState = { errors: AccountErrors; error: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Accepts 0803 123 4567, 08031234567, +2348031234567, 2348031234567
const PHONE_RE = /^(?:\+?234|0)([789]\d{9})$/;

export async function createAccount(
  _prev: AccountState,
  formData: FormData
): Promise<AccountState> {
  // Already signed in: resume wherever the journey stopped
  const ctx = await loadJoin();
  if (ctx.user) redirect(resumePath(ctx.user, ctx.customer));

  const name = String(formData.get("name") ?? "").trim().replace(/\s+/g, " ");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const phoneRaw = String(formData.get("phone") ?? "").replace(/[\s()-]/g, "");
  const password = String(formData.get("password") ?? "");

  const errors: AccountErrors = {};
  if (name.length < 2) {
    errors.name = "Enter your name as your bank knows it.";
  } else if (!name.includes(" ")) {
    errors.name = "Enter your full name, first and last.";
  }
  if (!EMAIL_RE.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  const phoneMatch = phoneRaw.match(PHONE_RE);
  if (!phoneMatch) {
    errors.phone = "Enter a Nigerian mobile number, like 0803 123 4567 or +234 803 123 4567.";
  }
  if (password.length < 8) {
    errors.password = "Use at least 8 characters.";
  }
  if (Object.keys(errors).length > 0) return { errors, error: null };

  const phone = `+234${phoneMatch![1]}`;
  const db = getDb();

  const duplicateMsg = "This email already has a Foodline account. Sign in instead, your progress is saved.";
  const existing = (
    await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  )[0];
  if (existing) return { errors: { email: duplicateMsg }, error: null };

  const id = newUserId();
  try {
    await db.insert(users).values({
      id,
      role: "customer",
      name,
      email,
      phone,
      passwordHash: await hashPassword(password),
      createdAt: new Date(),
    });
  } catch {
    // Unique email index tripped by a concurrent signup
    return { errors: { email: duplicateMsg }, error: null };
  }

  await createSession(id, "customer");
  redirect("/join/profile");
}
