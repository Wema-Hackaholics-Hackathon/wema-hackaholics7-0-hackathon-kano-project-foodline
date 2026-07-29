import { getDb } from "@/db";
import { getEnvOptional } from "@/lib/env";
import { apiUser } from "@/lib/session";
import { runSweep } from "@/lib/debit-engine";

export const dynamic = "force-dynamic";

// Fallback debit sweep: collects installments whose due date passed without a
// salary trigger, retries failures, marks overdue. Callable by an admin (the
// "Run sweep" button) or an external scheduler with the CRON_SECRET header.

export async function POST(request: Request) {
  const admin = await apiUser("admin");
  const cronSecret = getEnvOptional("CRON_SECRET");
  const viaCron = cronSecret && request.headers.get("x-cron-secret") === cronSecret;
  if (!admin && !viaCron) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getDb();
  const stats = await runSweep(db);
  return Response.json({ ok: true, ...stats });
}
