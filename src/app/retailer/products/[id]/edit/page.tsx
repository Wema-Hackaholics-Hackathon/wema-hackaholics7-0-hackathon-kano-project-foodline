import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { getDb } from "@/db";
import { productUnits, products } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { PageTitle } from "@/components/ui";
import { ListingForm } from "../../listing-form";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit listing" };

const SUB: Record<string, string> = {
  approved: "Live in your shop. Any change here goes back to the Foodline team for review.",
  pending: "Waiting on the Foodline team. You can still change it while it waits.",
  rejected: "Sent back for a change. Fix it below and send it again.",
  archived: "Archived. Save it to send it back for review and return it to your shelf.",
};

export default async function EditListingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireRole("retailer");
  const { id } = await params;
  const db = getDb();

  const product = (await db.select().from(products).where(eq(products.id, id)).limit(1))[0];
  if (!product || product.retailerId !== user.id) notFound();

  const units = await db
    .select()
    .from(productUnits)
    .where(eq(productUnits.productId, product.id))
    .orderBy(asc(productUnits.sortOrder));

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

      <PageTitle title={product.name} sub={SUB[product.status]} />

      <ListingForm
        categories={categories}
        listing={{
          id: product.id,
          name: product.name,
          description: product.description,
          category: product.category,
          imageKey: product.imageKey,
          status: product.status,
          suggestedMarkupBps: product.suggestedMarkupBps,
          rejectionReason: product.rejectionReason,
          units: units.map((unit) => ({
            id: unit.id,
            unitLabel: unit.unitLabel,
            costKobo: unit.costKobo,
            priceKobo: unit.priceKobo,
            stockQty: unit.stockQty,
            active: unit.active,
          })),
        }}
      />
    </div>
  );
}
