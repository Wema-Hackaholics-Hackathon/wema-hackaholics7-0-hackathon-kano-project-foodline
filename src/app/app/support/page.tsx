import { and, eq } from "drizzle-orm";
import { Mail, Phone, MessageCircle, ShieldCheck, CircleCheck } from "lucide-react";
import { getDb } from "@/db";
import { ledgerEvents } from "@/db/schema";
import { requireRole } from "@/lib/session";
import { Button, Card, Notice, PageTitle } from "@/components/ui";
import { requestMandateCancellation } from "./actions";
import { CANCEL_REQUEST_MESSAGE } from "./constants";

export const dynamic = "force-dynamic";

const CONTACTS = [
  {
    icon: Mail,
    label: "support@foodline.com.ng",
    href: "mailto:support@foodline.com.ng",
    best: "Best for questions about a repayment or an order. We reply within one working day.",
  },
  {
    icon: Phone,
    label: "+234 800 000 0000",
    href: "tel:+2348000000000",
    best: "Best if something is urgent. Lines are open 8am to 6pm, Monday to Saturday.",
  },
  {
    icon: MessageCircle,
    label: "Chat on WhatsApp",
    href: "https://wa.me/2348000000000",
    best: "Best for quick questions. Send your voucher code and we will pick it up from there.",
  },
];

export default async function SupportPage() {
  const user = await requireRole("customer");
  const db = getDb();

  const existing = await db
    .select({ id: ledgerEvents.id })
    .from(ledgerEvents)
    .where(
      and(
        eq(ledgerEvents.customerId, user.id),
        eq(ledgerEvents.message, CANCEL_REQUEST_MESSAGE)
      )
    )
    .limit(1);
  const alreadyRequested = existing.length > 0;

  return (
    <div className="space-y-5">
      <PageTitle title="We are here to help" sub="Real people, straight answers, no runaround." />

      <Card className="p-0 overflow-hidden">
        <ul className="divide-y divide-crust/60">
          {CONTACTS.map((c) => {
            const Icon = c.icon;
            return (
              <li key={c.href}>
                <a
                  href={c.href}
                  className="flex items-start gap-3 px-4 py-4 min-h-16 hover:bg-cream transition-colors"
                >
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-sm bg-terra-tint text-terra-deep">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[15px] font-medium text-espresso">{c.label}</span>
                    <span className="block text-[13px] text-ash leading-snug mt-0.5">{c.best}</span>
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </Card>

      <Card>
        <h2 className="font-display text-lg text-espresso">Cancel your repayment mandate</h2>
        <p className="text-sm text-cocoa mt-2 leading-relaxed">
          You can cancel the direct debit mandate on your salary account at any time. Two things to
          know before you do: any installments you already owe remain due, and you will need to
          repay them another way. A new mandate is required before you can shop on credit again.
        </p>
        <p className="text-sm text-cocoa mt-2 leading-relaxed">
          Cancelling carries no penalty and no extra charge.
        </p>

        {alreadyRequested ? (
          <Notice tone="good" className="mt-4">
            <span className="flex items-start gap-2">
              <CircleCheck className="size-4 mt-0.5 shrink-0" aria-hidden />
              <span>
                Received. Our team will call you within one working day. Debits stay paused while we
                process this.
              </span>
            </span>
          </Notice>
        ) : (
          <form action={requestMandateCancellation} className="mt-4">
            <Button type="submit" variant="secondary">
              Request mandate cancellation
            </Button>
          </form>
        )}
      </Card>

      <Card className="bg-wheat/50">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-sm bg-white text-good">
            <ShieldCheck className="size-5" aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-lg text-espresso">Our promises to you</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-cocoa leading-relaxed">
              <li>You never repay more than the amount shown to you at checkout.</li>
              <li>Repaying early costs you nothing extra.</li>
              <li>We debit only your agreed installment, only around your payday.</li>
              <li>You can cancel the mandate whenever you choose.</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
}
