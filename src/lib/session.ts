import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { sessions, users } from "@/db/schema";
import { randomToken, sha256Hex, uid } from "./ids";

const COOKIE = "fl_session";
const SESSION_DAYS = 7;

export type Role = "customer" | "retailer" | "admin";

export type SessionUser = {
  id: string;
  role: Role;
  name: string;
  email: string;
};

export async function createSession(userId: string, role: Role): Promise<void> {
  const db = getDb();
  const token = randomToken(32);
  const now = Date.now();
  await db.insert(sessions).values({
    id: await sha256Hex(token),
    userId,
    role,
    createdAt: new Date(now),
    expiresAt: new Date(now + SESSION_DAYS * 86_400_000),
  });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = getDb();
    await db.delete(sessions).where(eq(sessions.id, await sha256Hex(token)));
  }
  jar.delete(COOKIE);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      role: users.role,
      name: users.name,
      email: users.email,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.id, await sha256Hex(token)))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  return { id: row.id, role: row.role as Role, name: row.name, email: row.email };
}

const LOGIN_PATH: Record<Role, string> = {
  customer: "/login",
  retailer: "/login",
  admin: "/login",
};

export const HOME_PATH: Record<Role, string> = {
  customer: "/app",
  retailer: "/retailer",
  admin: "/admin",
};

/** Server-component/route guard. Redirects to login or the user's own home. */
export async function requireRole(role: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(`${LOGIN_PATH[role]}?next=${encodeURIComponent(HOME_PATH[role])}`);
  if (user.role !== role) redirect(HOME_PATH[user.role]);
  return user;
}

/** API-route guard: returns null instead of redirecting. */
export async function apiUser(role?: Role): Promise<SessionUser | null> {
  const user = await getSessionUser();
  if (!user) return null;
  if (role && user.role !== role) return null;
  return user;
}

export function newUserId(): string {
  return uid();
}
