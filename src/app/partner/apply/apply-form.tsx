"use client";

import { useActionState, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { CircleCheck, Eye, EyeOff, ShieldCheck } from "lucide-react";
import {
  Button,
  Card,
  DemoBadge,
  Divider,
  Field,
  Input,
  Notice,
  Select,
  Textarea,
  cn,
  inputCls,
} from "@/components/ui";
import { submitApplication, verifyBankAccount } from "./actions";
import {
  BUSINESS_TYPES,
  EMPTY_APPLY_STATE,
  type ApplyState,
  type BankOption,
  type VerifyState,
} from "./types";

// Every field is controlled. React resets a form after a form action runs, and
// an uncontrolled field would come back empty after a validation error, which
// on a form this long would be unforgivable.
type Values = {
  businessName: string;
  businessType: string;
  yearsTrading: string;
  description: string;
  rcNumber: string;
  ownerName: string;
  phone: string;
  email: string;
  password: string;
  address: string;
  bankCode: string;
  accountNumber: string;
  typedAccountName: string;
};

const BLANK: Values = {
  businessName: "",
  businessType: "",
  yearsTrading: "",
  description: "",
  rcNumber: "",
  ownerName: "",
  phone: "",
  email: "",
  password: "",
  address: "",
  bankCode: "",
  accountNumber: "",
  typedAccountName: "",
};

function Section({
  step,
  title,
  sub,
  children,
}: {
  step: number;
  title: string;
  sub: string;
  children: ReactNode;
}) {
  return (
    <Card className="space-y-4">
      <div className="flex gap-3">
        <span
          className="tnum flex size-8 shrink-0 items-center justify-center rounded-full bg-espresso font-display text-sm text-cream"
          aria-hidden
        >
          {step}
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-lg leading-tight text-espresso">{title}</h2>
          <p className="mt-1 text-[13px] leading-snug text-ash">{sub}</p>
        </div>
      </div>
      <div className="space-y-4">{children}</div>
    </Card>
  );
}

export function ApplyForm({ banks, demoMode }: { banks: BankOption[]; demoMode: boolean }) {
  const [state, formAction, pending] = useActionState<ApplyState, FormData>(
    submitApplication,
    EMPTY_APPLY_STATE
  );

  const [v, setV] = useState<Values>(BLANK);
  const [show, setShow] = useState(false);
  const [verify, setVerify] = useState<VerifyState>({ accountName: null, error: null });
  const [verifying, startVerify] = useTransition();
  const [skip, setSkip] = useState(false);

  const e = state.errors;
  const bankName = banks.find((b) => b.code === v.bankCode)?.name ?? "";
  const verified = Boolean(verify.accountName);
  const usingDemoPath = demoMode && skip && !verified;
  const canSubmit = verified || (usingDemoPath && v.typedAccountName.trim().length >= 2);
  const errorCount = Object.keys(e).length;

  function set<K extends keyof Values>(key: K, value: string) {
    setV((prev) => ({ ...prev, [key]: value }));
  }

  /** Any edit to the account invalidates a name check we already did */
  function setAccount<K extends "bankCode" | "accountNumber">(key: K, value: string) {
    set(key, value);
    setVerify({ accountName: null, error: null });
  }

  function runVerify() {
    startVerify(async () => {
      const result = await verifyBankAccount(v.accountNumber, v.bankCode);
      setVerify(result);
      if (result.accountName) setSkip(false);
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      {e.form && <Notice tone="bad">{e.form}</Notice>}
      {state.emailTaken && (
        <Notice tone="note" title="You already have a Foodline account">
          Sign in with that email and we will take you straight to your shop.{" "}
          <Link href="/login" className="font-medium text-terra-deep">
            Go to sign in
          </Link>
        </Notice>
      )}
      {!state.emailTaken && errorCount > 0 && !e.form && (
        <Notice tone="warn">
          Nothing has been submitted yet. The fields marked below need a small correction.
        </Notice>
      )}

      <Section
        step={1}
        title="Your business"
        sub="This is how customers find your shop in the app."
      >
        <Field label="Business name" error={e.businessName}>
          <Input
            name="businessName"
            value={v.businessName}
            onChange={(ev) => set("businessName", ev.target.value)}
            autoComplete="organization"
            placeholder="Mama Nkechi Provisions"
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business type" error={e.businessType}>
            <Select
              name="businessType"
              value={v.businessType}
              onChange={(ev) => set("businessType", ev.target.value)}
              required
            >
              <option value="" disabled>
                Choose one
              </option>
              {BUSINESS_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Years trading"
            hint="Enter 0 if you started this year."
            error={e.yearsTrading}
          >
            <Input
              name="yearsTrading"
              value={v.yearsTrading}
              onChange={(ev) => set("yearsTrading", ev.target.value.replace(/\D/g, "").slice(0, 2))}
              inputMode="numeric"
              placeholder="6"
              className="tnum"
              required
            />
          </Field>
        </div>
        <Field
          label="What do you sell?"
          hint="One or two lines. Name the staples you always have in stock."
          error={e.description}
        >
          <Textarea
            name="description"
            value={v.description}
            onChange={(ev) => set("description", ev.target.value)}
            placeholder="Rice, beans, garri, palm oil and tomatoes, sold by mudu, congo and 50kg bag."
            maxLength={400}
            required
          />
        </Field>
        <Field
          label="RC number (optional)"
          hint="Your CAC registration number if you have one. You can join without it."
          error={e.rcNumber}
        >
          <Input
            name="rcNumber"
            value={v.rcNumber}
            onChange={(ev) => set("rcNumber", ev.target.value)}
            placeholder="RC 1234567"
          />
        </Field>
      </Section>

      <Section
        step={2}
        title="Owner and contact"
        sub="We call this number if anything in your application needs clearing up."
      >
        <Field label="Owner's full name" error={e.ownerName}>
          <Input
            name="ownerName"
            value={v.ownerName}
            onChange={(ev) => set("ownerName", ev.target.value)}
            autoComplete="name"
            placeholder="Nkechi Obiora"
            required
          />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Phone number"
            hint="Nigerian mobile, +234 or starting with 0."
            error={e.phone}
          >
            <Input
              name="phone"
              value={v.phone}
              onChange={(ev) => set("phone", ev.target.value)}
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              placeholder="0803 123 4567"
              required
            />
          </Field>
          <Field label="Login email" hint="You will sign in with this." error={e.email}>
            <Input
              name="email"
              value={v.email}
              onChange={(ev) => set("email", ev.target.value)}
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="shop@example.com"
              required
            />
          </Field>
        </div>
        <Field label="Password" hint="At least 8 characters." error={e.password}>
          <div className="relative">
            <input
              name="password"
              value={v.password}
              onChange={(ev) => set("password", ev.target.value)}
              type={show ? "text" : "password"}
              autoComplete="new-password"
              placeholder="Create a password"
              minLength={8}
              required
              className={cn(inputCls, "pr-12")}
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-1 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-ash hover:text-cocoa"
            >
              {show ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
            </button>
          </div>
        </Field>
      </Section>

      <Section
        step={3}
        title="Where the shop is"
        sub="Customers collect in person, so the address does real work."
      >
        <Field
          label="Full shop address"
          hint="Shop number, market or street, area and state. We use this to show your shop to customers near you."
          error={e.address}
        >
          <Textarea
            name="address"
            value={v.address}
            onChange={(ev) => set("address", ev.target.value)}
            autoComplete="street-address"
            placeholder="Shop 14, Mile 12 Market, Kosofe, Lagos"
            required
          />
        </Field>
      </Section>

      <Section
        step={4}
        title="Settlement account"
        sub="Paystack pays into this account when you hand over an order. Use an account in the business owner's name."
      >
        <Field label="Bank" error={e.bankCode}>
          <Select
            name="bankCode"
            value={v.bankCode}
            onChange={(ev) => setAccount("bankCode", ev.target.value)}
            required
          >
            <option value="" disabled>
              {banks.length === 0 ? "Bank list unavailable" : "Choose your bank"}
            </option>
            {banks.map((bank) => (
              <option key={bank.code} value={bank.code}>
                {bank.name}
              </option>
            ))}
          </Select>
        </Field>
        <input type="hidden" name="bankName" value={bankName} />

        <Field
          label="Account number"
          hint={
            demoMode
              ? "Ten digits. Paystack test mode allows only three live lookups a day, and account 0000000000 at Zenith Bank always resolves."
              : "Ten digits, as printed on your bank statement."
          }
          error={e.accountNumber}
        >
          <input
            name="accountNumber"
            value={v.accountNumber}
            onChange={(ev) =>
              setAccount("accountNumber", ev.target.value.replace(/\D/g, "").slice(0, 10))
            }
            inputMode="numeric"
            autoComplete="off"
            placeholder="0000000000"
            className={cn(inputCls, "tnum")}
          />
        </Field>

        <input type="hidden" name="resolvedName" value={verify.accountName ?? ""} />

        <div>
          <Button
            type="button"
            variant="secondary"
            loading={verifying}
            disabled={v.accountNumber.length !== 10 || !v.bankCode}
            onClick={runVerify}
          >
            <ShieldCheck className="size-4" aria-hidden />
            Verify account
          </Button>
        </div>

        {verify.error && (
          <Notice tone="bad">
            {verify.error}
            {demoMode && " You can also use the demo path below."}
          </Notice>
        )}
        {verify.accountName && (
          <Notice tone="good">
            <span className="flex items-start gap-2">
              <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Account verified: <strong>{verify.accountName}</strong>
              </span>
            </span>
          </Notice>
        )}
        {e.accountName && !verify.error && !skip && <Notice tone="bad">{e.accountName}</Notice>}

        {demoMode && !verified && (
          <div>
            <Divider className="my-5" />
            {!skip ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setSkip(true)}
                  className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium text-terra-deep transition-colors hover:bg-terra-tint"
                >
                  Skip verification for now
                </button>
                <DemoBadge />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <DemoBadge />
                  <p className="text-sm font-medium text-cocoa">Verification skipped</p>
                </div>
                <p className="text-[13px] leading-relaxed text-ash">
                  Type the account name yourself and continue. We record the account as unverified,
                  and the Foodline team confirms it with your bank before your first payout.
                </p>
                <Field label="Account name" error={e.accountName}>
                  <Input
                    name="typedAccountName"
                    value={v.typedAccountName}
                    onChange={(ev) => set("typedAccountName", ev.target.value)}
                    placeholder="As your bank has it"
                    autoComplete="off"
                  />
                </Field>
                <input type="hidden" name="skipVerification" value="1" />
                <button
                  type="button"
                  onClick={() => {
                    setSkip(false);
                    set("typedAccountName", "");
                  }}
                  className="inline-flex h-11 items-center text-sm font-medium text-terra-deep hover:underline"
                >
                  Verify with Paystack instead
                </button>
              </div>
            )}
          </div>
        )}
      </Section>

      <div className="sticky bottom-0 -mx-5 border-t border-crust/60 bg-oat/95 px-5 py-4 pb-[calc(env(safe-area-inset-bottom)+16px)] backdrop-blur md:mx-0 md:px-0 md:pb-4">
        <Button
          type="submit"
          size="lg"
          loading={pending}
          disabled={!canSubmit}
          className="w-full sm:w-auto"
        >
          Submit application
        </Button>
        <p className="mt-2 text-[13px] leading-snug text-ash">
          {canSubmit
            ? "We review applications within one working day. You can start listing your products straight away."
            : demoMode
              ? "Verify your settlement account, or skip verification above, to submit."
              : "Verify your settlement account above to submit."}
        </p>
      </div>
    </form>
  );
}
