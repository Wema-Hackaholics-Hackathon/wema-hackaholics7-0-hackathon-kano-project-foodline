import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// All monetary values are integer kobo (NGN lowest denomination), matching
// Mono and Paystack API conventions. Format for display with lib/money.ts.

// ---------------------------------------------------------------------------
// Identity + auth
// ---------------------------------------------------------------------------

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    role: text("role", { enum: ["customer", "retailer", "admin"] }).notNull(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [uniqueIndex("users_email_idx").on(t.email)]
);

export const sessions = sqliteTable(
  "sessions",
  {
    // SHA-256 hash of the bearer token; the raw token only lives in the cookie
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)]
);

// ---------------------------------------------------------------------------
// Customer profile + salary verification
// ---------------------------------------------------------------------------

export const customers = sqliteTable("customers", {
  // Same id as the owning user row
  id: text("id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  bvn: text("bvn").notNull(),
  dob: text("dob").notNull(), // YYYY-MM-DD
  employerName: text("employer_name").notNull(),
  workEmail: text("work_email").notNull(),
  address: text("address"),
  // Geocoded home address, used to recommend nearby pickup stores.
  // Cached so the demo never depends on a live geocoding call.
  state: text("state"),
  lga: text("lga"),
  lat: real("lat"),
  lng: real("lng"),
  geoLabel: text("geo_label"),
  // Onboarding progression
  stage: text("stage", {
    enum: [
      "profile",
      "link_account",
      "verify_salary",
      "confirm_salary",
      "limit_assigned",
      "active",
      "suspended",
      "rejected",
    ],
  })
    .notNull()
    .default("profile"),
  // Mono linkage
  monoCustomerId: text("mono_customer_id"),
  monoAccountId: text("mono_account_id"),
  accountName: text("account_name"),
  accountNumber: text("account_number"),
  bankName: text("bank_name"),
  bankCode: text("bank_code"),
  bankNipCode: text("bank_nip_code"),
  dataStatus: text("data_status"), // Mono AVAILABLE | PROCESSING | PARTIAL | UNAVAILABLE
  // Verified salary facts (set by underwriting)
  salaryAmountKobo: integer("salary_amount_kobo"),
  salaryMonths: integer("salary_months"),
  salaryDayOfMonth: integer("salary_day_of_month"),
  salaryEmployerGuess: text("salary_employer_guess"),
  nextPayDate: text("next_pay_date"), // YYYY-MM-DD
  salaryVerifiedAt: integer("salary_verified_at", { mode: "timestamp_ms" }),
  // Credit
  creditLimitKobo: integer("credit_limit_kobo").notNull().default(0),
  isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
});

// Cached bank transactions (pulled from Mono, or seeded in demo mode).
// Salary detection always runs against this cache so demo and live share
// one code path.
export const bankTransactions = sqliteTable(
  "bank_transactions",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    monoTxId: text("mono_tx_id"),
    narration: text("narration").notNull(),
    amountKobo: integer("amount_kobo").notNull(),
    type: text("type", { enum: ["credit", "debit"] }).notNull(),
    balanceKobo: integer("balance_kobo"),
    date: text("date").notNull(), // ISO datetime
    category: text("category"),
  },
  (t) => [
    index("bank_tx_customer_idx").on(t.customerId),
    uniqueIndex("bank_tx_mono_idx").on(t.customerId, t.monoTxId),
  ]
);

// Every salary detection run, kept for the auditable "how do you decide" story
export const salaryDetections = sqliteTable(
  "salary_detections",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    eligible: integer("eligible", { mode: "boolean" }).notNull(),
    avgAmountKobo: integer("avg_amount_kobo"),
    monthsFound: integer("months_found"),
    payDayOfMonth: integer("pay_day_of_month"),
    employerGuess: text("employer_guess"),
    nextPayDate: text("next_pay_date"),
    // Full working: matched transactions, amounts, intervals, rule results
    evidence: text("evidence", { mode: "json" }).notNull(),
    reasons: text("reasons", { mode: "json" }).notNull(), // failed/passed rule list
    configSnapshot: text("config_snapshot", { mode: "json" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("salary_det_customer_idx").on(t.customerId)]
);

// ---------------------------------------------------------------------------
// Catalog
// ---------------------------------------------------------------------------

// Products belong to the partner shop that stocks them. A retailer lists a
// product with the price they need (cost) and a suggested markup; it stays
// pending until an admin sets the final markup and approves it live.
export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    retailerId: text("retailer_id").references(() => retailers.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull(),
    category: text("category").notNull(),
    imageKey: text("image_key"), // R2 object key
    status: text("status", { enum: ["pending", "approved", "rejected", "archived"] })
      .notNull()
      .default("pending"),
    /** Retailer's recommendation to the admin, in basis points */
    suggestedMarkupBps: integer("suggested_markup_bps").notNull().default(1000),
    /** Markup the admin actually applied, in basis points. Never shown to customers. */
    markupBps: integer("markup_bps"),
    rejectionReason: text("rejection_reason"),
    submittedBy: text("submitted_by"), // retailer:<id> or admin:<id>
    reviewedBy: text("reviewed_by"),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("products_category_idx").on(t.category),
    index("products_retailer_idx").on(t.retailerId, t.status),
    index("products_status_idx").on(t.status),
  ]
);

