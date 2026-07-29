// Shared types and constants for the partner application. Kept out of
// actions.ts because a "use server" module may only export async functions.

export type BankOption = { code: string; name: string };

export type VerifyState = {
  accountName: string | null;
  error: string | null;
};

export type ApplyField =
  | "businessName"
  | "businessType"
  | "yearsTrading"
  | "description"
  | "rcNumber"
  | "ownerName"
  | "phone"
  | "email"
  | "password"
  | "address"
  | "bankCode"
  | "accountNumber"
  | "accountName"
  | "form";

export type ApplyErrors = Partial<Record<ApplyField, string>>;

export type ApplyState = {
  errors: ApplyErrors;
  /** true when the email already belongs to a Foodline account, so we offer sign in */
  emailTaken: boolean;
};

export const EMPTY_APPLY_STATE: ApplyState = { errors: {}, emailTaken: false };

export const BUSINESS_TYPES = [
  "Open market stall",
  "Provision store",
  "Foodstuff shop",
  "Wholesale depot",
  "Supermarket",
  "Other",
] as const;
