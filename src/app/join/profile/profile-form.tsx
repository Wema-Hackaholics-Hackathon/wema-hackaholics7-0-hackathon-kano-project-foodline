"use client";

import { useActionState } from "react";
import { ShieldCheck } from "lucide-react";
import { Button, Notice, cn } from "@/components/ui";
import { DarkField, PinnedCta, darkInputCls } from "../join-ui";
import { saveProfile, type ProfileState } from "./actions";

export type ProfileInitial = {
  bvn: string;
  dob: string;
  employerName: string;
  workEmail: string;
  address: string;
} | null;

export function ProfileForm({ initial, maxDob }: { initial: ProfileInitial; maxDob: string }) {
  const [state, formAction, pending] = useActionState<ProfileState, FormData>(saveProfile, {
    errors: {},
    error: null,
  });

  return (
    <form action={formAction} className="flex-1 flex flex-col mt-8">
      <div className="space-y-6">
        {state.error && <Notice tone="bad">{state.error}</Notice>}

        <div>
          <DarkField label="Bank Verification Number (BVN)" error={state.errors.bvn}>
            <input
              name="bvn"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={11}
              autoComplete="off"
              placeholder="11 digits"
              defaultValue={initial?.bvn}
              required
              className={cn(darkInputCls, "tnum tracking-[0.2em]")}
            />
          </DarkField>
          <div className="flex gap-2.5 mt-2.5 text-[13px] text-cream/65 leading-relaxed">
            <ShieldCheck className="size-4 shrink-0 mt-0.5 text-mango" aria-hidden />
            <p>
              Your BVN helps us confirm you are really you. It cannot be used to access your bank
              account or your money. Dial <span className="text-cream font-medium">*565*0#</span>{" "}
              to check yours.
            </p>
          </div>
        </div>

        <DarkField label="Date of birth" hint="You must be 18 or older." error={state.errors.dob}>
          <input
            name="dob"
            type="date"
            max={maxDob}
            autoComplete="bday"
            defaultValue={initial?.dob}
            required
            className={cn(darkInputCls, "[color-scheme:dark]")}
          />
        </DarkField>

        <DarkField label="Employer name" error={state.errors.employerName}>
          <input
            name="employerName"
            type="text"
            autoComplete="organization"
            placeholder="Who pays your salary"
            defaultValue={initial?.employerName}
            required
            className={darkInputCls}
          />
        </DarkField>

        <DarkField
          label="Work email"
          hint="Helps us confirm where you work. We will not email your colleagues."
          error={state.errors.workEmail}
        >
          <input
            name="workEmail"
            type="email"
            inputMode="email"
            placeholder="you@yourcompany.com"
            defaultValue={initial?.workEmail}
            required
            className={darkInputCls}
          />
        </DarkField>

        <DarkField label="Home address" error={state.errors.address}>
          <input
            name="address"
            type="text"
            autoComplete="street-address"
            placeholder="Street and city"
            defaultValue={initial?.address}
            required
            className={darkInputCls}
          />
        </DarkField>
      </div>

      <PinnedCta on="dark">
        <Button type="submit" size="lg" loading={pending} className="w-full">
          {initial ? "Save and continue" : "Continue"}
        </Button>
      </PinnedCta>
    </form>
  );
}
