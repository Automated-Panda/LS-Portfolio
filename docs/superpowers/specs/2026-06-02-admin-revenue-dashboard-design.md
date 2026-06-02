# Admin Dashboard — Slice 3: Revenue Dashboard

**Date:** 2026-06-02
**Status:** Approved (design)
**Author:** James + Claude

## Context

This is **Slice 3** of the Admin Dashboard (see
`docs/superpowers/specs/2026-06-02-admin-roles-shell-user-management-design.md`
and `docs/admin.md` for the slice roadmap). Slices 1+2 (roles + User Management)
shipped 2026-06-02.

GT Vault's billing runs on Stripe. **Revenue dollars are not stored in our DB** —
the Stripe webhook records only credit deltas + Stripe IDs (`user_credits`
.`stripe_customer_id`/`stripe_subscription_id`; `credit_transactions` has no
amount column). Therefore a revenue dashboard MUST read from the Stripe API.
The server-side client already exists: `getStripe()` in `lib/stripe/client.ts`
(SDK v22, `STRIPE_SECRET_KEY`). No revenue read calls exist yet.

The dashboard reflects whichever **mode** the Stripe key is in (test vs live) — a
test key shows test transactions. The UI surfaces a "Test data" badge accordingly.

## Goals

An owner-only `/admin/revenue` page showing, read live from Stripe:
- **MRR** (monthly recurring revenue) + **active / cancelled subscription** counts
- **Total revenue** (gross, all-time — successful subscription invoices + one-time
  credit packs)
- **Recent payments** (latest ~10) and **failed / past-due payments**
- **Plan breakdown** (Starter / Plus / Pro) + **ARPU**

## Non-Goals (deferred)

- Cached/snapshot storage (`revenue_snapshots` + cron) — revisit if charge volume
  makes live pagination slow.
- Charts/graphs, date-range filtering, CSV export.
- Net-revenue / refund breakdown (gross only this slice).
- Surfacing MRR on the `/admin` overview page (optional future tweak).
- "Trial users" metric — the Pro plan has no trial.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Data source | Stripe API, live per page load | Revenue $ exists only in Stripe; volume is tiny |
| Money math | Pure, unit-tested module separate from I/O | Mirrors `credits/logic.ts` ↔ `server.ts`; testable |
| Caching | None (live) | YAGNI at current scale; note when to add |
| Access | Owner-only (`isOwner` → redirect editors) | Same as `/admin/users` |
| Plan disambiguation | one-time charge $9.99 vs Pro $9.99 resolved by `hasInvoice` | Subscription charges carry an invoice; one-time packs don't |

## Architecture

### 1. I/O layer — `lib/stripe/revenue.ts` (server-only)

