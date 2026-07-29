import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ChevronRight, Clock, Package, PhoneCall, Store } from "lucide-react";
import { getDb } from "@/db";
import { retailers } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { logout } from "@/lib/auth-actions";
import { formatDate, toDateOnly } from "@/lib/dates";
import { Button, Card, Notice, Pill } from "@/components/ui";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Application under review" };

/** "0123456789" -> "••••6789", so a shoulder-surfer learns nothing. */
function maskAccount(accountNumber: string): string {
  return `••••${accountNumber.slice(-4)}`;
}

/** "+2348031234567" -> "+234 803 123 4567" */
function formatPhone(phone: string): string {
  const match = phone.match(/^\+234(\d{3})(\d{3})(\d{4})$/);
  return match ? `+234 ${match[1]} ${match[2]} ${match[3]}` : phone;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-crust/50 py-3 last:border-0">
      <span className="text-[13px] text-ash">{label}</span>
      <span className="tnum min-w-0 text-right text-sm font-medium text-espresso">{value}</span>
    </div>
  );
}

export default async function RetailerPendingPage() {
  const user = await requireRole("retailer");
  const db = getDb();
  const retailer = (
    await db.select().from(retailers).where(eq(retailers.id, user.id)).limit(1)
  )[0];

  if (!retailer) redirect("/retailer");
  if (retailer.status === "rejected") redirect("/retailer/rejected");
  if (retailer.status !== "pending") redirect("/retailer");

  const areaFromParts = [retailer.lga, retailer.state].filter(Boolean).join(", ");
  const area = retailer.geoLabel || areaFromParts || retailer.address || "your area";
  const phone = retailer.contactPhone
    ? formatPhone(retailer.contactPhone)
    : "the number on your application";
  const submitted = formatDate(toDateOnly(retailer.createdAt));

  const steps = [
    {
      icon: Clock,
      title: "We review your application",
      body: `A member of the partner team checks your shop details and settlement account. This normally takes one working day, and we started on ${submitted}.`,
    },
    {
      icon: PhoneCall,
      title: "We call if anything is unclear",
      body: `The team calls ${phone} rather than send your application back. Keep the line open so one small question does not hold up your approval.`,
    },
    {
      icon: Store,
      title: "Your shop goes live",
      body: `Once approved, customers near ${area} can shop your shelf and send their Foodline Card to your counter. Paystack settles you on every order you hand over.`,
    },
  ];

  return (
    <div className="animate-rise space-y-5">
      <div>
        <Pill tone="warn">
          <Clock className="size-3.5" aria-hidden />
          Under review
        </Pill>
        <h1 className="mt-3 font-display text-2xl leading-tight text-espresso md:text-[28px]">
          Your application is with our partner team
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ash">
          Thank you for bringing {retailer.businessName} to Foodline. You submitted on {submitted}.
          Nothing else is needed from you right now, though you can start listing your products
          below.
        </p>
      </div>

      {!retailer.bankVerified && (
        <Notice tone="warn" title="Settlement account still to be verified">
          We have not confirmed the name on {retailer.settlementBankName}{" "}
          {maskAccount(retailer.settlementAccountNumber)} with the bank yet. The partner team will
          verify it during review, before your first payout. If the details below are wrong, email
          support@foodline.com.ng and we will fix them.
        </Notice>
      )}

      <Card className="p-0">
        <div className="border-b border-crust/60 px-5 py-4">
          <h2 className="font-display text-lg text-espresso">What you submitted</h2>
          <p className="mt-1 text-[13px] leading-snug text-ash">
            Check this over. If anything is wrong, email support@foodline.com.ng and we will correct
            it before approval.
          </p>
        </div>
        <div className="px-5 py-1">
          <Row label="Shop name" value={retailer.businessName} />
          <Row label="Business type" value={retailer.businessType ?? "Not stated"} />
          <Row label="Area" value={area} />
          <Row label="Owner" value={retailer.ownerName ?? user.name} />
          <Row label="Phone" value={phone} />
          <Row
            label="Settlement account"
            value={`${retailer.settlementBankName} ${maskAccount(
              retailer.settlementAccountNumber
            )}, ${retailer.settlementAccountName}`}
          />
        </div>
      </Card>

      <section aria-labelledby="next-heading">
        <h2 id="next-heading" className="mb-2 text-sm font-semibold text-cocoa">
          What happens next
        </h2>
        <Card className="p-0">
          <ol className="divide-y divide-crust/60">
            {steps.map((step, i) => (
              <li key={step.title} className="flex gap-4 px-5 py-4">
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-full bg-terra-tint text-terra-deep"
                  aria-hidden
                >
                  <step.icon className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-espresso">
                    <span className="tnum text-ash">{i + 1}. </span>
                    {step.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ash">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      <Link
        href="/retailer/products"
        className="group block rounded-lg"
        aria-label="Start listing your products"
      >
        <div className="flex items-center gap-5 rounded-lg border border-cream/10 bg-espresso p-6 text-cream shadow-2 transition-colors group-hover:bg-espresso-2">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-mango/15 text-mango">
            <Package className="size-7" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display text-xl leading-tight">Start listing while you wait</p>
            <p className="mt-1 text-sm leading-relaxed text-cream/70">
              Add your foodstuff unit by unit at the price you need to receive. Your listings are
              reviewed alongside your shop, so they go live the same day you do.
            </p>
          </div>
          <ChevronRight
            className="size-5 shrink-0 text-cream/60 transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </div>
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="text-[13px] text-ash">
          Questions about your application? Email support@foodline.com.ng
        </p>
        <form action={logout}>
          <Button type="submit" variant="secondary" size="sm">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  );
}
