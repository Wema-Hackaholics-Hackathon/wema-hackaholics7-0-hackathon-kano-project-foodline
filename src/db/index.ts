import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

// Instantiate per request. Module-scope clients break on Workers
// ("Cannot perform I/O on behalf of a different request").
export function getDb() {
  const { env } = getCloudflareContext();
  return drizzle(env.DB, { schema });
}

export async function getDbAsync() {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
export * as tables from "./schema";
