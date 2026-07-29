# Foodline internal contracts

The authoritative map of the engine layer for anyone building UI on top of it.
Do not invent APIs: everything you need is listed here. If something is
genuinely missing, add it in `src/lib` following the same patterns.

## Non-negotiable product rules

- All money is integer kobo end to end. Render with `<Money kobo={...} />` or
  `formatNaira()` / `formatNairaWhole()` from `src/lib/money.ts`.
- No em dashes anywhere in copy. Use commas, colons or full stops.
- Microcopy register: professional Nigerian English, warm and direct, sentence
  case, no exclamation marks on trust/money screens, always name exact amounts
  and dates ("We will debit ₦42,500 on 28 Aug, nothing more").
- Every visible control works. No dead buttons, no TODOs, no lorem ipsum.
- Every screen designs its loading (Skeleton), empty (EmptyState), and error
  (Notice + recovery action) states.

## Auth and sessions (`src/lib/session.ts`)

- `requireRole(role)` in a server component/layout: returns `SessionUser`
  `{ id, role, name, email }` or redirects. Call it in each area layout.
- `apiUser(role?)` in route handlers: returns user or null (no redirect).
- `createSession(userId, role)`, `destroySession()`.
- `logout()` server action from `src/lib/auth-actions.ts`: use in
  `<form action={logout}>`.
- Login page exists at `/login` (do not rebuild it). Signup happens inside
  customer onboarding at `/join`.
- Middleware already redirects unauthenticated `/app`, `/retailer`, `/admin`.

## Database (`src/db`)

- `getDb()` inside request scope (route handlers, server actions, dynamic
  server components). `getDbAsync()` for possibly-static contexts.
- Never construct db clients at module scope.
- Tables (import from `@/db/schema`): `users`, `sessions`, `customers`,
  `bankTransactions`, `salaryDetections`, `products`, `productUnits`,
  `retailers`, `orders`, `orderItems`, `mandates`, `loans`, `installments`,
  `debitAttempts`, `inflowEvents`, `settlements`, `settings`, `ledgerEvents`,
  `webhookEvents`. Read `src/db/schema.ts` for exact columns and enums.
- Timestamps are `Date` objects (`timestamp_ms`), business dates are
  `YYYY-MM-DD` strings.

## Engine services (call these, do not reimplement)

`src/lib/settings.ts`
- `getConfig(db): Promise<LendingConfig>` and `updateConfig(db, patch, updatedBy)`.
- `LendingConfig` fields: limitPercent, minLimitKobo, maxLimitKobo,
  minSalaryMonths, tolerancePct, salaryFloorKobo, installmentPlans
  (`{installments, marginBps}[]`), debitTrigger, fallbackDebitDays,
  retryIntervalDays, maxRetries, graceDays, cardExpiryHours,
  mandateCapMultiplier, mandateMonths, demoMode.

`src/lib/onboarding.ts`
- `linkMonoAccount(db, customerId, code)` after the Connect widget succeeds.
- `runSalaryVerification(db, customerId): SalaryDetection` (detection +
  audit rows; sets stage to confirm_salary when eligible).
- `assignLimit(db, customerId): limitKobo` (stage limit_assigned).
- `createStandingMandate(db, customerId): MandateSetupResult`
  `{ mandateId, status, transferDestinations, amountCapKobo, autoApproved }`.
  In Mono sandbox this auto-approves (stage becomes active immediately).

`src/lib/checkout.ts`
- `placeOrder(db, customerId, lines: {productUnitId, qty}[], installmentsCount)`
  returns `{ok: true, orderId, voucherCode} | {ok: false, error}`. Handles
  stock, credit, mandate cap, schedule, ledger.

`src/lib/settlement.ts`
- `redeemAndSettle(db, {codeOrToken, retailerId})` returns
  `{ok: true, orderId, settlementStatus, reference, amountKobo} | {ok: false, error}`.

`src/lib/debit-engine.ts`
- `availableCreditKobo(db, customerId)`, `outstandingKobo(db, customerId)`.
- `runSweep(db)` (admin button), `processInflow(...)` (used by demo route).

`src/lib/underwriting.ts` (pure): `detectSalary`, `computeLimit`,
`buildSchedule`, `mandateTerms`, `matchesSalarySignature`.

`src/lib/mono.ts` / `src/lib/paystack.ts`: typed API clients. UI-relevant:
`listBanks()`, `resolveAccount(accountNumber, bankCode)`, `getMandate(id)`.
Errors throw `MonoError` / `PaystackError` with human-usable `.message`.

