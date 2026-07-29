import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { Mail, MessageSquareText } from "lucide-react";
import { getDb } from "@/db";
import { retailers } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { logout } from "@/lib/auth-actions";
import { formatDate, toDateOnly } from "@/lib/dates";
import { Button, Card, Notice } from "@/components/ui";
import { ReapplyForm } from "./reapply-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Application decision" };

export default async function RetailerRejectedPage() {
  const user = await requireRole("retailer");
  const db = getDb();
  const retailer = (
    await db.select().from(retailers).where(eq(retailers.id, user.id)).limit(1)
  )[0];

  if (!retailer) redirect("/retailer");
  if (retailer.status === "pending") redirect("/retailer/pending");
  if (retailer.status !== "rejected") redirect("/retailer");

  const decidedOn = retailer.reviewedAt ? formatDate(toDateOnly(retailer.reviewedAt)) : null;

  return (
    <div className="animate-rise space-y-5">
      <div>
        <h1 className="font-display text-2xl leading-tight text-espresso md:text-[28px]">
          We could not approve {retailer.businessName} this time
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ash">
          {decidedOn
            ? `Our partner team reviewed your application on ${decidedOn}.`
            : "Our partner team has reviewed your application."}{" "}
          This decision is not final. Settle the point below and send your application back in, and
          we will look at it again.
        </p>
      </div>

      {retailer.rejectionReason ? (
        <Notice tone="warn" title="What the reviewer noted">
          {retailer.rejectionReason}
        </Notice>
      ) : (
        <Notice tone="note" title="No reason was recorded">
          The reviewer did not leave a note. Email support@foodline.com.ng with your shop name and
          we will tell you exactly what is missing.
        </Notice>
      )}

      <Card className="space-y-4">
        <div>
          <h2 className="font-display text-lg text-espresso">How to put it right</h2>
          <p className="mt-1 text-[13px] leading-snug text-ash">
            Two ways forward, and you can use both.
          </p>
        </div>

        <ol className="space-y-4">
          <li className="flex gap-4">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-terra-tint text-terra-deep"
              aria-hidden
            >
              <Mail className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-espresso">Talk to the partner team</p>
              <p className="mt-1 text-sm leading-relaxed text-ash">
                Email{" "}
                <a
                  href={`mailto:support@foodline.com.ng?subject=${encodeURIComponent(
                    `Partner application: ${retailer.businessName}`
                  )}`}
                  className="font-medium text-terra-deep hover:underline"
                >
                  support@foodline.com.ng
                </a>{" "}
                with your shop name and any document you have, for example your CAC certificate or a
                photo of the shop. We reply within one working day.
              </p>
            </div>
          </li>
          <li className="flex gap-4">
            <span
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-terra-tint text-terra-deep"
              aria-hidden
            >
              <MessageSquareText className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-[15px] font-medium text-espresso">Send it back for review</p>
              <p className="mt-1 text-sm leading-relaxed text-ash">
                Once the point above is settled, put your shop back in the queue. Your details stay
                as you entered them, so nothing is lost.
              </p>
            </div>
          </li>
        </ol>

        <ReapplyForm />
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <p className="text-[13px] text-ash">
          Signed in as {user.email}. Your details are kept, nothing has been deleted.
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
