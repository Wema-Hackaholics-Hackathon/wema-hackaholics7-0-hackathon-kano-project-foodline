# Foodline

**Your foodstuff, sorted.** A foodstuff credit line for Nigerian salary earners, built for Wema Bank Hackaholics 7.0 (Problem Statement 1: Open Banking).

Once the APIs are connected, what happens next? Foodline answers with the most universal expense in Nigeria: food. A verified salary earner links their salary account through Mono, gets a credit limit computed from their actual salary history, shops a curated foodstuff catalog priced in real market units (mudu, congo, paint bucket, bag), and walks into a partner store with a digital Foodline Card. The retailer scans it and is settled instantly through Paystack. Repayment is collected automatically by a NIBSS e-mandate the moment salary lands, in installments the customer chose at checkout.

- **Live app (frontend):** https://foodline.com.ng
- **Live API (backend):** https://foodline.com.ng/api (same Worker; e.g. `POST /api/webhooks/mono`, `POST /api/webhooks/paystack`)
- **Demo video (Loom):** _placeholder, add link before submission_
- **Judge access:** open https://foodline.com.ng/login and expand "Judge access" for one-tap demo credentials (customer, retailer, admin)

## The 90-second demo flow

1. **Onboard** at `/join`: create an account, enter BVN and employer details, link a salary account (Mono Connect, or the demo salary account so the stage never depends on sandbox uptime).
2. **Salary verification**: Foodline detects the recurring salary from real transaction data (amount, months, pay day, employer) and shows its working.
3. **Limit reveal**: 30% of verified salary (admin-tunable), clamped and floored to a clean figure. The moment is designed: counted up, explained, no hidden charges.
4. **Mandate**: one standing NIBSS e-mandate authorised once with a ₦50 transfer, capped at limit plus margin. We debit only the agreed repayment, only on payday.
5. **Shop**: market-unit catalog, basket capped to the live available limit, installment plan chosen at checkout with exact amounts and dates.
6. **The Foodline Card**: a premium digital voucher with QR and short code.
7. **Retailer scan**: the partner scans or types the code, confirms, and a real Paystack test transfer fires. Settlement reference on screen in seconds.
8. **Salary lands**: from the admin demo panel, simulate the salary credit. The debit engine matches the salary signature, collects the due installment under the mandate, and the customer dashboard updates. Every decision is in the audit ledger.

## Architecture

```
Next.js 16 (App Router, RSC + server actions)
        |
@opennextjs/cloudflare  ->  Cloudflare Worker (nodejs_compat)
        |                         |
   Cloudflare D1 (SQLite)    Cloudflare R2 (product images)
   via Drizzle ORM                |
        |                     /img/<key> streaming route
        |
External: Mono (Connect, Transactions, Income, Direct Debit v3 mandates)
          Paystack (account resolution, transfer recipients, transfers)
```

- **One Worker serves everything**: pages, API routes, webhooks, image streaming. One deploy, one domain.
- **Workers over Pages** because Cloudflare now routes all Next.js guidance through the OpenNext adapter on Workers: it runs the Node runtime (full Next feature set) and gives first-class D1/R2 bindings. `@cloudflare/next-on-pages` is legacy and Edge-runtime-only.
- **D1 over Neon**: the data model is relational but small and single-region; D1 keeps the whole stack inside Cloudflare with zero connection management on Workers. Drizzle migrations apply via `wrangler d1 migrations apply`.
- **All money is integer kobo** end to end, matching Mono and Paystack conventions exactly.

### The lending engine (src/lib)

| Module | What it does |
|---|---|
| `underwriting.ts` | Deterministic salary detection over cached bank transactions: clusters credit streams by amount proximity and narration signature, requires N consecutive months within a tolerance band above a salary floor (all admin-tunable), derives pay day and next pay date. Pure functions, fully unit-testable. |
| `settings.ts` | Every lending parameter lives in the database and is editable at `/admin/lending` with no redeploy: limit %, bounds, eligibility rules, installment plans and margins, debit trigger mode, retry policy, card expiry, mandate terms, demo mode. |
| `onboarding.ts` | Link account (Mono token exchange, transaction caching), verification, limit assignment, standing mandate creation. |
| `checkout.ts` | Validates stock, live available credit and mandate cap, snapshots prices, builds the installment schedule on detected pay dates, issues the card. |
| `debit-engine.ts` | The collections engine. Salary-signature matching (amount within tolerance, expected window) triggers installment debits; a fallback sweep collects missed dates, retries failures per policy and marks overdue. Every decision, including every "do nothing", is written to the ledger. |
| `settlement.ts` | Card redemption plus instant Paystack transfer to the retailer, with webhook reconciliation. |
| `ledger.ts` | The auditable decision trail behind `/admin/ledger`. When a judge asks "how do you decide?", the answer is on screen. |

### Mandates: a deliberate deviation from the brief

