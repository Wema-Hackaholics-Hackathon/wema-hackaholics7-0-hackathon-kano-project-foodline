"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { linkMonoAccount } from "@/lib/onboarding";
import { linkDemoBankAccount } from "@/lib/demo";
import { getConfig } from "@/lib/settings";
import { MonoError } from "@/lib/mono";
import { requireActionCustomer } from "../flow";

export type LinkResult = { error: string } | undefined;

/** Exchange the Connect widget's code for a linked account, then move on. */
export async function submitMonoCode(code: string): Promise<LinkResult> {
  const { customer } = await requireActionCustomer(["link_account"]);
  if (typeof code !== "string" || code.length === 0) {
    return { error: "The bank widget did not hand back a code. Try connecting again." };
  }

  const db = getDb();
  try {
    await linkMonoAccount(db, customer.id, code);
  } catch (err) {
    if (err instanceof MonoError) return { error: err.message };
    return { error: "We could not secure the connection just now. Try again in a moment." };
  }
  redirect("/join/salary");
}

/** Demo path: seed a realistic salary account so the flow can be explored. */
export async function linkDemoAccount(): Promise<LinkResult> {
  const { customer } = await requireActionCustomer(["link_account"]);
  const db = getDb();
  const config = await getConfig(db);
  if (!config.demoMode) {
    return { error: "Demo mode is switched off. Connect a real account with Mono instead." };
  }
  try {
    await linkDemoBankAccount(db, customer.id);
  } catch (err) {
    return {
      error:
        err instanceof Error
          ? err.message
          : "We could not set up the demo account. Try again in a moment.",
    };
  }
  redirect("/join/salary");
}
