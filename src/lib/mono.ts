import { getEnv } from "./env";

// Mono API client. Endpoints and shapes follow docs.mono.co exactly
// (see research notes in README). Amounts are always kobo.

const BASE = "https://api.withmono.com";

export class MonoError extends Error {
  constructor(
    message: string,
    public status: number,
    public responseCode?: string,
    public body?: unknown
  ) {
    super(message);
    this.name = "MonoError";
  }
}

async function mono<T>(
  path: string,
  init: { method?: string; body?: unknown; realTime?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    accept: "application/json",
    "mono-sec-key": getEnv("MONO_SECRET_KEY"),
  };
  if (init.body !== undefined) headers["content-type"] = "application/json";
  if (init.realTime) headers["x-real-time"] = "true";

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(25_000),
    });
  } catch (err) {
    throw new MonoError(
      `Could not reach Mono (${err instanceof Error ? err.message : "network error"})`,
      0
    );
  }

  const json = (await res.json().catch(() => null)) as {
    status?: string;
    message?: string;
    response_code?: string;
    data?: unknown;
  } | null;

  if (!res.ok || json?.status === "failed") {
    throw new MonoError(
      json?.message ?? `Mono request failed (${res.status})`,
      res.status,
      json?.response_code,
      json
    );
  }
  return json as T;
}

// ---------------------------------------------------------------------------
// Connect + financial data
// ---------------------------------------------------------------------------

/** Exchange the widget's temporary code for a permanent account id */
export async function exchangeToken(code: string): Promise<string> {
  const res = await mono<{ id: string }>("/v2/accounts/auth", {
    method: "POST",
    body: { code },
  });
  return res.id;
}

export type MonoAccount = {
  account: {
    id: string;
    name: string;
    currency: string;
    type: string;
    account_number: string;
    balance: number;
    bvn: string;
    institution: { name: string; bank_code: string; type: string };
  };
  customer: { id: string };
  meta: { data_status: "AVAILABLE" | "PROCESSING" | "PARTIAL" | "UNAVAILABLE" };
};

export async function getAccount(accountId: string): Promise<MonoAccount> {
  const res = await mono<{ data: MonoAccount }>(`/v2/accounts/${accountId}`);
  return res.data;
}

export type MonoTransaction = {
  id: string;
  narration: string;
  amount: number; // kobo
  type: "debit" | "credit";
  balance: number | null;
  date: string;
  category: string | null;
};

/** Pull the full transaction history (paginate=false returns everything) */
export async function getTransactions(
  accountId: string,
  opts: { realTime?: boolean } = {}
): Promise<MonoTransaction[]> {
  const res = await mono<{ data: MonoTransaction[] }>(
    `/v2/accounts/${accountId}/transactions?paginate=false`,
    { realTime: opts.realTime }
  );
  return res.data ?? [];
}

/** Kick off Mono's async income analysis (result arrives via webhook) */
export async function triggerIncomeAnalysis(accountId: string, periodMonths = 6): Promise<void> {
  await mono(`/v2/accounts/${accountId}/income?period=${periodMonths}`);
}

// ---------------------------------------------------------------------------
// Direct Debit customers + mandates
// ---------------------------------------------------------------------------

export async function createMonoCustomer(input: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  bvn: string;
  address: string;
}): Promise<string> {
  const res = await mono<{ data: { id: string } }>("/v2/customers", {
    method: "POST",
    body: {
      identity: { type: "bvn", number: input.bvn },
      email: input.email,
      first_name: input.firstName,
      last_name: input.lastName,
      address: input.address.slice(0, 100),
      phone: input.phone,
    },
  });
  return res.data.id;
}

export type TransferDestination = {
  bank_name: string;
  account_number: number | string;
  icon: string;
  primary_color: string;
};

export type MonoMandate = {
  id: string;
  status: string; // initiated | approved | rejected | cancelled | expired
  mandate_type: string;
  debit_type: string;
  ready_to_debit: boolean;
  nibss_code: string | null;
  approved: boolean;
  reference: string;
  account_name: string | null;
  account_number: string | null;
  bank: string | null;
  customer: string;
  live_mode: boolean;
  start_date: string;
  end_date: string;
  transfer_destinations?: TransferDestination[];
  amount: number;
};

/**
 * Headless variable e-mandate (POST /v3/payments/mandates). Returns
 * transfer_destinations for the N50 NIBSS authorization screen. In sandbox
 * this endpoint auto-approves the mandate with no transfer needed.
 */
export async function createMandate(input: {
  customerId: string;
  amountCapKobo: number;
  reference: string; // max 24 chars
  accountNumber: string;
  bankCode: string;
  description: string;
  startDate: string; // YYYY-MM-DD, today or later
  endDate: string;
}): Promise<MonoMandate> {
  const res = await mono<{ message: string; data: MonoMandate }>("/v3/payments/mandates", {
    method: "POST",
    body: {
      debit_type: "variable",
      mandate_type: "emandate",
      customer: input.customerId,
      amount: input.amountCapKobo,
      reference: input.reference,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      description: input.description,
      start_date: input.startDate,
      end_date: input.endDate,
      fee_bearer: "business",
    },
  });
  return res.data;
}

export async function getMandate(mandateIdOrRef: string): Promise<MonoMandate> {
  const res = await mono<{ data: MonoMandate }>(`/v3/payments/mandates/${mandateIdOrRef}`);
  return res.data;
}

export async function cancelMandate(mandateId: string): Promise<void> {
  await mono(`/v3/payments/mandates/${mandateId}/cancel`, { method: "PATCH" });
}

export type MonoDebitResult = {
  success: boolean;
  status: "successful" | "processing" | "failed";
  amount: number;
  mandate: string;
  reference_number: string;
  date: string;
  fee?: number;
  session_id?: string;
  message?: string;
  response_code?: string;
};

/** Debit an approved, ready mandate (variable mandates only) */
export async function debitMandate(
  mandateId: string,
  input: { amountKobo: number; reference: string; narration: string }
): Promise<MonoDebitResult> {
  const res = await mono<{
    message: string;
    response_code?: string;
    data: MonoDebitResult;
  }>(`/v3/payments/mandates/${mandateId}/debit`, {
    method: "POST",
    body: {
      amount: input.amountKobo,
      reference: input.reference,
      narration: input.narration,
      fee_bearer: "business",
    },
  });
  return { ...res.data, message: res.message, response_code: res.response_code };
}

export async function checkSufficientBalance(
  mandateId: string,
  amountKobo: number
): Promise<boolean> {
  const res = await mono<{ data: { has_sufficient_balance: boolean } }>(
    `/v3/payments/mandates/${mandateId}/balance-inquiry?amount=${amountKobo}`
  );
  return res.data.has_sufficient_balance;
}
