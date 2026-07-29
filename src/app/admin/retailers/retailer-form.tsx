"use client";

import { useActionState, useState } from "react";
import { CircleCheck, Copy, RefreshCw } from "lucide-react";
import {
  Button,
  Card,
  Field,
  Input,
  Notice,
  Select,
  Textarea,
  inputCls,
} from "@/components/ui";
import {
  createRetailer,
  resolveSettlementAccount,
  type RetailerState,
  type ResolveState,
} from "./actions";

const WORDS = ["market", "basket", "harvest", "pepper", "cocoa", "garri", "millet", "palm"];

function makePassword(): string {
  const bytes = new Uint8Array(3);
  crypto.getRandomValues(bytes);
  const a = WORDS[bytes[0] % WORDS.length];
  const b = WORDS[bytes[1] % WORDS.length];
  const n = 100 + (bytes[2] % 900);
  return `${a}-${b}-${n}`;
}

export function RetailerForm({ banks }: { banks: { code: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState<RetailerState, FormData>(createRetailer, {
    errors: {},
  });
  const [resolveState, resolveAction, resolving] = useActionState<ResolveState, FormData>(
    resolveSettlementAccount,
    { accountName: null, error: null }
  );
  const [password, setPassword] = useState(makePassword);
  const [copied, setCopied] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");

  const bankName = banks.find((b) => b.code === bankCode)?.name ?? "";
  const verified = Boolean(resolveState.accountName);
  const e = state.errors;

  return (
    <div className="space-y-4">
      {e.form && <Notice tone="bad">{e.form}</Notice>}

      <Card className="space-y-4">
        <h2 className="font-display text-lg text-espresso">Shop details</h2>
        <Field label="Business name" error={e.businessName}>
          <Input name="businessName" form="retailer-form" placeholder="Mama Nkechi Provisions" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-4">
          <Field label="Contact phone">
            <Input name="contactPhone" form="retailer-form" placeholder="08012345678" inputMode="tel" />
          </Field>
          <Field label="Login email" error={e.email}>
            <Input name="email" form="retailer-form" type="email" placeholder="shop@example.com" />
          </Field>
        </div>
        <Field label="Shop address">
          <Textarea name="address" form="retailer-form" placeholder="Shop 14, Mile 12 Market, Lagos" />
        </Field>
        <Field
          label="Temporary password"
          error={e.password}
          hint="Shown only now. Share it with the shop owner and ask them to change it."
        >
          <div className="flex gap-2">
            <input
              name="password"
              form="retailer-form"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              className={inputCls}
            />
            <button
              type="button"
              onClick={() => setPassword(makePassword())}
              aria-label="Generate a new password"
              className="flex size-12 shrink-0 items-center justify-center rounded-md border border-crust text-cocoa hover:bg-cream"
            >
              <RefreshCw className="size-4.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(password);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
              aria-label="Copy password"
              className="flex size-12 shrink-0 items-center justify-center rounded-md border border-crust text-cocoa hover:bg-cream"
            >
              {copied ? <CircleCheck className="size-4.5 text-good" /> : <Copy className="size-4.5" />}
            </button>
          </div>
        </Field>
      </Card>

      <Card className="space-y-4">
        <div>
          <h2 className="font-display text-lg text-espresso">Settlement account</h2>
          <p className="text-[13px] text-ash mt-1">
            This is where Paystack sends money the moment a card is accepted. We verify the name
            with the bank before saving.
          </p>
        </div>

        <Field label="Settlement bank" error={e.bankCode}>
          <Select
            name="bankCode"
            value={bankCode}
            onChange={(ev) => setBankCode(ev.target.value)}
            form="retailer-form"
          >
            <option value="">Choose a bank</option>
            {banks.map((b) => (
              <option key={b.code} value={b.code}>
                {b.name}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Account number"
          error={e.accountNumber}
          hint="Test mode allows three live bank lookups a day. Account 0000000000 at Zenith always resolves."
        >
          <input
            name="accountNumber"
            value={accountNumber}
            onChange={(ev) => setAccountNumber(ev.target.value.replace(/\D/g, "").slice(0, 10))}
            inputMode="numeric"
            placeholder="0000000000"
            className={`${inputCls} tnum`}
            form="retailer-form"
          />
        </Field>

        <form action={resolveAction}>
          <input type="hidden" name="accountNumber" value={accountNumber} />
          <input type="hidden" name="bankCode" value={bankCode} />
          <Button
            type="submit"
            variant="secondary"
            loading={resolving}
            disabled={accountNumber.length !== 10 || !bankCode}
          >
            Verify account
          </Button>
        </form>

        {resolveState.error && <Notice tone="bad">{resolveState.error}</Notice>}
        {resolveState.accountName && (
          <Notice tone="good">
            <span className="flex items-start gap-2">
              <CircleCheck className="size-4 mt-0.5 shrink-0" aria-hidden />
              <span>
                Account verified: <strong>{resolveState.accountName}</strong>
              </span>
            </span>
          </Notice>
        )}
      </Card>

      <form action={formAction} id="retailer-form">
        <input type="hidden" name="bankName" value={bankName} />
        <input type="hidden" name="resolvedName" value={resolveState.accountName ?? ""} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="lg" loading={pending} disabled={!verified}>
            Add retailer
          </Button>
          <Button href="/admin/retailers" variant="secondary" size="lg">
            Cancel
          </Button>
        </div>
        {!verified && (
          <p className="text-[13px] text-ash mt-2">
            Verify the settlement account to enable saving.
          </p>
        )}
      </form>
    </div>
  );
}
