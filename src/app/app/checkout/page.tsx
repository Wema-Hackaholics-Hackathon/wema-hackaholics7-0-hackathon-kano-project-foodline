import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireRole } from "@/lib/session";
import { PageTitle } from "@/components/ui";
import { CheckoutClient } from "./checkout-client";

export const metadata: Metadata = { title: "Checkout" };

export default async function CheckoutPage() {
  await requireRole("customer");
  return (
    <div className="mx-auto w-full max-w-xl animate-rise">
      <Link
        href="/app/cart"
        className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-terra-deep hover:underline"
      >
        <ChevronLeft className="size-4.5" aria-hidden />
        Back to basket
      </Link>
      <PageTitle
        title="Choose your repayment plan"
        sub="Pick how you want to repay. We debit on payday only, and the total is named before you confirm."
      />
      <CheckoutClient />
    </div>
  );
}
