import Link from "next/link";
import { ClipboardCheck, Package, Store } from "lucide-react";
import { getDb } from "@/db";
import { listPendingProducts, listPendingRetailers, pendingCounts } from "@/lib/approvals";
import { formatDate, toDateOnly } from "@/lib/dates";
import { Card, EmptyState, Notice, PageTitle, cn, type Tone } from "@/components/ui";
import { ShopApplicationCard } from "./shop-card";
import { ListingReviewCard } from "./listing-card";

export const dynamic = "force-dynamic";

type Tab = "shops" | "listings";

const NOTICE_TONES: Record<string, Tone> = { good: "good", warn: "warn", bad: "bad" };

export default async function ApprovalsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; notice?: string; tone?: string }>;
}) {
  const { tab, notice, tone } = await searchParams;
  const db = getDb();

  const [counts, shops, listings] = await Promise.all([
    pendingCounts(db),
    listPendingRetailers(db),
    listPendingProducts(db),
  ]);

  // Land on whichever queue actually has work waiting, unless a tab was asked for.
  const active: Tab =
    tab === "listings"
      ? "listings"
      : tab === "shops"
        ? "shops"
        : counts.retailers === 0 && counts.products > 0
          ? "listings"
          : "shops";

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "shops", label: "Shop applications", count: counts.retailers },
    { key: "listings", label: "Product listings", count: counts.products },
  ];

  return (
    <div className="space-y-5">
      <PageTitle
        title="Approvals"
        sub={
          counts.total === 0
            ? "Nothing is waiting on a decision right now."
            : `${counts.total} item${counts.total === 1 ? "" : "s"} waiting: ${
                counts.retailers
              } shop application${counts.retailers === 1 ? "" : "s"}, ${
                counts.products
              } product listing${counts.products === 1 ? "" : "s"}.`
        }
      />

      {notice && (
        <Notice tone={NOTICE_TONES[tone ?? ""] ?? "note"}>
          <span className="flex flex-wrap items-baseline justify-between gap-3">
            <span>{notice}</span>
            <Link href={`/admin/approvals?tab=${active}`} className="shrink-0 text-[13px]">
              Dismiss
            </Link>
          </span>
        </Notice>
      )}

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Approval queues">
        {tabs.map((t) => {
          const on = active === t.key;
          return (
            <Link
              key={t.key}
              href={`/admin/approvals?tab=${t.key}`}
              role="tab"
              aria-selected={on}
              className={cn(
                "inline-flex items-center gap-2 h-11 px-4 rounded-full text-sm font-medium transition-colors",
                on ? "bg-terra text-white" : "bg-white border border-crust text-cocoa hover:bg-cream"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "tnum rounded-full px-2 py-0.5 text-xs",
                  on
                    ? "bg-white/20 text-white"
                    : t.count > 0
                      ? "bg-warn-tint text-warn"
                      : "bg-wheat text-ash"
                )}
              >
                {t.count}
              </span>
            </Link>
          );
        })}
      </div>

      {active === "shops" ? (
        shops.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Store className="size-6" />}
              title="Nothing waiting"
              body="New shop applications and product listings land here. Approve a shop before it can trade, and set the markup before a listing goes on the shelf."
              action={
                counts.products > 0 ? (
                  <Link
                    href="/admin/approvals?tab=listings"
                    className="text-sm text-terra-deep hover:underline"
                  >
                    {counts.products} product listing{counts.products === 1 ? "" : "s"} are waiting
                  </Link>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="space-y-4">
            {shops.map((shop) => (
              <ShopApplicationCard
                key={shop.id}
                shop={{
                  id: shop.id,
                  businessName: shop.businessName,
                  ownerName: shop.ownerName,
                  email: shop.email,
                  contactPhone: shop.contactPhone,
                  address: shop.address,
                  state: shop.state,
                  lga: shop.lga,
                  rcNumber: shop.rcNumber,
                  businessType: shop.businessType,
                  yearsTrading: shop.yearsTrading,
                  description: shop.description,
                  bankName: shop.bankName,
                  accountNumber: shop.accountNumber,
                  accountName: shop.accountName,
                  bankVerified: shop.bankVerified,
                  appliedOn: formatDate(toDateOnly(shop.createdAt)),
                }}
              />
            ))}
          </div>
        )
      ) : listings.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package className="size-6" />}
            title="Nothing waiting"
            body="New shop applications and product listings land here. Approve a shop before it can trade, and set the markup before a listing goes on the shelf."
            action={
              counts.retailers > 0 ? (
                <Link
                  href="/admin/approvals?tab=shops"
                  className="text-sm text-terra-deep hover:underline"
                >
                  {counts.retailers} shop application{counts.retailers === 1 ? "" : "s"} are waiting
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {listings.map((listing) => (
            <ListingReviewCard
              key={listing.id}
              listing={{
                id: listing.id,
                name: listing.name,
                description: listing.description,
                category: listing.category,
                imageKey: listing.imageKey,
                suggestedMarkupBps: listing.suggestedMarkupBps,
                storeName: listing.storeName,
                submittedOn: formatDate(toDateOnly(listing.createdAt)),
                units: listing.units,
              }}
            />
          ))}
        </div>
      )}

      <Card className="bg-wheat/50 border-crust/60">
        <div className="flex items-start gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white text-terra">
            <ClipboardCheck className="size-4.5" aria-hidden />
          </span>
          <p className="text-[13px] text-ash leading-relaxed">
            Every decision here is written to the{" "}
            <Link href="/admin/ledger" className="text-terra-deep hover:underline">
              audit ledger
            </Link>{" "}
            with the markup you set. The shop is settled its cost on each sale, Foodline keeps the
            markup, and the customer only ever sees one price.
          </p>
        </div>
      </Card>
    </div>
  );
}
