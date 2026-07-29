"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers } from "@/db/schema";
import { assignLimit } from "@/lib/onboarding";
import { logEvent } from "@/lib/ledger";
import { destroySession } from "@/lib/session";
import { requireActionCustomer } from "../flow";

export type ConfirmState = { error: string | null };

/** Customer agreed with the detection: assign the limit and reveal it. */
export async function confirmSalary(_prev: ConfirmState, _formData: FormData): Promise<ConfirmState> {
  const { customer } = await requireActionCustomer(["confirm_salary"]);
  const db = getDb();
  try {
    await assignLimit(db, customer.id);
  } catch {
    return { error: "We could not set your limit just now. Give it a second and try again." };
  }
  redirect("/join/limit");
}

/**
 * Customer disputed the detection (or wants a different account, including
 * after a rejected mandate): back to the link step.
 */
export async function relinkAccount(): Promise<void> {
  const { customer } = await requireActionCustomer([
    "verify_salary",
    "confirm_salary",
    "limit_assigned",
  ]);
  const db = getDb();
  await db
    .update(customers)
    .set({ stage: "link_account", updatedAt: new Date() })
    .where(eq(customers.id, customer.id));
  await logEvent(db, {
    type: "eligibility_check",
    customerId: customer.id,
    actor: `customer:${customer.id}`,
    message: "Customer chose to relink a different salary account",
  });
  redirect("/join/link");
}

/** Not eligible yet: record the interest, then sign the customer out. */
export async function notifyWhenQualified(): Promise<void> {
  const { user, customer } = await requireActionCustomer(["verify_salary"]);
  const db = getDb();
  await logEvent(db, {
    type: "eligibility_check",
    customerId: customer.id,
    actor: `customer:${customer.id}`,
    message: `Customer asked to be notified when they qualify (${user.email})`,
  });
  await destroySession();
  redirect("/");
}