Uses `getStripe()`. Normalizes Stripe objects into plain records for the pure
layer (auto-paginates with the SDK's async iteration):

- `listSubscriptions(): Promise<SubRecord[]>` — `subscriptions.list({ status: "all" })`
  with the price expanded. `SubRecord = { status: string; monthlyAmountCents: number; tier: "Pro" }`.
  `monthlyAmountCents` normalizes the price to a monthly figure (unit_amount,
  divided/multiplied if the interval is year/week — for GT Vault it's monthly).
- `listCharges(): Promise<ChargeRecord[]>` — `charges.list`, auto-paginated.
  `ChargeRecord = { amountCents: number; paid: boolean; refunded: boolean;
  status: string; hasInvoice: boolean; createdAt: number; email: string | null }`.
  `hasInvoice = charge.invoice != null`; `email` from
  `billing_details.email ?? receipt_email`.

Wrap calls so a missing/erroring key surfaces a typed failure the page renders
gracefully rather than throwing.

### 2. Pure metrics — `lib/stripe/revenue-metrics.ts` (no I/O, tested)

Operates on `SubRecord[]` / `ChargeRecord[]`:

- `computeMrr(subs): number` — sum `monthlyAmountCents` of subs whose status is
  exactly `active`. Other statuses (`canceled`, `past_due`, `incomplete`,
  `trialing`) do NOT count toward MRR.
- `subCounts(subs): { active: number; canceled: number }`.
- `totalRevenue(charges): number` — sum `amountCents` where `paid && !refunded`.
- `arpu(mrrCents, activeCount): number` — `activeCount > 0 ? mrrCents/activeCount : 0`.
- `planBreakdown(subs, charges): { tier, count, totalCents }[]` — mixed-basis by
  design: **Pro** = count of currently-active subscriptions (recurring, so "count"
  = active subs and `totalCents` = their MRR); **Starter/Plus** = all-time one-time
  packs, i.e. charges where `paid && !refunded && !hasInvoice`, bucketed by amount
  `499 → Starter`, `999 → Plus`. A `999` charge WITH an invoice is a Pro renewal
  (already represented by the active sub) and is excluded from the one-time
  buckets. The UI labels Pro as "/mo" to make the basis clear.
- `recentPayments(charges, n): ChargeRecord[]` — paid charges, newest first, top n.
- `failedPayments(charges): ChargeRecord[]` — `status === "failed"` (newest first).
- `formatCents(cents): string` — `$x.xx`.

Tier amounts come from `CREDIT_TIERS` (`lib/stripe/tiers.ts`) where possible, but
the Starter/Plus cents (499/999) are defined as constants in this module with a
comment tying them to the tiers (the authoritative amount is Stripe's price; these
constants are only for one-time-charge bucketing).

### 3. Page — `app/admin/revenue/page.tsx` (owner-only)

- `if (!(await isOwner())) redirect("/admin")`.
- Fetch `listSubscriptions()` + `listCharges()`; if the I/O layer reports a
  failure (no key / Stripe error), render a "Stripe unavailable" empty state.
- Compute metrics via the pure module; render:
  - Four stat cards: **MRR**, **Total revenue**, **Active subs** (with cancelled
    count), **ARPU**.
  - **Plan breakdown** row (Starter / Plus / Pro: count + total).
  - Two lists: **Recent payments** (email, amount, date, status) and
    **Failed / past-due** (or an "all clear" note when empty).
- **Test-mode badge:** detect from the key prefix (`sk_test_…`) via a small
  server check; show a "Test data" pill when in test mode.

### 4. Sidebar — `app/admin/layout.tsx`

Add an owner-only **Business** group with a **Revenue** link
(`/admin/revenue`), shown only when `owner` (alongside the existing People group).

### 5. Testing (TDD on the pure module)

`lib/stripe/revenue-metrics.test.ts`:
- `computeMrr`: sums only active subs; ignores canceled/incomplete.
- `subCounts`: correct active vs canceled tally.
- `totalRevenue`: sums paid; excludes refunded and failed.
- `arpu`: divides MRR by active count; returns 0 when no active subs.
- `planBreakdown`: Pro from subs; one-time 499→Starter, 999(no invoice)→Plus;
  999-with-invoice excluded from one-time.
- `recentPayments`: newest-first ordering + limit.
- `failedPayments`: only `failed` status.
- `formatCents`: `499 → "$4.99"`, `0 → "$0.00"`.

The Stripe I/O layer (`revenue.ts`) is verified by typecheck + manual smoke; it is
not unit-tested (would be all mocks).

## Acceptance Criteria

- [ ] Owner can open `/admin/revenue` from the sidebar; editors are redirected to
      `/admin`; normal users can't reach `/admin` at all.
- [ ] MRR, total revenue, active/cancelled subs, ARPU, plan breakdown, recent
      payments, and failed payments all render from live Stripe data.
- [ ] A `$9.99` one-time Plus pack and a `$9.99` Pro renewal are attributed to the
      correct tiers (via `hasInvoice`).
- [ ] Refunded and failed charges are excluded from total revenue.
- [ ] With a test-mode key, a "Test data" badge shows.
- [ ] If Stripe is unconfigured/unreachable, the page shows a friendly state (no
      crash).
- [ ] `npm run typecheck` and `npm test` pass (incl. the new metrics suite).
