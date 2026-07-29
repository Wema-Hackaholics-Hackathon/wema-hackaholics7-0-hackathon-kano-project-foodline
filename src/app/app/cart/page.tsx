import type { Metadata } from "next";
import { requireRole } from "@/lib/session";
import { PageTitle } from "@/components/ui";
import { CartClient } from "./cart-client";

export const metadata: Metadata = { title: "Your basket" };

export default async function CartPage() {
  await requireRole("customer");
  return (
    <div className="mx-auto w-full max-w-xl animate-rise">
      <PageTitle title="Your basket" sub="Prices and stock are checked live before checkout." />
      <CartClient />
    </div>
  );
}
