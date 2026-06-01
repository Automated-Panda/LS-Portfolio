# GT Vault — Pro Credit Pricing Strategy

**Date:** 2026-06-01
**Status:** Approved (strategy locked; implementation is a separate plan)
**Decision owner:** James

---

## Purpose

Settle the Pro monetization model for GT Vault **before any Stripe work begins**. The
flagship paid surface is the **AI** — today the Organizer (move/relocate cars), and on the
roadmap an open-ended **GTA knowledge assistant** (e.g. *"how do I max the Mr. Faber mission
payout?"*). Both call the Anthropic API, so usage has real per-action cost.

This spec defines the pricing **model, credit economics, free tier, packs, and expiry rules**.
It does **not** design the Stripe/metering implementation — that's the next planning phase.

---

## Model decision: credit-based, with a monthly subscription

A flat one-time unlock was rejected. Two reasons drove the credit model:

1. **Future cost is unbounded.** Today's Organizer is a bounded task on cheap **Haiku 4.5**
   (~1¢/run, portfolio context is prompt-cached). But the planned knowledge assistant is
   **open-ended chat on Sonnet + retrieval** — 5–20× the per-message cost and no natural
   stopping point. Credits future-proof this; a one-time unlock would not.
2. **Recurring revenue + FOMO.** Credits enable impulse top-ups and a "just one more message"
   dynamic, plus a monthly subscription hook. End users don't know/care about underlying cost;
   they buy credits as a unit of value.

The raw API cost is trivially small today, so credits are primarily a **packaging / value /
future-proofing** lever, not a cost-recovery mechanism. Margin lands comfortably at **80%+**
across every tier regardless.

---

## Credit costs per action

Charge **per action type**, scaled by **number of intents** (something the user can count) —
never by token size. The Organizer parser already returns a structured list of "moves," so
intent-count is known before charging.

| Action | Credits |
|---|---|
| 🧠 Generate Organizer plan | **5 base + 2 per extra intent** |
| 💬 Chat / knowledge Q&A (one reply) | **2** |
| ✏️ Tweak an existing plan | **1** |
| ✅ Apply plan · ↩️ Undo · browse / net worth / everything else | **0 (free forever)** |

**Worked examples:**
- *"put my drift cars in Mission Row"* → 1 intent → **5 credits** (floor)
- *"supers in mansions, drift in nightclub, offroad in Eclipse"* → 3 intents → 5+2+2 = **9 credits**
- *"how do I max the Mr. Faber payout?"* → **2 credits**

**Rules:**
- **Only the API call costs credits.** Applying, undoing, browsing, net-worth, etc. are local
  DB work = always free.
- **Show the cost before committing.** The parsed move list lets the UI say *"This will cost 3
  credits — proceed?"* before applying. No surprise drains.
- **Failed parse / 0 valid moves → 0 credits charged.** Users only pay when they get something
  real.
- **Chat is priced at 2 (not 1)** as cheap insurance against the future Sonnet-powered knowledge
  base costing 5–20× a Haiku run.

---

## Free allotment

Do **both** a one-time signup bonus *and* a recurring monthly refill — they do different jobs.

| | Amount | Job |
|---|---|---|
| **Signup bonus** (one-time) | **20 credits** | The hook — ~4 plans, or 2 plans + several questions. Enough to feel the "wow." |
| **Monthly refill** (recurring) | **10 credits / month** | The re-hook + FOMO — 2 plans or 5 questions. Casual users stay free; active users hit the wall and top up. |

Cost to James is trivial today and bounded by the allotment even once Sonnet chat ships.

---

## Packs + subscription

Each tier is better **$/credit** than the last (nudges bigger buys); the subscription is the
deliberate best-value winner to drive recurring revenue.

| Tier | Credits | Price | $/credit | Feels like |
|---|---|---|---|---|
| **Starter** (one-time) | 50 | **$4.99** | $0.100 | ~10 plans · "try it" |
| **Plus** (one-time) | 150 | **$9.99** | $0.067 | ~30 plans · *Best value* |
| ⭐ **Pro** (monthly sub) | **250 / mo** | **$9.99 / mo** | $0.040 | Cheapest per credit · recurring |

Pro is priced **at the same $9.99 as the Plus pack but with 100 more credits + monthly
refresh** — making the sub an obvious upgrade for anyone who'd buy Plus more than once.

### Expiry rules
- 🟢 **Purchased pack credits never expire** — avoids "I paid for these" complaints.
- 🔵 **Subscription credits refresh monthly and do not stack** — use-it-or-lose-it = built-in
  FOMO and protects against unbounded liability.
  - *Optional friendlier variant for later:* roll over up to one month's worth.

---

## What's free vs Pro

- **Free forever:** all portfolio tracking — vehicles, properties, businesses, net worth,
  filters, admin (owner), import/export. The app is fully usable without ever paying.
- **Credit-gated:** AI actions only (Organizer plan generation, plan tweaks, knowledge Q&A).
- Free users get the signup bonus + monthly refill so the AI is always *tastable*, never a
  hard wall from message one.

---

## Out of scope for this spec (next: implementation plan)

These are flagged for the Stripe/implementation planning phase, not decided here:

- Stripe product/price setup (one-time packs vs recurring sub), checkout, customer portal,
  webhook handling (purchase fulfillment, sub renewal, cancellation, refunds).
- **Credit ledger**: balance storage, debit/credit transactions, idempotency, source tracking
  (signup / refill / purchase / sub / spend), separating never-expire purchased credits from
  monthly-reset sub credits.
- Monthly refill + sub-reset mechanism (cron / on-read accrual).
- **Gating the currently-open Organizer** — it's live and fully usable today; must enforce
  credit checks before friends launch (this was the original top priority).
- UI: balance display, cost-preview confirmation, "out of credits" / top-up prompts, pricing
  page, post-purchase states.
- Abuse/edge handling: concurrent spends, balance race conditions, failed-charge refunds.

---

## Margin check

Cheapest credit price is $0.040 (Pro sub). A plan charges ≥5 credits = ≥$0.20 revenue against
~1¢ Haiku cost; chat charges 2 credits = $0.08 against ~3¢ Sonnet cost. **80%+ margin
everywhere**, satisfying the target.
