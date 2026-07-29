import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getDb } from "@/db";
import { products } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { PageTitle } from "@/components/ui";
import { ListingForm } from "../listing-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add a product" };

export default async function NewListingPage() {
  await requireRole("retailer");
  const db = getDb();

  const categories = [
    ...new Set(
      (await db.select({ category: products.category }).from(products)).map((row) => row.category)
    ),
  ].sort();

  return (
    <div className="animate-rise space-y-5">
      <Link
        href="/retailer/products"
        className="inline-flex h-11 items-center gap-1 text-sm font-medium text-terra-deep hover:underline"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Your products
      </Link>

      <PageTitle
        title="Add a product"
        sub="Tell us what you sell and what you need to receive for it. The Foodline team sets the shelf price and approves the listing before customers see it."
      />

      <ListingForm categories={categories} />
    </div>
  );
}