`src/lib/ledger.ts`: `logEvent(db, {type, message, ...})` for every
consequential admin/user action you add.

Utilities: `src/lib/dates.ts` (`todayLagos`, `formatDate`, `formatDateShort`,
`formatDateTime`, `addDays`, `diffDays`, `nextDateWithDay`),
`src/lib/ids.ts` (`uid`, `voucherCode`, `randomToken`).

## Existing HTTP surface (do not duplicate)

- `POST /api/webhooks/mono`, `POST /api/webhooks/paystack`
- `POST /api/dev/seed` (x-seed-secret)
- `POST /api/demo/simulate-salary` (admin session; optional `{customerId}`)
- `POST /api/jobs/sweep` (admin session or x-cron-secret)
- `GET /img/<r2-key>` serves R2 objects (product image uploads land here)
- Static product images: `/products/<slug>.jpg` with `public/products/manifest.json`

Product `imageKey` column holds a site-relative URL path, either
`/products/<slug>.jpg` (seeded static) or `/img/<r2-key>` (admin upload).

## Environment

`getEnv(name)` / `getEnvOptional(name)` from `src/lib/env.ts`. Available:
MONO_SECRET_KEY, MONO_PUBLIC_KEY, NEXT_PUBLIC_MONO_PUBLIC_KEY,
MONO_WEBHOOK_SECRET, PAYSTACK_SECRET_KEY, PAYSTACK_PUBLIC_KEY,
SESSION_SECRET, SEED_SECRET, CRON_SECRET.

## Design system (`src/app/globals.css`, `src/components/ui.tsx`)

Palette (Tailwind color names): `terra` #C2410C primary, `terra-deep` hover,
`terra-tint` selected bg, `mango` #F5A524 (dark surfaces ONLY, never text on
light), `espresso` #211512 dark anchor, `espresso-2` raised dark, `oat`
#FAF6F0 app bg, `wheat` wells/skeletons, `cocoa` secondary text, `ash` muted
text, `cream` text on dark, `crust` borders; semantic `good/warn/bad/note`
with `-tint` pairs (tint bg always pairs with its full-strength text color).

Type: `font-display` utility (Fraunces, for screen titles, hero money
figures, the card wordmark), body defaults to Inter. `tnum` utility for any
number in a table/list. Radii: rounded-xs/sm/md/lg/xl (6/10/14/20/28px);
primary CTAs and pills are rounded-full. Shadows: shadow-1 resting,
shadow-2 raised, shadow-card for the Foodline Card only. Animations:
`animate-rise`, `animate-pop`, `animate-shimmer`. Textures: `card-weave`
(Foodline Card), `awning` (4px top stripe on partner/retailer surfaces).

Components from `@/components/ui`: `Button` (variant primary/secondary/
ghost/danger/dark, size sm/md/lg, `href` renders a Link, `loading`), `Card`,
`DarkCard`, `Pill` (tone), `Notice` (tone, title), `DemoBadge`, `Field`,
`Input`, `Select`, `Textarea`, `inputCls`, `Skeleton`, `EmptyState`,
`Money`, `Stat`, `StepBar`, `PlateRing` (limit gauge), `PageTitle`,
`Divider`, `cn`. Brand mark: `Logo` from `@/components/logo` (`on="dark"`
for espresso surfaces).

Icons: `lucide-react` at 1.75px stroke feel (default), sized with Tailwind
(`className="size-5"`). QR render: `react-qr-code`. QR camera scan: `jsqr`.
Mono widget: `@mono.co/connect.js` (client only).

Dark trust rule: mandate, BVN and security screens sit on `espresso` with
`cream` text. Everything else is warm oat. Touch targets at least 44px.
Mobile-first: primary CTA pinned to the bottom of the viewport on phone
flows (`pb-[calc(env(safe-area-inset-bottom)+16px)]`).

## Route ownership

- `/` landing, `/login` (built), `/join` customer onboarding
- `/app/...` customer area, `/retailer/...` retailer area, `/admin/...` admin
- `/r/[token]` QR deep link: resolves to the retailer redeem flow

## Conventions

- Server components by default; server actions (`"use server"` files) for
  mutations; client components only for interactivity (forms with
  `useActionState`, widgets, scanners).
- After mutations call `revalidatePath` on affected routes.
- Wrap Mono/Paystack calls in try/catch and translate failures into calm,
  specific copy with a retry path. Never surface raw error JSON.
- `npx tsc --noEmit` must stay clean.
