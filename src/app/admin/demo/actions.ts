"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { getEnv } from "@/lib/env";
import { apiUser } from "@/lib/session";
import { getConfig, updateConfig } from "@/lib/settings";
import { logEvent } from "@/lib/ledger";

export type ActionState = { error: string | null; ok?: string };

export async function toggleDemoMode(): Promise<void> {
  const admin = await apiUser("admin");
  if (!admin) return;
  const db = getDb();
  const config = await getConfig(db);
  const next = !config.demoMode;
  await updateConfig(db, { demoMode: next }, `admin:${admin.id}`);
  await logEvent(db, {
    type: "config_change",
    actor: `admin:${admin.id}`,
    message: `Demo mode turned ${next ? "on" : "off"}`,
  });
  revalidatePath("/admin/demo");
  revalidatePath("/login");
}

export async function reseed(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await apiUser("admin");
  if (!admin) return { error: "Your session expired. Sign in again." };
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "RESEED") {
    return { error: "Type RESEED to confirm." };
  }
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const host = h.get("host");
  try {
    const res = await fetch(`${proto}://${host}/api/dev/seed`, {
      method: "POST",
      headers: { "x-seed-secret": getEnv("SEED_SECRET") },
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      return { error: body?.error ?? `Seed failed with status ${res.status}.` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Could not reach the seed endpoint." };
  }
  redirect("/login");
}
