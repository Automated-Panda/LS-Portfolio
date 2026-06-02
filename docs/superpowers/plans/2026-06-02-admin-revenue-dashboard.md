# Admin Revenue Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An owner-only `/admin/revenue` page showing MRR, total revenue, active/cancelled subs, ARPU, plan breakdown, and recent + failed payments — read live from the Stripe API.

**Architecture:** A pure, unit-tested metrics module (`lib/stripe/revenue-metrics.ts`) computes all figures from normalized records; a server-only I/O module (`lib/stripe/revenue.ts`) pulls + normalizes Stripe subscriptions and charges via the existing `getStripe()` client; the page renders it owner-gated. No new storage (live per load). Mirrors the existing `credits/logic.ts` ↔ `credits/server.ts` split.

**Tech Stack:** Next.js (App Router, server components), Stripe Node SDK v22, TypeScript, Vitest, Tailwind + shadcn.

**Spec:** `docs/superpowers/specs/2026-06-02-admin-revenue-dashboard-design.md`

---

## File Structure

- Create `lib/stripe/revenue-metrics.ts` — pure metrics + the shared `SubRecord`/`ChargeRecord` types.
- Create `lib/stripe/revenue-metrics.test.ts`.
- Create `lib/stripe/revenue.ts` — server-only Stripe I/O → normalized records.
- Create `app/admin/revenue/page.tsx` — owner-only page.
- Modify `app/admin/layout.tsx` — add the owner-only Revenue sidebar link.

---

## Task 1: Pure revenue metrics

**Files:**
- Create: `lib/stripe/revenue-metrics.ts`
- Test: `lib/stripe/revenue-metrics.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/stripe/revenue-metrics.test.ts
import { describe, it, expect } from "vitest";
import {
  computeMrr,
  subCounts,
  totalRevenue,
  arpu,
  planBreakdown,
  recentPayments,
  failedPayments,
  formatCents,
  type SubRecord,
  type ChargeRecord,
} from "./revenue-metrics";

function sub(over: Partial<SubRecord> = {}): SubRecord {
  return { status: "active", monthlyAmountCents: 999, tier: "Pro", ...over };
}
function charge(over: Partial<ChargeRecord> = {}): ChargeRecord {
  return {
    amountCents: 999,
    paid: true,
    refunded: false,
    status: "succeeded",
    hasInvoice: false,
    createdAt: 1_700_000_000_000,
    email: "a@b.com",
    ...over,
  };
}

describe("computeMrr", () => {
  it("sums only active subscriptions", () => {
    expect(
      computeMrr([sub(), sub({ status: "canceled" }), sub({ monthlyAmountCents: 500 })]),
    ).toBe(1499);
  });
});

describe("subCounts", () => {
  it("tallies active vs canceled", () => {
    const c = subCounts([sub(), sub({ status: "canceled" }), sub({ status: "canceled" })]);
    expect(c).toEqual({ active: 1, canceled: 2 });
  });
});

describe("totalRevenue", () => {
  it("sums paid, non-refunded charges only", () => {
    expect(
      totalRevenue([
        charge({ amountCents: 999 }),
        charge({ amountCents: 499 }),
        charge({ amountCents: 999, refunded: true }),
        charge({ amountCents: 999, paid: false, status: "failed" }),
      ]),
    ).toBe(1498);
  });
});

describe("arpu", () => {
  it("divides MRR by active subs, rounding to cents", () => {
    expect(arpu(2000, 2)).toBe(1000);
  });
  it("is 0 when there are no active subs", () => {
    expect(arpu(2000, 0)).toBe(0);
  });
});

describe("planBreakdown", () => {
  it("buckets Pro from active subs and one-time packs by amount, excluding renewals", () => {
    const subs = [sub(), sub({ status: "canceled" })];
    const charges = [
      charge({ amountCents: 499, hasInvoice: false }), // Starter
      charge({ amountCents: 999, hasInvoice: false }), // Plus
      charge({ amountCents: 999, hasInvoice: true }),  // Pro renewal -> excluded from one-time
      charge({ amountCents: 499, hasInvoice: false, refunded: true }), // refunded -> excluded
    ];
    const b = planBreakdown(subs, charges);
    expect(b).toEqual([
      { tier: "Starter", count: 1, totalCents: 499 },
      { tier: "Plus", count: 1, totalCents: 999 },
      { tier: "Pro", count: 1, totalCents: 999 },
    ]);
  });
});

describe("recentPayments", () => {
  it("returns paid charges newest-first, limited to n", () => {
    const r = recentPayments(
      [
        charge({ createdAt: 1, email: "old@x.com" }),
        charge({ createdAt: 3, email: "new@x.com" }),
        charge({ createdAt: 2, email: "mid@x.com" }),
        charge({ createdAt: 4, paid: false, status: "failed" }),
      ],
      2,
    );
    expect(r.map((c) => c.email)).toEqual(["new@x.com", "mid@x.com"]);
  });
});

describe("failedPayments", () => {
  it("returns only failed charges, newest-first", () => {
    const f = failedPayments([
      charge({ status: "failed", createdAt: 1 }),
      charge({ status: "succeeded" }),
      charge({ status: "failed", createdAt: 5 }),
    ]);
    expect(f.map((c) => c.createdAt)).toEqual([5, 1]);
  });
});

describe("formatCents", () => {
  it("formats cents as dollars", () => {
    expect(formatCents(499)).toBe("$4.99");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(1000)).toBe("$10.00");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/stripe/revenue-metrics.test.ts`