// A product sells in one or more market units (mudu, congo, paint bucket,
// bag, carton, kg, litre...), each with its own price and stock.
export const productUnits = sqliteTable(
  "product_units",
  {
    id: text("id").primaryKey(),
    productId: text("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    unitLabel: text("unit_label").notNull(), // e.g. "1 mudu", "50kg bag"
    /** What the retailer is paid for this unit. Never shown to customers. */
    costKobo: integer("cost_kobo").notNull().default(0),
    /** What the customer pays: cost + admin markup. The only public figure. */
    priceKobo: integer("price_kobo").notNull(),
    stockQty: integer("stock_qty").notNull().default(0),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("product_units_product_idx").on(t.productId)]
);

// ---------------------------------------------------------------------------
// Retailers
// ---------------------------------------------------------------------------

export const retailers = sqliteTable(
  "retailers",
  {
    // Same id as the owning user row
    id: text("id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    businessName: text("business_name").notNull(),
    ownerName: text("owner_name"),
    contactPhone: text("contact_phone"),
    address: text("address"),
    // Service area, resolved from the address at geocoding time
    state: text("state"),
    lga: text("lga"),
    lat: real("lat"),
    lng: real("lng"),
    geoLabel: text("geo_label"),
    // Business identity
    rcNumber: text("rc_number"),
    businessType: text("business_type"), // e.g. Provision store, Open market stall
    yearsTrading: integer("years_trading"),
    description: text("description"),
    settlementBankCode: text("settlement_bank_code").notNull(),
    settlementBankName: text("settlement_bank_name").notNull(),
    settlementAccountNumber: text("settlement_account_number").notNull(),
    settlementAccountName: text("settlement_account_name").notNull(),
    /** false when demo mode let them onboard without a Paystack name check */
    bankVerified: integer("bank_verified", { mode: "boolean" }).notNull().default(false),
    paystackRecipientCode: text("paystack_recipient_code"),
    // Applications land as pending and go live only when an admin approves
    status: text("status", { enum: ["pending", "approved", "rejected", "suspended"] })
      .notNull()
      .default("pending"),
    rejectionReason: text("rejection_reason"),
    reviewedBy: text("reviewed_by"),
    reviewedAt: integer("reviewed_at", { mode: "timestamp_ms" }),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("retailers_status_idx").on(t.status),
    index("retailers_area_idx").on(t.state, t.lga),
  ]
);

// ---------------------------------------------------------------------------
// Orders + vouchers (the Foodline Card)
// ---------------------------------------------------------------------------

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    status: text("status", {
      enum: ["issued", "redeemed", "settled", "expired", "cancelled"],
    })
      .notNull()
      .default("issued"),
    totalKobo: integer("total_kobo").notNull(),
    // The Foodline Card
    voucherCode: text("voucher_code").notNull(), // short human code e.g. FL-7K3M9Q
    qrToken: text("qr_token").notNull(), // long random token in the QR
    issuedAt: integer("issued_at", { mode: "timestamp_ms" }).notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    redeemedAt: integer("redeemed_at", { mode: "timestamp_ms" }),
    redeemedByRetailerId: text("redeemed_by_retailer_id").references(() => retailers.id),
    // The store the customer chose at checkout. The card is pushed to this
    // retailer's queue; it is a recommendation, not a lock, so another
    // partner store can still honour the card.
    pickupRetailerId: text("pickup_retailer_id").references(() => retailers.id),
    // Handover requires BOTH sides to confirm. Settlement fires only when
    // both timestamps are set, so a leaked code alone cannot move money.
    customerConfirmedAt: integer("customer_confirmed_at", { mode: "timestamp_ms" }),
    retailerConfirmedAt: integer("retailer_confirmed_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("orders_voucher_idx").on(t.voucherCode),
    uniqueIndex("orders_qr_idx").on(t.qrToken),
    index("orders_customer_idx").on(t.customerId),
    index("orders_status_idx").on(t.status),
    index("orders_pickup_idx").on(t.pickupRetailerId, t.status),
  ]
);

export const orderItems = sqliteTable(
  "order_items",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: text("product_id").notNull(),
    productUnitId: text("product_unit_id").notNull(),
    // Snapshots so history survives catalog edits
    productName: text("product_name").notNull(),
    unitLabel: text("unit_label").notNull(),
    unitPriceKobo: integer("unit_price_kobo").notNull(),
    /** Retailer's share per unit at the time of sale; the rest is Foodline's markup */
    unitCostKobo: integer("unit_cost_kobo").notNull().default(0),
    qty: integer("qty").notNull(),
    lineTotalKobo: integer("line_total_kobo").notNull(),
    lineCostKobo: integer("line_cost_kobo").notNull().default(0),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)]
);

