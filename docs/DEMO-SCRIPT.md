# The 90-second Lions Den run

Rehearse this until it is muscle memory. Two devices: phone (customer + retailer) and laptop on the projector (admin, plus a second browser profile for whichever role the phone is not showing).

## Before walking on stage

1. Fresh state: `curl -X POST https://foodline.com.ng/api/dev/seed -H "x-seed-secret: $SEED_SECRET"` (signs everyone out; do this at least 10 minutes before).
2. Log in ahead of time: phone tab 1 = Adaeze (customer), phone tab 2 = retailer, laptop = admin on /admin/demo. Credentials are on /login under Judge access.
3. Confirm once: /admin shows the portfolio, /app shows the ₦85,000 limit, camera permission already granted for the retailer scanner.

## The run (target 90 seconds)

| # | Beat | Where | What to say while doing it |
|---|---|---|---|
| 1 | Limit is already live | Customer /app | "Adaeze linked her ALAT salary account. Mono showed us six months of salary. She gets 30 percent of it: ₦85,000 of foodstuff credit." |
| 2 | Shop in market units | /app/shop | "Rice by the mudu, oil by the litre, real market pricing." Add 2-3 items fast. |
| 3 | Checkout on payday terms | /app/checkout | "Two installments, on her actual paydays. She repays exactly what we show. Nothing hidden." |
| 4 | The Foodline Card | /app/card | Hold the phone up. "No cash, no POS. This is her foodstuff card." |
| 5 | Retailer accepts | Retailer /retailer/redeem | Scan the QR with the retailer phone/tab. Confirm. |
| 6 | Instant settlement | Confirmation screen | "The retailer is paid before she leaves the shop. Real Paystack transfer, there is the reference." |
| 7 | Payday | Admin /admin/demo | Click "Pay Adaeze's salary". "Salary lands. Our engine recognises the signature and collects her installment under the NIBSS mandate she authorised once." |
| 8 | Proof | Customer /app/repayments + /admin/ledger | "Installment one: paid. And every decision the engine took is in this audit ledger, ready for a regulator." |

## If someone asks

- "How do you decide the limit?" -> /admin/ledger, expand the limit_calculated event: the formula with real numbers.
- "What if salary does not come?" -> /admin/lending: fallback debit days, retries, grace period, all tunable live.
- "What does the retailer risk?" -> Nothing. Goods leave the shelf only after settlement fires.
- "Is the mandate real?" -> Show /join mandate screen (new signup): the ₦50 NIBSS authorization UX with real transfer destinations. Explain sandbox compliance gating honestly if pressed.

## Known live-demo traps

- Paystack test mode: only 3 live-bank account resolutions per day. When demoing "add retailer", use account 0000000000 with Zenith (057) or bank code 001.
- Reseeding wipes sessions: never reseed between beats.
- Conference wifi: the settlement falls back to a simulated success for the demo retailer if Paystack is unreachable, so the flow never stalls.