Expected: FAIL — `Cannot find module './revenue-metrics'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/stripe/revenue-metrics.ts
// Pure revenue math over normalized Stripe records (no I/O, unit-tested).

export type SubRecord = {
  status: string; // Stripe subscription status (active, canceled, past_due, …)
  monthlyAmountCents: number; // price normalized to a monthly figure
  tier: "Pro";
};

export type ChargeRecord = {
  amountCents: number;
  paid: boolean;
  refunded: boolean;
  status: string; // 'succeeded' | 'failed' | 'pending'
  hasInvoice: boolean; // true => subscription renewal; false => one-time pack
  createdAt: number; // epoch ms
  email: string | null;
};

export type TierBreakdown = { tier: string; count: number; totalCents: number };

// One-time pack amounts used ONLY to bucket one-time charges. The authoritative
// price lives in Stripe; these mirror lib/stripe/tiers.ts (Starter $4.99, Plus $9.99).
const STARTER_CENTS = 499;
const PLUS_CENTS = 999;

export function computeMrr(subs: SubRecord[]): number {
  return subs
    .filter((s) => s.status === "active")
    .reduce((sum, s) => sum + s.monthlyAmountCents, 0);
}

export function subCounts(subs: SubRecord[]): { active: number; canceled: number } {
  let active = 0;
  let canceled = 0;
  for (const s of subs) {
    if (s.status === "active") active++;
    else if (s.status === "canceled") canceled++;
  }
  return { active, canceled };
}

export function totalRevenue(charges: ChargeRecord[]): number {
  return charges
    .filter((c) => c.paid && !c.refunded)
    .reduce((sum, c) => sum + c.amountCents, 0);
}

export function arpu(mrrCents: number, activeCount: number): number {
  return activeCount > 0 ? Math.round(mrrCents / activeCount) : 0;
}

export function planBreakdown(
  subs: SubRecord[],
  charges: ChargeRecord[],
): TierBreakdown[] {
  const active = subs.filter((s) => s.status === "active");
  const proCount = active.length;
  const proTotal = active.reduce((sum, s) => sum + s.monthlyAmountCents, 0);

  let starterCount = 0;
  let starterTotal = 0;
  let plusCount = 0;
  let plusTotal = 0;
  for (const c of charges) {
    if (!c.paid || c.refunded || c.hasInvoice) continue; // exclude renewals, refunds, unpaid
    if (c.amountCents === STARTER_CENTS) {
      starterCount++;
      starterTotal += c.amountCents;
    } else if (c.amountCents === PLUS_CENTS) {
      plusCount++;
      plusTotal += c.amountCents;
    }
  }

  return [
    { tier: "Starter", count: starterCount, totalCents: starterTotal },
    { tier: "Plus", count: plusCount, totalCents: plusTotal },
    { tier: "Pro", count: proCount, totalCents: proTotal },
  ];
}

export function recentPayments(charges: ChargeRecord[], n: number): ChargeRecord[] {
  return charges
    .filter((c) => c.paid && !c.refunded)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, n);
}

export function failedPayments(charges: ChargeRecord[]): ChargeRecord[] {
  return charges
    .filter((c) => c.status === "failed")
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/stripe/revenue-metrics.test.ts`
Expected: PASS (8 describe blocks).