// ---------------------------------------------------------------------------
// Standing credit-line mandate (one per customer onboarding, Mono MDD)
// ---------------------------------------------------------------------------

// Variable e-mandate capped at limit + max margin. Variable because Mono's
// Debit API only supports variable mandates, and Foodline's engine (not
// Mono's scheduler) decides debit timing from salary detection. The customer
// authorises once (N50 NIBSS transfer); every later purchase debits under it.
export const mandates = sqliteTable(
  "mandates",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    monoMandateId: text("mono_mandate_id"),
    reference: text("reference").notNull(),
    status: text("status", {
      enum: ["initiated", "approved", "rejected", "cancelled", "expired"],
    })
      .notNull()
      .default("initiated"),
    readyToDebit: integer("ready_to_debit", { mode: "boolean" }).notNull().default(false),
    amountCapKobo: integer("amount_cap_kobo").notNull(),
    startDate: text("start_date").notNull(), // YYYY-MM-DD
    endDate: text("end_date").notNull(),
    nibssCode: text("nibss_code"),
    transferDestinations: text("transfer_destinations", { mode: "json" }),
    accountName: text("account_name"),
    accountNumber: text("account_number"),
    bankName: text("bank_name"),
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    approvedAt: integer("approved_at", { mode: "timestamp_ms" }),
    readyAt: integer("ready_at", { mode: "timestamp_ms" }),
    cancelledAt: integer("cancelled_at", { mode: "timestamp_ms" }),
    statusMessage: text("status_message"),
  },
  (t) => [
    index("mandates_customer_idx").on(t.customerId),
    uniqueIndex("mandates_ref_idx").on(t.reference),
    index("mandates_mono_idx").on(t.monoMandateId),
  ]
);

// ---------------------------------------------------------------------------
// Loans + repayment
// ---------------------------------------------------------------------------

export const loans = sqliteTable(
  "loans",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    mandateId: text("mandate_id")
      .notNull()
      .references(() => mandates.id),
    principalKobo: integer("principal_kobo").notNull(),
    marginBps: integer("margin_bps").notNull(), // basis points, e.g. 450 = 4.5%
    totalRepayableKobo: integer("total_repayable_kobo").notNull(),
    installmentsCount: integer("installments_count").notNull(),
    status: text("status", {
      enum: ["active", "repaid", "overdue", "cancelled", "defaulted"],
    })
      .notNull()
      .default("active"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("loans_customer_idx").on(t.customerId),
    index("loans_status_idx").on(t.status),
  ]
);

