"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { apiUser } from "@/lib/session";
import {
  approveProduct,
  approveRetailer,
  rejectProduct,
  rejectRetailer,
} from "@/lib/approvals";
import {
  MIN_REASON_CHARS,
  formatBps,
  parseMarkupPercent,
  type ReviewState,
} from "./review-state";

// A decision removes the card from the queue, so the outcome cannot live in
// the form state: the component that held it has already unmounted. It travels
// in the URL instead, where the banner survives the revalidated re-render.

function refresh(): void {
  revalidatePath("/admin/approvals");
  revalidatePath("/admin");
  revalidatePath("/admin/products");
  revalidatePath("/admin/retailers");
  revalidatePath("/app/shop");
}

function done(tab: "shops" | "listings", tone: "good" | "warn", message: string): never {
  refresh();
  return redirect(
    `/admin/approvals?tab=${tab}&tone=${tone}&notice=${encodeURIComponent(message.slice(0, 300))}`
  );
}

export async function approveShop(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const admin = await apiUser("admin");
  if (!admin) return { error: "Your session expired. Sign in again to review applications." };

  const retailerId = String(form.get("retailerId") ?? "").trim();
  const name = String(form.get("businessName") ?? "").trim() || "The shop";
  if (!retailerId) return { error: "That application could not be found. Refresh the queue." };

  const result = await approveRetailer(getDb(), retailerId, admin.id);
  if (!result.ok) {
    return { error: "That application is no longer in the queue. Refresh to see the latest." };
  }
  if (result.warning) return done("shops", "warn", result.warning);
  return done("shops", "good", `${name} is approved and can start accepting cards.`);
}

export async function declineShop(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const admin = await apiUser("admin");
  if (!admin) return { error: "Your session expired. Sign in again to review applications." };

  const retailerId = String(form.get("retailerId") ?? "").trim();
  const name = String(form.get("businessName") ?? "").trim() || "The shop";
  const reason = String(form.get("reason") ?? "").trim();
  if (!retailerId) return { error: "That application could not be found. Refresh the queue." };
  if (reason.length < MIN_REASON_CHARS) {
    return { error: `Give the shop a reason of at least ${MIN_REASON_CHARS} characters.` };
  }

  await rejectRetailer(getDb(), retailerId, admin.id, reason);
  return done("shops", "warn", `${name} was declined. The reason is saved on the application.`);
}

export async function approveListing(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const admin = await apiUser("admin");
  if (!admin) return { error: "Your session expired. Sign in again to review listings." };

  const productId = String(form.get("productId") ?? "").trim();
  const name = String(form.get("productName") ?? "").trim() || "The listing";
  if (!productId) return { error: "That listing could not be found. Refresh the queue." };

  const markupBps = parseMarkupPercent(String(form.get("markupPercent") ?? ""));
  if (markupBps === null) {
    return { error: "Set a markup between 0% and 200% before publishing." };
  }

  const result = await approveProduct(getDb(), productId, admin.id, markupBps);
  if (!result.ok) {
    return { error: "That listing is no longer in the queue. Refresh to see the latest." };
  }
  return done(
    "listings",
    "good",
    `${name} is live at ${formatBps(markupBps)} markup, ${result.priced} unit${
      result.priced === 1 ? "" : "s"
    } repriced.`
  );
}

export async function declineListing(_prev: ReviewState, form: FormData): Promise<ReviewState> {
  const admin = await apiUser("admin");
  if (!admin) return { error: "Your session expired. Sign in again to review listings." };

  const productId = String(form.get("productId") ?? "").trim();
  const name = String(form.get("productName") ?? "").trim() || "The listing";
  const reason = String(form.get("reason") ?? "").trim();
  if (!productId) return { error: "That listing could not be found. Refresh the queue." };
  if (reason.length < MIN_REASON_CHARS) {
    return { error: `Give the shop a reason of at least ${MIN_REASON_CHARS} characters.` };
  }

  await rejectProduct(getDb(), productId, admin.id, reason);
  return done("listings", "warn", `${name} was declined. The shop can edit it and send it again.`);
}
