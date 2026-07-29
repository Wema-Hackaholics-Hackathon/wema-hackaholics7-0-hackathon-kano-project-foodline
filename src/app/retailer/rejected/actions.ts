"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { retailers } from "@/db/schema";
import { apiUser } from "@/lib/session";
import { logEvent } from "@/lib/ledger";

export type ReapplyState = { error: string | null };

/**
 * Put a declined shop back in the review queue. The previous reason is cleared
 * from the record but kept in the ledger, so the admin sees the full history.
 */
export async function reapply(
  _prev: ReapplyState,
  _form: FormData
): Promise<ReapplyState> {
  const user = await apiUser("retailer");
  if (!user) return { error: "Your session has expired. Sign in again to reapply." };

  const db = getDb();
  const retailer = (
    await db.select().from(retailers).where(eq(retailers.id, user.id)).limit(1)
  )[0];
  if (!retailer) return { error: "We could not find your shop. Email support@foodline.com.ng." };
  if (retailer.status !== "rejected") redirect("/retailer");

  await db
    .update(retailers)
    .set({
      status: "pending",
      active: true,
      rejectionReason: null,
      reviewedBy: null,
      reviewedAt: null,
    })
    .where(eq(retailers.id, user.id));

  await logEvent(db, {
    type: "config_change",
    actor: `retailer:${user.id}`,
    message: `Partner store reapplied for review: ${retailer.businessName}${
      retailer.rejectionReason ? `. Previously declined for: ${retailer.rejectionReason}` : ""
    }`,
    data: { retailerId: user.id, previousReason: retailer.rejectionReason },
  });

  revalidatePath("/admin/retailers");
  revalidatePath("/retailer");
  redirect("/retailer/pending");
}
