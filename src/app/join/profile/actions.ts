"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers } from "@/db/schema";
import { todayLagos } from "@/lib/dates";
import { loadJoin, resumePath } from "../flow";

export type ProfileErrors = {
  bvn?: string;
  dob?: string;
  employerName?: string;
  workEmail?: string;
  address?: string;
};

export type ProfileState = { errors: ProfileErrors; error: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function ageOn(today: string, dob: string): number {
  const [ty, tm, td] = today.split("-").map(Number);
  const [y, m, d] = dob.split("-").map(Number);
  let age = ty - y;
  if (tm < m || (tm === m && td < d)) age -= 1;
  return age;
}

export async function saveProfile(_prev: ProfileState, formData: FormData): Promise<ProfileState> {
  const { user, customer } = await loadJoin();
  // Only a signed-in customer at the profile step (or editing from the link
  // step) may write here.
  if (
    !user ||
    user.role !== "customer" ||
    (customer && customer.stage !== "profile" && customer.stage !== "link_account")
  ) {
    redirect(resumePath(user, customer));
  }

  const bvn = String(formData.get("bvn") ?? "").replace(/\s/g, "");
  const dob = String(formData.get("dob") ?? "").trim();
  const employerName = String(formData.get("employerName") ?? "").trim().replace(/\s+/g, " ");
  const workEmail = String(formData.get("workEmail") ?? "").trim().toLowerCase();
  const address = String(formData.get("address") ?? "").trim().replace(/\s+/g, " ");

  const errors: ProfileErrors = {};
  if (!/^\d{11}$/.test(bvn)) {
    errors.bvn = "Your BVN is exactly 11 digits. Dial *565*0# on your registered line to check it.";
  }
  if (!DATE_RE.test(dob) || Number.isNaN(Date.parse(`${dob}T00:00:00Z`))) {
    errors.dob = "Enter your date of birth.";
  } else {
    const age = ageOn(todayLagos(), dob);
    if (age < 18) errors.dob = "You must be at least 18 to open a Foodline account.";
    else if (age > 100) errors.dob = "Check the year: that date does not look right.";
  }
  if (employerName.length < 2) {
    errors.employerName = "Enter your employer's name as it appears on your payslip.";
  }
  if (!EMAIL_RE.test(workEmail)) {
    errors.workEmail = "Enter a valid work email address.";
  }
  if (address.length < 5) {
    errors.address = "Enter your home address, street and city.";
  }
  if (Object.keys(errors).length > 0) return { errors, error: null };

  const db = getDb();
  const now = new Date();
  if (customer) {
    await db
      .update(customers)
      .set({
        bvn,
        dob,
        employerName,
        workEmail,
        address,
        updatedAt: now,
        ...(customer.stage === "profile" ? { stage: "link_account" as const } : {}),
      })
      .where(eq(customers.id, user.id));
  } else {
    await db.insert(customers).values({
      id: user.id,
      bvn,
      dob,
      employerName,
      workEmail,
      address,
      stage: "link_account",
      createdAt: now,
      updatedAt: now,
    });
  }

  redirect("/join/link");
}
