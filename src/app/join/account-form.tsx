"use client";

import { useActionState, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Button, Field, Input, Notice, cn, inputCls } from "@/components/ui";
import { PinnedCta } from "./join-ui";
import { createAccount, type AccountState } from "./actions";

export function AccountForm() {
  const [state, formAction, pending] = useActionState<AccountState, FormData>(createAccount, {
    errors: {},
    error: null,
  });
  const [show, setShow] = useState(false);

  return (
    <form action={formAction} className="flex-1 flex flex-col mt-8">
      <div className="space-y-5">
        {state.error && <Notice tone="bad">{state.error}</Notice>}
        <Field label="Full name" error={state.errors.name}>
          <Input
            name="name"
            type="text"
            autoComplete="name"
            placeholder="As your bank knows you"
            required
          />
        </Field>
        <Field label="Email address" error={state.errors.email}>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            required
          />
        </Field>
        <Field
          label="Phone number"
          hint="Nigerian mobile, +234 or starting with 0. Example: +234 803 123 4567."
          error={state.errors.phone}
        >
          <Input
            name="phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="0803 123 4567"
            required
          />
        </Field>
        <Field
          label="Password"
          hint="At least 8 characters. Make it yours alone."
          error={state.errors.password}
        >
          <div className="relative">
            <input
              name="password"
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
              className="absolute right-1 top-1/2 -translate-y-1/2 flex size-10 items-center justify-center rounded-full text-ash hover:text-cocoa"
            >
              {show ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
            </button>
          </div>
        </Field>
      </div>

      <PinnedCta>
        <Button type="submit" size="lg" loading={pending} className="w-full">
          Create my account
        </Button>
        <p className="text-center text-xs text-ash mt-3 leading-relaxed">
          Free to open. You will see your exact repayment terms before you spend anything.
        </p>
      </PinnedCta>
    </form>
  );
}
