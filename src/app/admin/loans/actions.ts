"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { loans } from "@/db/schema";
import { apiUser } from "@/lib/session";
import { getConfig } from "@/lib/settings";
import { collectDueInstallments, type DebitOutcome } from "@/lib/debit-engine";

export type CollectState = { outcomes: DebitOutcome[]; error: string | null };

export async function collectNow(
  _prev: CollectState,
  form: FormData
): Promise<CollectState> {
  const admin = await apiUser("admin");
  if (!admin) return { outcomes: [], error: "Your session expired. Sign in again." };

  const loanId = String(form.get("loanId") ?? "");
  const db = getDb();
  const loan = (await db.select().from(loans).where(eq(loans.id, loanId)).limit(1))[0];
  if (!loan) return { outcomes: [], error: "Loan not found." };

  try {
    const config = await getConfig(db);
    const outcomes = await collectDueInstallments(db, loan.customerId, "manual", config);
    revalidatePath(`/admin/loans/${loanId}`);
    revalidatePath("/admin");
    return { outcomes, error: null };
  } catch (err) {
    return {
      outcomes: [],
      error: err instanceof Error ? err.message : "Collection could not be attempted.",
    };
  }
}
