import Link from "next/link";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, users } from "@/db/schema";
import { getConfig } from "@/lib/settings";
import { outstandingKobo } from "@/lib/debit-engine";
import { Button, Card, DemoBadge, Notice, PageTitle, Pill } from "@/components/ui";
import { SalarySimulator, SweepRunner, ReseedCard, type DemoCustomer } from "./demo-panel";
import { toggleDemoMode } from "./actions";

export const dynamic = "force-dynamic";

const SCRIPT = [
  { step: "Onboard and verify salary", href: "/join", note: "Mono link or the demo salary account" },
  { step: "Limit reveal", href: "/join/limit", note: "30% of verified salary, explained" },
  { step: "Shop foodstuff", href: "/app/shop", note: "Real market units and prices" },
  { step: "Foodline Card issued", href: "/app/cards", note: "QR plus short code, 72 hour expiry" },
  { step: "Retailer scans and confirms", href: "/retailer/redeem", note: "Ten second job" },
  { step: "Instant Paystack settlement", href: "/retailer", note: "Retailer paid before goods leave" },
  { step: "Simulate salary landing", href: "/admin/demo", note: "The finale, run it from here" },
  { step: "Auto-debit visible to customer", href: "/app/repayments", note: "Installment marked paid" },
];

export default async function DemoPanel() {
  const db = getDb();
  const config = await getConfig(db);

  const rows = await db
    .select({
      id: customers.id,
      name: users.name,
      salaryKobo: customers.salaryAmountKobo,
      nextPayDate: customers.nextPayDate,
    })
    .from(customers)
    .innerJoin(users, eq(customers.id, users.id))
    .where(eq(customers.isDemo, true));

  const demoCustomers: DemoCustomer[] = [];
  for (const row of rows) {
    if (!row.salaryKobo) continue;
    demoCustomers.push({
      id: row.id,
      name: row.name,
      firstName: row.name.split(/\s+/)[0],
      salaryKobo: row.salaryKobo,
      nextPayDate: row.nextPayDate,
      outstandingKobo: await outstandingKobo(db, row.id),
    });
  }

  return (
    <div className="space-y-5">
      <PageTitle
        title="Demo panel"
        sub="Stage controls. Everything here drives the same production engine."
        right={<DemoBadge />}
      />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg text-espresso">Demo mode</h2>
            <p className="text-sm text-ash mt-1 max-w-xl leading-relaxed">
              Gates the demo salary account on the bank linking screen, simulated mandate
              authorisation, and the judge login panel. Detection, limits, schedules and debits run
              the same code either way.
            </p>
          </div>
          <form action={toggleDemoMode}>
            <Button type="submit" variant={config.demoMode ? "secondary" : "primary"}>
              {config.demoMode ? "Turn demo mode off" : "Turn demo mode on"}
            </Button>
          </form>
        </div>
        <div className="mt-3">
          <Pill tone={config.demoMode ? "good" : "neutral"}>
            {config.demoMode ? "Demo mode is on" : "Demo mode is off"}
          </Pill>
        </div>
      </Card>

      <Card>
        <h2 className="font-display text-lg text-espresso">Simulate salary credit</h2>
        <p className="text-sm text-ash mt-1 mb-4 leading-relaxed">
          Fires an inflow on the customer&apos;s linked account. The engine checks it against the
          verified salary signature and collects any installment that is due.
        </p>
        {config.demoMode ? (
          <SalarySimulator customers={demoCustomers} />
        ) : (
          <Notice tone="warn">
            Turn demo mode on to simulate salary credits.
          </Notice>
        )}
      </Card>

      <Card>
        <h2 className="font-display text-lg text-espresso">Fallback debit sweep</h2>
        <p className="text-sm text-ash mt-1 mb-4 leading-relaxed">
          Collects installments whose due date passed without a salary trigger, retries failures
          within policy, and marks the rest overdue.
        </p>
        <SweepRunner />
      </Card>

      <Card>
        <h2 className="font-display text-lg text-espresso mb-3">The 90 second run</h2>
        <ol className="space-y-2">
          {SCRIPT.map((item, i) => (
            <li key={item.step} className="flex items-start gap-3">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-terra-tint text-terra-deep text-[13px] font-semibold tnum">
                {i + 1}
              </span>
              <div className="min-w-0">
                <Link href={item.href} className="text-sm text-espresso hover:text-terra-deep">
                  {item.step}
                </Link>
                <p className="text-[13px] text-ash">{item.note}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <ReseedCard />
    </div>
  );
}