- [ ] **Step 5: Commit**

```bash
git add lib/stripe/revenue-metrics.ts lib/stripe/revenue-metrics.test.ts
git commit -m "feat(revenue): pure Stripe revenue metrics module"
```

---

## Task 2: Stripe I/O layer

**Files:**
- Create: `lib/stripe/revenue.ts`

- [ ] **Step 1: Write the module**

```ts
// lib/stripe/revenue.ts
// Server-only: pull + normalize Stripe data for the revenue dashboard. All money
// math lives in the pure ./revenue-metrics module; this file only does I/O.
import "server-only";

import type Stripe from "stripe";

import { getStripe } from "./client";
import type { SubRecord, ChargeRecord } from "./revenue-metrics";

export type RevenueData =
  | { ok: true; subs: SubRecord[]; charges: ChargeRecord[]; testMode: boolean }
  | { ok: false; reason: string };

/** Normalize a Stripe price to a monthly cents figure. */
function monthlyCents(price: Stripe.Price | null | undefined): number {
  if (!price || price.unit_amount == null) return 0;
  const amount = price.unit_amount;
  const interval = price.recurring?.interval;
  const count = price.recurring?.interval_count ?? 1;
  if (interval === "year") return Math.round(amount / (12 * count));
  if (interval === "week") return Math.round((amount * 52) / (12 * count));
  if (interval === "day") return Math.round((amount * 365) / (12 * count));
  return Math.round(amount / count); // month (or one-off) => as-is
}

export async function getRevenueData(): Promise<RevenueData> {
  let stripe: Stripe;
  try {
    stripe = getStripe();
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Stripe not configured." };
  }

  const testMode = (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_");

  try {
    const subs: SubRecord[] = [];
    // Stripe list endpoints are async-iterable and auto-paginate.
    for await (const s of stripe.subscriptions.list({ status: "all", limit: 100 })) {
      const price = s.items.data[0]?.price;
      subs.push({
        status: s.status,
        monthlyAmountCents: monthlyCents(price),
        tier: "Pro",
      });
    }

    const charges: ChargeRecord[] = [];
    for await (const ch of stripe.charges.list({ limit: 100 })) {
      charges.push({
        amountCents: ch.amount,
        paid: ch.paid,
        refunded: ch.refunded,
        status: ch.status,
        hasInvoice: ch.invoice != null,
        createdAt: ch.created * 1000,
        email: ch.billing_details?.email ?? ch.receipt_email ?? null,
      });
    }

    return { ok: true, subs, charges, testMode };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Stripe request failed." };
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors. (If the Stripe types complain that a list result isn't async-iterable, confirm the SDK version is v22 — `stripe.subscriptions.list(...)` returns an `ApiListPromise` that supports `for await`. Do NOT change the spec's approach; report BLOCKED with the exact type error if it genuinely won't compile.)

- [ ] **Step 3: Commit**

```bash
git add lib/stripe/revenue.ts
git commit -m "feat(revenue): server-only Stripe I/O for revenue dashboard"
```

---

## Task 3: Revenue page + sidebar link

**Files:**
- Create: `app/admin/revenue/page.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Create the page**

