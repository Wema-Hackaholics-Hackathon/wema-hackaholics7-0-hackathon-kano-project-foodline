# Foodline

**Your foodstuff, sorted.** A foodstuff credit line for Nigerian salary earners, built for Wema Bank Hackaholics 7.0 (Problem Statement 1: Open Banking).

## Team Members
- Ibrahim Bako
- Musbahu Abubakar
- Halima Mahmoud

## 🚀 Live Demo
- **Live Application:** [https://www.foodline.com.ng](https://www.foodline.com.ng)
- **Backend API:** [https://www.foodline.com.ng/api](https://www.foodline.com.ng/api) (e.g., `POST /api/webhooks/mono`, `POST /api/webhooks/paystack`)
- **Recorded Demo:** _[Link to your recorded demo explaining how your solution works using Loom]_
- **Judge Access:** open [https://foodline.com.ng/login](https://foodline.com.ng/login) and expand "Judge access" for one-tap demo credentials (customer, retailer, admin)

## 🎯 The Problem
**How might we build an Open Banking solution that creates accessible credit for everyday needs?**

Currently, many Nigerian salary earners struggle to afford bulk food purchases before payday. Foodline tackles this by answering the most universal expense in Nigeria: food.

## ✨ Our Solution
Foodline is a digital foodstuff credit line for verified Nigerian salary earners. It leverages Open Banking to securely assess a user's salary history, determine a responsible credit limit, and provide a digital Foodline Card to purchase food from verified partner stores. 

A verified salary earner links their salary account through Mono, gets a credit limit computed from their actual salary history, shops a curated foodstuff catalog priced in real market units (mudu, congo, paint bucket, bag), and walks into a partner store with a digital Foodline Card. The retailer scans it and is settled instantly through Paystack. Repayment is collected automatically by a NIBSS e-mandate the moment salary lands, in installments the customer chose at checkout.

### The 90-second demo flow
1. **Onboard** at `/join`: create an account, enter BVN and employer details, link a salary account (Mono Connect, or the demo salary account so the stage never depends on sandbox uptime).
2. **Salary verification**: Foodline detects the recurring salary from real transaction data (amount, months, pay day, employer) and shows its working.
3. **Limit reveal**: 30% of verified salary (admin-tunable), clamped and floored to a clean figure. The moment is designed: counted up, explained, no hidden charges.
4. **Mandate**: one standing NIBSS e-mandate authorised once with a ₦50 transfer, capped at limit plus margin. We debit only the agreed repayment, only on payday.
5. **Shop**: market-unit catalog, basket capped to the live available limit, installment plan chosen at checkout with exact amounts and dates.
6. **The Foodline Card**: a premium digital voucher with QR and short code.
7. **Retailer scan**: the partner scans or types the code, confirms, and a real Paystack test transfer fires. Settlement reference on screen in seconds.
8. **Salary lands**: from the admin demo panel, simulate the salary credit. The debit engine matches the salary signature, collects the due installment under the mandate, and the customer dashboard updates. Every decision is in the audit ledger.

## 🛠️ Tech Stack
- **Frontend:** Next.js 16 (App Router, RSC + server actions), Tailwind CSS v4
- **Backend:** Cloudflare Workers (via `@opennextjs/cloudflare`)
- **Database:** Cloudflare D1 (SQLite) with Drizzle ORM
- **Storage:** Cloudflare R2 (for product images)
- **APIs:** 
  - Mono (Connect, Transactions, Income, Direct Debit v3 mandates)
  - Paystack (account resolution, transfer recipients, transfers)
  - Google Maps API (for nearest-store recommendations)

## ⚙️ How to Set Up and Run Locally

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

### Seed (one command to demo-ready)
```bash
curl -X POST http://localhost:3000/api/dev/seed -H "x-seed-secret: $SEED_SECRET"
```
Wipes and reseeds: 25 foodstuff products with market units and photography, the demo customer (with the salary history that drives real verification), the demo retailer (with a live Paystack test recipient), a small loan portfolio for the ops dashboard, and the lending config. Demo logins are printed on `/login`.