The brief says "Mono MDD, fixed debit". Mono's Debit API **only supports variable mandates**; fixed mandates are debited by Mono's own scheduler on a fixed calendar, which would make salary-triggered collection (the whole point of section 4 of the brief) impossible. Foodline therefore creates **one standing variable e-mandate per customer**, capped at limit x 1.1 (covers margin, admin-tunable), authorised once with the ₦50 NIBSS transfer. Foodline's engine controls debit timing and amounts under that cap. This is also the better product: one authorisation ever, not one per purchase.

### Demo mode (and why it exists)

Two hard facts about Mono e-mandates make a live end-to-end stage demo unreliable: the ₦50 NIBSS authorisation cannot be simulated in sandbox (mandates auto-approve there instead), and the post-approval "ready to debit" window is 5 minutes to 24 hours (a fixed 1 hour in sandbox). Additionally, sandbox Direct Debit requires completed business compliance on the Mono dashboard; until then mandate creation returns a 401.

Demo mode (an admin toggle) absorbs all of this without forking the logic:

- Demo customers get a realistic seeded 6-month salary history and run through the **same** detection, eligibility, limit and scheduling code as live customers.
- Demo mandates are created approved and ready; the authorisation UX is shown with a simulated ₦50 step, labelled honestly.
- If Mono declines a real mandate (e.g. compliance 401), demo mode absorbs it into a simulated mandate and records the truth in the ledger.
- "Simulate salary credit" in `/admin/demo` fires an inflow through the production debit engine.
- Everything else stays real: Paystack settlement transfers execute against the live test API (they settle synchronously in test mode), account resolution is real, webhooks are real.

The only visible difference is a small DEMO badge.

## Running it

### Prerequisites

Node 22+, npm, a Cloudflare account, Mono and Paystack test keys.

### Setup

```bash
npm install
cp .env.example .env        # fill in keys (next dev reads .env)
cp .env.example .dev.vars   # same values (wrangler preview reads .dev.vars)

# Database (local miniflare copy)
npx wrangler d1 migrations apply foodline-db --local

npm run dev                 # Next dev server with emulated bindings
npm run preview             # production build in the real workerd runtime
```

### Deploy

```bash
# once: create resources and put IDs in wrangler.jsonc (already done here)
npx wrangler d1 create foodline-db
npx wrangler r2 bucket create foodline-images

npx wrangler d1 migrations apply foodline-db --remote
npm run deploy              # builds with OpenNext and deploys the Worker

# runtime secrets on the Worker (repeat per key in .env.example)
npx wrangler secret put MONO_SECRET_KEY
```

The custom domain (`foodline.com.ng` + `www`) is declared in `wrangler.jsonc` as `custom_domain` routes; Cloudflare creates DNS records and certificates on deploy because the zone lives on the same account.

### Seed (one command to demo-ready)

```bash
curl -X POST https://foodline.com.ng/api/dev/seed -H "x-seed-secret: $SEED_SECRET"
```

Wipes and reseeds: 25 foodstuff products with market units and photography, the demo customer (with the salary history that drives real verification), the demo retailer (with a live Paystack test recipient), a small loan portfolio for the ops dashboard, and the lending config. Demo logins are printed on `/login`.

### Webhooks

Point the Mono dashboard webhook to `https://foodline.com.ng/api/webhooks/mono` (verification: the `mono-webhook-secret` header must equal `MONO_WEBHOOK_SECRET`). Point Paystack to `https://foodline.com.ng/api/webhooks/paystack` (verification: HMAC-SHA512 of the raw body). Both endpoints dedupe and keep replayable payloads in `webhook_events`.

### Test-mode notes worth knowing

- Paystack test transfers settle synchronously with `status: "success"`; OTP is disabled on this integration.
- Paystack test mode allows only 3 live-bank account resolutions per day; the hidden test bank code `001` (or `0000000000` at Zenith `057`) resolves without limits. Use those when demoing retailer onboarding.
- Mono sandbox auto-approves v3 mandates (no ₦50 transfer) once business compliance is completed on the dashboard; the ready-to-debit webhook fires after 1 hour in sandbox.

## Security posture

- PBKDF2-SHA256 password hashing (WebCrypto, per-user salts), hashed session tokens, httpOnly SameSite cookies, role-separated areas enforced server-side per request.
- Webhook signature verification on both providers, constant-time comparisons.
- Secrets only in env/Worker secrets; `.env` and `.dev.vars` are gitignored; nothing is hardcoded.
- Voucher QR tokens are 192-bit random and single-use; redemption is atomic against status.

## Repo map

```
src/app            routes: marketing, /join, /app, /retailer, /admin, /api
src/lib            the engine (see table above)
src/db             Drizzle schema (20 tables) + per-request client
src/components     design system kit (terracotta/espresso/oat, Fraunces + Inter)
drizzle/           generated SQL migrations
docs/              CONTRACTS.md (internal API map), IMAGE_CREDITS.md
```

Built with Next.js 16, Cloudflare Workers (OpenNext), D1, R2, Drizzle, Tailwind v4, Mono, Paystack.
