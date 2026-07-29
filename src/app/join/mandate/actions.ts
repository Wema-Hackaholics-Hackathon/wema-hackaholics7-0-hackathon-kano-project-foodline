"use server";

import { getDb } from "@/db";
import { createStandingMandate } from "@/lib/onboarding";
import { createDemoMandate } from "@/lib/demo";
import { MonoError, type TransferDestination } from "@/lib/mono";
import { requireActionCustomer } from "../flow";

export type CreateMandateResult =
  | { error: string }
  | {
      ok: true;
      autoApproved: boolean;
      destinations: TransferDestination[] | null;
      createdAtMs: number;
    };

/** Real path: create the standing Mono e-mandate for this customer. */
export async function createRealMandate(): Promise<CreateMandateResult> {
  const { customer } = await requireActionCustomer(["limit_assigned"]);
  const db = getDb();
  try {
    const result = await createStandingMandate(db, customer.id);
    return {
      ok: true,
      autoApproved: result.autoApproved,
      destinations: (result.transferDestinations as TransferDestination[] | null) ?? null,
      createdAtMs: Date.now(),
    };
  } catch (err) {
    if (err instanceof MonoError) return { error: err.message };
    return {
      error:
        err instanceof Error && err.message === "No linked bank account"
          ? "We could not find your linked bank account. Relink it and try again."
          : "We could not create the mandate just now. Try again in a moment.",
    };
  }
}

export type DemoMandateResult = { error: string } | { ok: true };

/** Demo path: instantly-approved mandate so the flow can be shown on stage. */
export async function simulateDemoMandate(): Promise<DemoMandateResult> {
  const { customer } = await requireActionCustomer(["limit_assigned"]);
  if (!customer.isDemo) {
    return { error: "This shortcut only works on demo accounts. Create the real mandate instead." };
  }
  const db = getDb();
  try {
    await createDemoMandate(db, customer.id);
    return { ok: true };
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "We could not approve the demo mandate. Try again in a moment.",
    };
  }
}
