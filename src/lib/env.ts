import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Read a secret/var. On Workers these come from wrangler secrets / .dev.vars
 * via the Cloudflare context; under `next dev`/`next build` they fall back to
 * process.env (.env).
 */
export function getEnv(name: string): string {
  try {
    const { env } = getCloudflareContext();
    const val = (env as unknown as Record<string, string | undefined>)[name];
    if (val) return val;
  } catch {
    // outside a request context (build time): fall through to process.env
  }
  const fromProcess = process.env[name];
  if (fromProcess) return fromProcess;
  throw new Error(`Missing environment variable: ${name}`);
}

export function getEnvOptional(name: string): string | undefined {
  try {
    return getEnv(name);
  } catch {
    return undefined;
  }
}
