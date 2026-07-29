import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ChevronLeft } from "lucide-react";
import { getDb } from "@/db";
import { productUnits, products } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { Notice } from "@/components/ui";
import { ProductImage } from "../product-image";
import { UnitPicker } from "./unit-picker";

export const metadata: Metadata = { title: "Shop foodstuff" };

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  await requireRole("customer");
  const { productId } = await params;
  const db = getDb();

  const product = (
    await db
      .select()
      .from(products)
      .where(and(eq(products.id, productId), eq(products.active, true)))
      .limit(1)
  )[0];
  if (!product) notFound();

  const units = await db
    .select({
      id: productUnits.id,
      unitLabel: productUnits.unitLabel,
      priceKobo: productUnits.priceKobo,
      stockQty: productUnits.stockQty,
    })
    .from(productUnits)
    .where(and(eq(productUnits.productId, product.id), eq(productUnits.active, true)))
    .orderBy(asc(productUnits.sortOrder));

  return (
    <div className="animate-rise">
      <Link
        href="/app/shop"
        className="mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-terra-deep hover:underline"
      >
        <ChevronLeft className="size-4.5" aria-hidden />
        Back to the market
      </Link>

      <div className="md:grid md:grid-cols-2 md:gap-8">
        <div className="overflow-hidden rounded-lg bg-wheat shadow-1">
          <ProductImage
            src={product.imageKey}
            alt={product.name}
            className="aspect-square w-full md:aspect-[4/3]"
            iconClassName="size-12"
          />
        </div>

        <div className="mt-5 md:mt-0">
          <p className="text-[12px] font-medium uppercase tracking-wide text-ash">
            {product.category}
          </p>
          <h1 className="mt-1 font-display text-2xl leading-tight text-espresso md:text-[28px]">
            {product.name}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-cocoa">{product.description}</p>

          {units.length === 0 ? (
            <Notice tone="note" className="mt-6" title="Not available right now">
              This item has no sizes on sale at the moment. Check back soon, or browse the rest of
              the market.
            </Notice>
          ) : (
            <UnitPicker productName={product.name} units={units} />
          )}
        </div>
      </div>
    </div>
  );
}
