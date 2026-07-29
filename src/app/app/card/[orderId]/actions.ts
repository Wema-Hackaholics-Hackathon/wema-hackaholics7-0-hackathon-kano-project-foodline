"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { apiUser } from "@/lib/session";
import { confirmByCustomer } from "@/lib/settlement";

export type CollectState = {
  state: "idle" | "awaiting_retailer" | "settled";
  error: string | null;
};

/**
 * The customer's half of the handover. Money moves only when the store has
 * confirmed too, so tapping this early is safe: it just waits.
 */
export async function confirmCollection(
  _prev: CollectState,
  form: FormData
): Promise<CollectState> {
  const user = await apiUser("customer");
  if (!user) {
    return { state: "idle", error: "Your session has ended. Sign in again to continue." };
  }
  const orderId = String(form.get("orderId") ?? "");
  const db = getDb();

  const result = await confirmByCustomer(db, { orderId, customerId: user.id });
  if (!result.ok) return { state: "idle", error: result.error };

  revalidatePath(`/app/card/${orderId}`);
  revalidatePath("/app");
  revalidatePath("/app/cards");

  return {
    state: result.state === "settled" ? "settled" : "awaiting_retailer",
    error: null,
  };
}