```tsx
// app/admin/revenue/page.tsx
import { redirect } from "next/navigation";

import { isOwner } from "@/lib/admin/guard";
import { getRevenueData } from "@/lib/stripe/revenue";
import {
  computeMrr,
  subCounts,
  totalRevenue,
  arpu,
  planBreakdown,
  recentPayments,
  failedPayments,
  formatCents,
  type ChargeRecord,
} from "@/lib/stripe/revenue-metrics";

function fmtDate(ms: number): string {
  return new Date(ms).toLocaleDateString();
}

export default async function AdminRevenuePage() {
  if (!(await isOwner())) redirect("/admin");

  const data = await getRevenueData();

  if (!data.ok) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Revenue</h1>
        <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
          Stripe is unavailable: {data.reason}
        </div>
      </div>
    );
  }

  const { subs, charges, testMode } = data;
  const mrr = computeMrr(subs);
  const counts = subCounts(subs);
  const total = totalRevenue(charges);
  const monthlyArpu = arpu(mrr, counts.active);
  const breakdown = planBreakdown(subs, charges);
  const recent = recentPayments(charges, 10);
  const failed = failedPayments(charges);

  const cards = [
    { label: "MRR", value: formatCents(mrr) },
    { label: "Total revenue", value: formatCents(total) },
    {
      label: "Active subs",
      value: `${counts.active}${counts.canceled ? ` (${counts.canceled} cancelled)` : ""}`,
    },
    { label: "ARPU", value: formatCents(monthlyArpu) },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-semibold">Revenue</h1>
        {testMode && (
          <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">
            Test data
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
          </div>
        ))}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Plan breakdown
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {breakdown.map((b) => (
            <div key={b.tier} className="rounded-lg border p-4">
              <p className="font-medium">
                {b.tier}
                {b.tier === "Pro" ? " /mo" : ""}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {b.count} × · {formatCents(b.totalCents)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <PaymentList title="Recent payments" rows={recent} emptyText="No payments yet." />
        <PaymentList title="Failed / past-due" rows={failed} emptyText="None — all clear." />
      </div>
    </div>
  );
}

function PaymentList({
  title,
  rows,
  emptyText,
}: {
  title: string;
  rows: ChargeRecord[];
  emptyText: string;
}) {
  return (
    <div>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      <div className="overflow-hidden rounded-lg border">
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b last:border-0">
                  <td className="px-3 py-2">{r.email ?? "—"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCents(r.amountCents)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{fmtDate(r.createdAt)}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the sidebar link**

In `app/admin/layout.tsx`, find the owner-only People block:

```tsx
          {owner && (
            <div>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                People
              </p>
              <AdminNavLink href="/admin/users">Users</AdminNavLink>
            </div>
          )}
```

Add this block immediately AFTER it (still inside the `<nav>`):

```tsx
          {owner && (
            <div>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Business
              </p>
              <AdminNavLink href="/admin/revenue">Revenue</AdminNavLink>
            </div>
          )}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Full test suite**

Run: `npm test`
Expected: all green, including the new `lib/stripe/revenue-metrics.test.ts` suite.

- [ ] **Step 5: Manual smoke (controller/human — note for the executor)**

The interactive check (owner only): log in as the owner, open `/admin` → sidebar now shows **Business → Revenue**; the page renders the four stat cards, plan breakdown, and the two payment lists. With a test-mode key, the "Test data" badge shows. An editor visiting `/admin/revenue` is redirected to `/admin`. (This step needs a human/browser; do not block the commit on it.)

- [ ] **Step 6: Commit**

```bash
git add app/admin/revenue/page.tsx app/admin/layout.tsx
git commit -m "feat(revenue): owner-only /admin/revenue page + sidebar link"
```

---

## Self-Review Notes (for the executor)

- **Spec coverage:** MRR + active/cancelled (Task 1 `computeMrr`/`subCounts`, shown on page), total revenue (Task 1 `totalRevenue`), recent + failed (Task 1 `recentPayments`/`failedPayments`), plan breakdown + ARPU (Task 1 `planBreakdown`/`arpu`), live Stripe reads (Task 2), owner-gating + test badge + graceful failure (Task 3), sidebar link (Task 3).
- **Type consistency:** `SubRecord`/`ChargeRecord`/`TierBreakdown` defined once in `revenue-metrics.ts` and imported by `revenue.ts` and the page. Function names match across tasks.
- **No new storage / migration** — live reads only, per spec.
- **Gross revenue only** (refunded + failed excluded from totals); refunds are not separately netted (deferred per spec).
- **Scale:** `getRevenueData` paginates up to the Stripe default; trivial now. If charge volume grows large, revisit with a cached snapshot (future).
