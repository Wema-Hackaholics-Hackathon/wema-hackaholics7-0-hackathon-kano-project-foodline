import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { RedeemFlow } from "./redeem-flow";

export const metadata: Metadata = { title: "Accept a card" };

export default async function RedeemPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  await requireRole("retailer");
  const { token } = await searchParams;

  return <RedeemFlow initialToken={token} />;
}
