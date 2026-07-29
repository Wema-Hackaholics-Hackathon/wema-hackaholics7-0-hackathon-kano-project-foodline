import { eq } from "drizzle-orm";
import type { Db } from "@/db";
import { bankTransactions, customers, mandates, users } from "@/db/schema";
import { monoReference, uid } from "./ids";
import { addDays, addMonthsClamped, daysInMonth, todayLagos } from "./dates";
import { getConfig } from "./settings";
import { logEvent } from "./ledger";

// Demo-mode data paths. The stage demo must never depend on Mono sandbox
// behavior (N50 transfers cannot be simulated; ready-to-debit takes an hour),
// so demo customers get realistic seeded bank data and an instantly-approved
// mandate. Everything downstream (detection, limits, debits) runs the same
// production code paths.

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function lastPayDate(day: number): string {
  const today = todayLagos();
  const [y, m, d] = today.split("-").map(Number);
  if (d >= day) {
    return `${y}-${String(m).padStart(2, "0")}-${String(Math.min(day, daysInMonth(y, m))).padStart(2, "0")}`;
  }
  const pm = m === 1 ? 12 : m - 1;
  const py = m === 1 ? y - 1 : y;
  return `${py}-${String(pm).padStart(2, "0")}-${String(Math.min(day, daysInMonth(py, pm))).padStart(2, "0")}`;
}

/**
 * Give a customer a demo salary account: 6 months of salary credits plus
 * everyday spending noise, and mark the account linked (ALAT by WEMA).
 * Gated by config.demoMode at the call site's discretion.
 */
export async function linkDemoBankAccount(
  db: Db,
  customerId: string,
  opts: { salaryKobo?: number; payDay?: number } = {}
): Promise<{ accountName: string; bankName: string; accountNumber: string }> {
  const config = await getConfig(db);
  if (!config.demoMode) {
    throw new Error("Demo mode is switched off");
  }
  const user = (await db.select().from(users).where(eq(users.id, customerId)).limit(1))[0];
  const customer = (
    await db.select().from(customers).where(eq(customers.id, customerId)).limit(1)
  )[0];
  if (!user || !customer) throw new Error("Customer not found");

  const salaryKobo = opts.salaryKobo ?? 28_500_000;
  const payDay = opts.payDay ?? 26;
  const accountName = user.name.toUpperCase();
  const accountNumber = `01${String(30000000 + (Math.abs(hashCode(customerId)) % 9999999)).padStart(8, "0")}`;
  const employer = (customer.employerName || "Sterling Consult Ltd").toUpperCase();

  await db.delete(bankTransactions).where(eq(bankTransactions.customerId, customerId));

  const rows: (typeof bankTransactions.$inferInsert)[] = [];
  const anchor = lastPayDate(payDay);
  let balance = 4_135_000 + salaryKobo;
  for (let back = 5; back >= 0; back--) {
    const pay = addMonthsClamped(anchor, -back);
    const [py, pm] = pay.split("-").map(Number);
    const jitter = [0, 0, Math.round(salaryKobo * 0.008), 0, -Math.round(salaryKobo * 0.005), 0][back];
    const amount = salaryKobo + jitter;
    balance += amount;
    rows.push({
      id: uid(),
      customerId,
      monoTxId: `demo-sal-${back}`,
      narration: `SALARY/${employer}/${MONTHS[pm - 1]} ${py}`,
      amountKobo: amount,
      type: "credit",
      balanceKobo: balance,
      date: `${pay}T07:42:00.000Z`,
      category: "salary",
    });
    const spends = [
      { day: 1, amt: 200_000, label: "AIRTIME TOPUP MTN" },
      { day: 3, amt: 1_850_000, label: "POS/SHOPRITE LEKKI" },
      { day: 6, amt: 920_000, label: "TRANSFER TO CHIOMA OKAFOR/UBA" },
      { day: 9, amt: 1_240_000, label: "POS/MILE 12 MARKET" },
      { day: 13, amt: 1_500_000, label: "NEPA/EKEDC PREPAID" },
      { day: 17, amt: 780_000, label: "POS/MEDPLUS PHARMACY" },
      { day: 21, amt: 2_400_000, label: "TRANSFER/BOLT TRIPS" },
    ];
    for (const s of spends) {
      const d = addDays(pay, s.day);
      const amt = Math.round(s.amt * (0.85 + ((hashCode(customerId + d) % 100) / 100) * 0.3));
      balance -= amt;
      rows.push({
        id: uid(),
        customerId,
        monoTxId: `demo-sp-${back}-${s.day}`,
        narration: s.label,
        amountKobo: amt,
        type: "debit",
        balanceKobo: balance,
        date: `${d}T${String(9 + (s.day % 9)).padStart(2, "0")}:15:00.000Z`,
        category: "spend",
      });
    }
  }
  for (let i = 0; i < rows.length; i += 15) {
    await db.insert(bankTransactions).values(rows.slice(i, i + 15));
  }

  await db
    .update(customers)
    .set({
      monoAccountId: null,
      accountName,
      accountNumber,
      bankName: "ALAT by WEMA",
      bankCode: "035",
      dataStatus: "AVAILABLE",
      stage: "verify_salary",
      isDemo: true,
      updatedAt: new Date(),
    })
    .where(eq(customers.id, customerId));

  await logEvent(db, {
    type: "demo_action",
    customerId,
    message: `Demo salary account linked: ALAT by WEMA ••${accountNumber.slice(-4)} with 6 months of seeded history`,
  });

  return { accountName, bankName: "ALAT by WEMA", accountNumber };
}

/**
 * Instantly-approved, ready-to-debit demo mandate. Shows the same
 * authorization UX on stage without waiting on NIBSS.
 */
export async function createDemoMandate(db: Db, customerId: string): Promise<{ mandateId: string }> {
  const config = await getConfig(db);
  if (!config.demoMode) throw new Error("Demo mode is switched off");
  const customer = (
    await db.select().from(customers).where(eq(customers.id, customerId)).limit(1)
  )[0];
  if (!customer) throw new Error("Customer not found");
  if (!customer.creditLimitKobo) throw new Error("No credit limit assigned");

  const now = new Date();
  const id = uid();
  await db.insert(mandates).values({
    id,
    customerId,
    monoMandateId: null,
    reference: monoReference("fmd"),
    status: "approved",
    readyToDebit: true,
    amountCapKobo: Math.round(customer.creditLimitKobo * config.mandateCapMultiplier),
    startDate: todayLagos(),
    endDate: addMonthsClamped(todayLagos(), config.mandateMonths),
    nibssCode: `RC227914/1580/000${(Math.abs(hashCode(customerId)) % 9000000) + 1000000}`,
    accountName: customer.accountName,
    accountNumber: customer.accountNumber,
    bankName: customer.bankName,
    isDemo: true,
    createdAt: now,
    approvedAt: now,
    readyAt: now,
  });
  await db
    .update(customers)
    .set({ stage: "active", updatedAt: now })
    .where(eq(customers.id, customerId));
  await logEvent(db, {
    type: "mandate_created",
    customerId,
    message: "Demo mandate approved instantly (simulated N50 authorization)",
  });
  return { mandateId: id };
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}
