"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { verifyPassword } from "@/lib/password";
import { createSession, HOME_PATH, type Role } from "@/lib/session";

export type LoginState = { error: string | null };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "Enter your email and password." };
  }

  const db = getDb();
  const user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "That email or password is not correct. Try again." };
  }

  await createSession(user.id, user.role as Role);
  const home = HOME_PATH[user.role as Role];
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : home);
}
