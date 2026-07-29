import { getDb } from "@/db";
import { getEnv } from "@/lib/env";
import { runSeed } from "@/lib/seed";

export const dynamic = "force-dynamic";

// One-command demo readiness:
//   curl -X POST <base>/api/dev/seed -H "x-seed-secret: $SEED_SECRET"
// Wipes and reseeds all data (catalog, demo customer, retailer, portfolio).

export async function POST(request: Request) {
  const secret = getEnv("SEED_SECRET");
  if (request.headers.get("x-seed-secret") !== secret) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const db = getDb();
  try {
    const summary = await runSeed(db, new URL(request.url).origin);
    return Response.json({ ok: true, ...summary });
  } catch (err) {
    return Response.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
