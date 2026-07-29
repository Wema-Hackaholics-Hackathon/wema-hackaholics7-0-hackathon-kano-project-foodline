import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers, users } from "@/db/schema";
import { apiUser } from "@/lib/session";
import { getConfig } from "@/lib/settings";
import { processInflow } from "@/lib/debit-engine";
import { logEvent } from "@/lib/ledger";
import { formatNaira } from "@/lib/money";

export const dynamic = "force-dynamic";

// Demo panel: fire a simulated salary credit on a demo customer's linked
// account. The inflow flows through the same engine as a real webhook:
// signature match -> due installment debits -> dashboard updates.

export async function POST(request: Request) {
  const admin = await apiUser("admin");
  if (!admin) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDb();
  const config = await getConfig(db);
  if (!config.demoMode) {
    return Response.json(
      { error: "Demo mode is switched off in lending configuration." },
      { status: 400 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as { customerId?: string };
  let customer;
  if (body.customerId) {
    customer = (
      await db.select().from(customers).where(eq(customers.id, body.customerId)).limit(1)
    )[0];
  } else {
    customer = (
      await db
        .select()
        .from(customers)
        .where(eq(customers.isDemo, true))
        .orderBy(customers.createdAt)
        .limit(1)
    )[0];
  }
  if (!customer) return Response.json({ error: "No demo customer found" }, { status: 404 });
  if (!customer.isDemo) {
    return Response.json({ error: "Salary simulation only works on demo customers" }, { status: 400 });
  }
  if (!customer.salaryAmountKobo || !customer.nextPayDate) {
    return Response.json({ error: "Customer has no verified salary" }, { status: 400 });
  }

  const user = (await db.select().from(users).where(eq(users.id, customer.id)).limit(1))[0];
  const amountKobo = customer.salaryAmountKobo;
  const date = customer.nextPayDate;
  const month = new Date(`${date}T00:00:00Z`)
    .toLocaleDateString("en-NG", { month: "short", year: "numeric", timeZone: "UTC" })
    .toUpperCase();

  await logEvent(db, {
    type: "demo_action",
    customerId: customer.id,
    actor: `admin:${admin.id}`,
    message: `Simulated salary credit of ${formatNaira(amountKobo)} for ${user?.name ?? "customer"} (${month})`,
  });

  const result = await processInflow(db, customer.id, {
    amountKobo,
    narration: `SALARY/${(customer.employerName || "EMPLOYER").toUpperCase()}/${month}`,
    date: `${date}T07:41:00.000Z`,
    source: "demo",
  });

  return Response.json({
    ok: true,
    matched: result.matched,
    amountKobo,
    date,
    outcomes: result.outcomes,
  });
}