export const installments = sqliteTable(
  "installments",
  {
    id: text("id").primaryKey(),
    loanId: text("loan_id")
      .notNull()
      .references(() => loans.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    dueDate: text("due_date").notNull(), // YYYY-MM-DD, aligned to detected pay dates
    amountKobo: integer("amount_kobo").notNull(),
    status: text("status", {
      enum: ["scheduled", "processing", "paid", "failed", "overdue", "waived"],
    })
      .notNull()
      .default("scheduled"),
    paidAt: integer("paid_at", { mode: "timestamp_ms" }),
    attempts: integer("attempts").notNull().default(0),
    lastAttemptAt: integer("last_attempt_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("installments_loan_idx").on(t.loanId),
    index("installments_due_idx").on(t.dueDate, t.status),
  ]
);

// Every debit attempt against a mandate, successful or not
export const debitAttempts = sqliteTable(
  "debit_attempts",
  {
    id: text("id").primaryKey(),
    installmentId: text("installment_id")
      .notNull()
      .references(() => installments.id),
    loanId: text("loan_id").notNull(),
    reference: text("reference").notNull(),
    amountKobo: integer("amount_kobo").notNull(),
    status: text("status", { enum: ["processing", "successful", "failed"] }).notNull(),
    trigger: text("trigger", {
      enum: ["salary_detected", "fallback_schedule", "retry", "manual", "demo"],
    }).notNull(),
    responseCode: text("response_code"),
    message: text("message"),
    monoSessionId: text("mono_session_id"),
    feeKobo: integer("fee_kobo"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("debit_attempts_ref_idx").on(t.reference),
    index("debit_attempts_installment_idx").on(t.installmentId),
  ]
);

// Salary/inflow events observed on linked accounts (webhook, poll, or demo)
export const inflowEvents = sqliteTable(
  "inflow_events",
  {
    id: text("id").primaryKey(),
    customerId: text("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    amountKobo: integer("amount_kobo").notNull(),
    narration: text("narration"),
    date: text("date").notNull(),
    source: text("source", { enum: ["webhook", "poll", "demo"] }).notNull(),
    matchedSalary: integer("matched_salary", { mode: "boolean" }).notNull().default(false),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [index("inflow_customer_idx").on(t.customerId)]
);

// ---------------------------------------------------------------------------
// Retailer settlements (Paystack transfers)
// ---------------------------------------------------------------------------

export const settlements = sqliteTable(
  "settlements",
  {
    id: text("id").primaryKey(),
    orderId: text("order_id")
      .notNull()
      .references(() => orders.id),
    retailerId: text("retailer_id")
      .notNull()
      .references(() => retailers.id),
    /** Paid to the retailer: the cost portion of the order, not the customer total */
    amountKobo: integer("amount_kobo").notNull(),
    /** Foodline's retained markup on this order, for the P&L view */
    markupKobo: integer("markup_kobo").notNull().default(0),
    status: text("status", {
      enum: ["pending", "success", "failed", "reversed"],
    })
      .notNull()
      .default("pending"),
    paystackTransferCode: text("paystack_transfer_code"),
    reference: text("reference").notNull(),
    failureReason: text("failure_reason"),
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
    settledAt: integer("settled_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    uniqueIndex("settlements_ref_idx").on(t.reference),
    index("settlements_retailer_idx").on(t.retailerId),
    index("settlements_order_idx").on(t.orderId),
  ]
);

// ---------------------------------------------------------------------------
// Configuration (admin-adjustable, no redeploy)
// ---------------------------------------------------------------------------

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value", { mode: "json" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  updatedBy: text("updated_by"),
});

// ---------------------------------------------------------------------------
// Audit ledger: every decision the system makes, showable to a jury
// ---------------------------------------------------------------------------

export const ledgerEvents = sqliteTable(
  "ledger_events",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull(), // e.g. limit_calculated, debit_decision, mandate_event
    customerId: text("customer_id"),
    loanId: text("loan_id"),
    orderId: text("order_id"),
    actor: text("actor").notNull().default("system"), // system | admin:<id> | webhook | demo
    message: text("message").notNull(), // human-readable one-liner
    data: text("data", { mode: "json" }), // full structured working
    createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [
    index("ledger_type_idx").on(t.type),
    index("ledger_customer_idx").on(t.customerId),
    index("ledger_created_idx").on(t.createdAt),
  ]
);

// Webhook receipts for dedupe + debugging
export const webhookEvents = sqliteTable(
  "webhook_events",
  {
    id: text("id").primaryKey(),
    provider: text("provider", { enum: ["mono", "paystack"] }).notNull(),
    eventId: text("event_id"), // Mono event_id; Paystack has none, we derive one
    event: text("event").notNull(),
    payload: text("payload", { mode: "json" }).notNull(),
    status: text("status", { enum: ["received", "processed", "ignored", "error"] })
      .notNull()
      .default("received"),
    error: text("error"),
    receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
    processedAt: integer("processed_at", { mode: "timestamp_ms" }),
  },
  (t) => [uniqueIndex("webhook_dedupe_idx").on(t.provider, t.eventId)]
);
