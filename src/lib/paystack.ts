import { getEnv } from "./env";

// Paystack API client (test mode). Shapes follow paystack.com/docs exactly.
// Amounts are kobo. Test transfers auto-succeed synchronously.

const BASE = "https://api.paystack.co";

export class PaystackError extends Error {
  constructor(
    message: string,
    public status: number,
    public body?: unknown
  ) {
    super(message);
    this.name = "PaystackError";
  }
}

async function paystack<T>(
  path: string,
  init: { method?: string; body?: unknown } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${getEnv("PAYSTACK_SECRET_KEY")}`,
  };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    throw new PaystackError(
      `Could not reach Paystack (${err instanceof Error ? err.message : "network error"})`,
      0
    );
  }

  const json = (await res.json().catch(() => null)) as {
    status?: boolean;
    message?: string;
    data?: unknown;
  } | null;

  if (!res.ok || json?.status === false) {
    throw new PaystackError(
      json?.message ?? `Paystack request failed (${res.status})`,
      res.status,
      json
    );
  }
  return json as T;
}

export type PaystackBank = {
  name: string;
  slug: string;
  code: string;
  active: boolean;
  supports_transfer?: boolean;
};

export async function listBanks(): Promise<PaystackBank[]> {
  const res = await paystack<{ data: PaystackBank[] }>("/bank?country=nigeria&perPage=100");
  return (res.data ?? []).filter((b) => b.active);
}

/** Resolve an account number to the registered account name */
export async function resolveAccount(
  accountNumber: string,
  bankCode: string
): Promise<{ accountName: string; accountNumber: string }> {
  const res = await paystack<{ data: { account_number: string; account_name: string } }>(
    `/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`
  );
  return { accountName: res.data.account_name, accountNumber: res.data.account_number };
}

export async function createTransferRecipient(input: {
  name: string;
  accountNumber: string;
  bankCode: string;
}): Promise<string> {
  const res = await paystack<{ data: { recipient_code: string } }>("/transferrecipient", {
    method: "POST",
    body: {
      type: "nuban",
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: "NGN",
    },
  });
  return res.data.recipient_code;
}

export type PaystackTransfer = {
  status: string; // success (test) | pending (live) | otp | failed | reversed
  transfer_code: string;
  reference: string;
  amount: number;
  id: number;
};

export async function initiateTransfer(input: {
  amountKobo: number;
  recipientCode: string;
  reference: string; // lowercase alnum/-/_, >= 16 chars
  reason: string;
}): Promise<PaystackTransfer> {
  const res = await paystack<{ data: PaystackTransfer }>("/transfer", {
    method: "POST",
    body: {
      source: "balance",
      amount: input.amountKobo,
      recipient: input.recipientCode,
      reference: input.reference,
      reason: input.reason,
    },
  });
  return res.data;
}

export async function verifyTransfer(reference: string): Promise<PaystackTransfer> {
  const res = await paystack<{ data: PaystackTransfer }>(
    `/transfer/verify/${encodeURIComponent(reference)}`
  );
  return res.data;
}

/** HMAC-SHA512 of the raw body with the secret key, hex, vs x-paystack-signature */
export async function verifyPaystackSignature(
  rawBody: string,
  signature: string | null
): Promise<boolean> {
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getEnv("PAYSTACK_SECRET_KEY")),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const hex = Array.from(new Uint8Array(mac), (b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}
