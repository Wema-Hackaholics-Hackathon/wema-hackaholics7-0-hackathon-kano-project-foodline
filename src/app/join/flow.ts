import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { customers } from "@/db/schema";
import { getSessionUser, HOME_PATH, type SessionUser } from "@/lib/session";

// Onboarding is a stage machine stored on customers.stage. This file is the
// single source of truth for "given who you are, which /join screen are you
// on". Every /join page calls requireJoinPage() so out-of-order visits always
// land on the right screen, and finished customers land in /app.

export type CustomerRow = typeof customers.$inferSelect;

export type JoinPage = "account" | "profile" | "link" | "salary" | "limit" | "mandate";

const PAGE_PATH: Record<JoinPage, string> = {
  account: "/join",
  profile: "/join/profile",
  link: "/join/link",
  salary: "/join/salary",
  limit: "/join/limit",
  mandate: "/join/mandate",
};

/** Load the session plus the customer's onboarding row, if either exists. */
export async function loadJoin(): Promise<{
  user: SessionUser | null;
  customer: CustomerRow | null;
}> {
  const user = await getSessionUser();
  if (!user || user.role !== "customer") return { user, customer: null };
  const db = getDb();
  const customer =
    (await db.select().from(customers).where(eq(customers.id, user.id)).limit(1))[0] ?? null;
  return { user, customer };
}

/** The canonical route to resume onboarding for this session. */
export function resumePath(user: SessionUser | null, customer: CustomerRow | null): string {
  if (!user) return PAGE_PATH.account;
  if (user.role !== "customer") return HOME_PATH[user.role];
  if (!customer) return PAGE_PATH.profile;
  switch (customer.stage) {
    case "profile":
      return PAGE_PATH.profile;
    case "link_account":
      return PAGE_PATH.link;
    case "verify_salary":
    case "confirm_salary":
      return PAGE_PATH.salary;
    case "limit_assigned":
      return PAGE_PATH.limit;
    default:
      // active, suspended, rejected: the customer area takes over
      return "/app";
  }
}

/**
 * Pages a session may sit on at each stage. A stage can allow more than one
 * page: that is what makes back affordances (edit profile from the link
 * screen, review the limit from the mandate screen) real links, not dead ends.
 */
function allowedPages(user: SessionUser | null, customer: CustomerRow | null): JoinPage[] {
  if (!user) return ["account"];
  if (user.role !== "customer") return [];
  if (!customer) return ["profile"];
  switch (customer.stage) {
    case "profile":
      return ["profile"];
    case "link_account":
      return ["link", "profile"];
    case "verify_salary":
    case "confirm_salary":
      return ["salary"];
    case "limit_assigned":
      return ["limit", "mandate"];
    default:
      return [];
  }
}

/**
 * Server-component guard for a /join page. Redirects to the correct stage's
 * route when this page is not valid for the session, otherwise returns the
 * loaded context.
 */
export async function requireJoinPage(page: "account"): Promise<{ user: null; customer: null }>;
export async function requireJoinPage(
  page: "profile"
): Promise<{ user: SessionUser; customer: CustomerRow | null }>;
export async function requireJoinPage(
  page: "link" | "salary" | "limit" | "mandate"
): Promise<{ user: SessionUser; customer: CustomerRow }>;
export async function requireJoinPage(
  page: JoinPage
): Promise<{ user: SessionUser | null; customer: CustomerRow | null }> {
  const { user, customer } = await loadJoin();
  if (!allowedPages(user, customer).includes(page)) {
    redirect(resumePath(user, customer));
  }
  return { user, customer };
}

/**
 * Server-action guard: the caller must be a customer at one of the given
 * stages, otherwise they are sent to wherever they actually belong.
 */
export async function requireActionCustomer(
  stages: CustomerRow["stage"][]
): Promise<{ user: SessionUser; customer: CustomerRow }> {
  const { user, customer } = await loadJoin();
  if (!user || user.role !== "customer" || !customer || !stages.includes(customer.stage)) {
    redirect(resumePath(user, customer));
  }
  return { user, customer };
}
