"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { apiUser } from "@/lib/session";
import { logEvent } from "@/lib/ledger";
import { CANCEL_REQUEST_MESSAGE } from "./constants";

/**
 * Records the request for the operations team. It deliberately does not
 * touch the mandate: cancellation is handled by a human who calls the
 * customer back, so the copy must not promise an instant change.
 */
export async function requestMandateCancellation(): Promise<void> {
  const user = await apiUser("customer");
  if (!user) return;
  const db = getDb();
  await logEvent(db, {
    type: "mandate_event",
    customerId: user.id,
    actor: `customer:${user.id}`,
    message: CANCEL_REQUEST_MESSAGE,
  });
  revalidatePath("/app/support");
}
