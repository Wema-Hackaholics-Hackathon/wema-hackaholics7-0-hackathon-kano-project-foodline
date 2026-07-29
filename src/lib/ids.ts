export function uid(): string {
  return crypto.randomUUID();
}

/** Unambiguous alphabet: no 0/O/1/I/L to keep codes readable over a counter */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

function randomFrom(alphabet: string, length: number): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < length; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

/** Foodline Card short code, e.g. "FL-8PM3QK" */
export function voucherCode(): string {
  return `FL-${randomFrom(CODE_ALPHABET, 6)}`;
}

/** Long token for QR payloads and sessions */
export function randomToken(bytes = 24): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Mono mandate/debit reference: unique, max 24 chars */
export function monoReference(prefix: "fmd" | "fdb"): string {
  return `${prefix}${Date.now().toString(36)}${randomFrom("abcdefghjkmnpqrstuvwxyz23456789", 8)}`;
}

/** Paystack transfer reference: lowercase, >= 16 chars */
export function paystackReference(): string {
  return `flstl-${crypto.randomUUID()}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
