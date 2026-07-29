// Pure display helpers shared across the customer area. Safe on server and
// client. Anything engine-level lives in src/lib, not here.

import type { orders } from "@/db/schema";

/** "just now", "4m ago", "2h ago", "3d ago", then "12 Jun" */
export function relativeTime(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    timeZone: "Africa/Lagos",
  });
}

/** Time-of-day greeting in Lagos time */
export function lagosGreeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Africa/Lagos",
      hour: "numeric",
      hourCycle: "h23",
    }).format(new Date())
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** "0123456789" -> "••••6789" */
export function maskAccount(accountNumber: string): string {
  return `••••${accountNumber.slice(-4)}`;
}

type OrderStatus = (typeof orders.$inferSelect)["status"];

/**
 * What the customer should see right now. An issued card whose expiry has
 * passed reads as expired even before the sweep flips the row.
 */
export function effectiveOrderStatus(order: {
  status: OrderStatus;
  expiresAt: Date;
}): OrderStatus {
  if (order.status === "issued" && order.expiresAt.getTime() < Date.now()) return "expired";
  return order.status;
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  issued: "Ready to use",
  redeemed: "Honoured",
  settled: "Honoured",
  expired: "Expired",
  cancelled: "Cancelled",
};

export const ORDER_STATUS_TONE: Record<
  OrderStatus,
  "good" | "warn" | "bad" | "note" | "neutral" | "terra"
> = {
  issued: "terra",
  redeemed: "good",
  settled: "good",
  expired: "neutral",
  cancelled: "bad",
};

type InstallmentStatus = "scheduled" | "processing" | "paid" | "failed" | "overdue" | "waived";

export const INSTALLMENT_STATUS_LABEL: Record<InstallmentStatus, string> = {
  scheduled: "Scheduled",
  processing: "Processing",
  paid: "Paid",
  failed: "Retrying",
  overdue: "Overdue",
  waived: "Waived",
};

export const INSTALLMENT_STATUS_TONE: Record<
  InstallmentStatus,
  "good" | "warn" | "bad" | "note" | "neutral" | "terra"
> = {
  scheduled: "neutral",
  processing: "note",
  paid: "good",
  failed: "warn",
  overdue: "bad",
  waived: "neutral",
};

/** "FL-8PM3QK" -> ["FL", "8PM", "3QK"] for the spaced card face type */
export function voucherGroups(code: string): string[] {
  const body = code.replace(/^FL-/, "");
  return ["FL", body.slice(0, 3), body.slice(3)];
}
