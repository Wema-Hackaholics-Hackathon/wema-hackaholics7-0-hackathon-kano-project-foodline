import type { Metadata } from "next";
import { todayLagos } from "@/lib/dates";
import { requireJoinPage } from "../flow";
import { JoinHeader } from "../join-ui";
import { ProfileForm, type ProfileInitial } from "./profile-form";

export const metadata: Metadata = { title: "Confirm who you are" };

export default async function ProfilePage() {
  const { customer } = await requireJoinPage("profile");

  // Editing from the link step keeps what was already saved
  const initial: ProfileInitial = customer
    ? {
        bvn: customer.bvn,
        dob: customer.dob,
        employerName: customer.employerName,
        workEmail: customer.workEmail,
        address: customer.address ?? "",
      }
    : null;

  // Latest date of birth that still makes the customer 18 today
  const [y, m, d] = todayLagos().split("-").map(Number);
  const maxDob = `${y - 18}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  return (
    <main className="flex-1 flex flex-col bg-espresso text-cream px-5 py-6">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        <JoinHeader step={2} on="dark" showSignOut />

        <div className="mt-8 animate-rise">
          <h1 className="font-display text-[28px] leading-tight text-cream">Confirm who you are</h1>
          <p className="text-sm text-cream/65 mt-2 leading-relaxed">
            This is the serious part, so we keep it plain. These details stay between you and
            Foodline.
          </p>
        </div>

        <ProfileForm initial={initial} maxDob={maxDob} />
      </div>
    </main>
  );
}
