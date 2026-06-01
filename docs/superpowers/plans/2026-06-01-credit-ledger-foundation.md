# Credit Ledger Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the server-side credit balance system — bucketed balances, signup bonus + monthly free refill, and tested spend/grant logic — that the Organizer gating (Plan 2) and Stripe purchases (Plan 3) will consume.

**Architecture:** A `user_credits` row per user holds three buckets (`free_monthly`, `sub_monthly`, `balance_credits`) as the source of truth, plus an append-only `credit_transactions` audit log. The risky math (monthly reset, sub expiry, spend allocation across buckets) lives in **pure, unit-tested functions** (`lib/credits/logic.ts`); a thin server layer (`lib/credits/server.ts`) loads the row, applies the pure logic, and persists via the service-role client using compare-and-swap to avoid races.

**Tech Stack:** Next.js 15 (App Router) · Supabase Postgres + RLS · TypeScript · Vitest (new — for the credit math only).

**Spec:** `docs/superpowers/specs/2026-06-01-pro-credit-pricing-design.md`

---

## Key decisions baked in (confirmed with James)

- **Buckets:** `free_monthly` (resets to 10 every 30 days), `sub_monthly` (set to 250 per Stripe cycle; 0 if no sub), `balance_credits` (never expires — holds the 20 signup bonus + purchased packs).
- **Subscribers get NO free refill** — the monthly free top-up only applies when `has_active_sub = false`.
- **Spend order:** `free → sub → purchased` (drain the expiring buckets first, protect paid-for credits last).
- **Signup grant:** 20 into `balance_credits` + 10 into `free_monthly` (total 30 to start).
- **Cost helpers** (used by Plan 2): plan = `5 + 2×(intents−1)`, tweak = `1`, chat = `2` (chat is future).
- **All credit *mutations* use the service-role client** (`createAdminClient`) — there are deliberately no user UPDATE/INSERT RLS policies on these tables. Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env.local` (local) and Vercel (prod).

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0025_add_credits.sql` (create) | `user_credits` + `credit_transactions` tables, `credit_reason` enum, RLS, signup trigger update, backfill |
| `lib/credits/constants.ts` (create) | All credit amounts + `planCost()` / cost helpers — single source of truth |
| `lib/credits/logic.ts` (create) | Pure functions: `totalBalance`, `normalize`, `spend` — no I/O |
| `lib/credits/logic.test.ts` (create) | Vitest unit tests for the pure logic |
| `lib/credits/server.ts` (create) | Server layer: `getCreditState`, `getBalance`, `spendCredits`, `grantCredits` (service-role + CAS) |
| `lib/credits/types.ts` (create) | Row type + DB-row→`CreditState` mapper |
| `scripts/credits-check.ts` (create) | Manual verification: print a user's buckets from the real DB |
| `vitest.config.ts` (create) | Vitest config (node environment) |
| `package.json` (modify) | Add `vitest` dep + `test` / `test:watch` / `credits:check` scripts |

---

### Task 1: Database migration — credits tables, signup grant, backfill

**Files:**
- Create: `supabase/migrations/0025_add_credits.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0025_add_credits.sql
-- Credit balances (bucketed) + append-only audit log for the AI credit system.

-- ── user_credits: source of truth for balances ──────────────────────────────
create table if not exists public.user_credits (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  free_monthly       integer not null default 0 check (free_monthly >= 0),
  free_period_start  timestamptz not null default now(),
  sub_monthly        integer not null default 0 check (sub_monthly >= 0),
  sub_period_end     timestamptz,
  balance_credits    integer not null default 0 check (balance_credits >= 0),
  has_active_sub     boolean not null default false,
  updated_at         timestamptz not null default now()
);

alter table public.user_credits enable row level security;

-- Users may READ their own balance. All writes go through the service-role
-- client (server-only); there are intentionally no user write policies.
create policy "Users can view own credits"
  on public.user_credits for select
  using (auth.uid() = user_id);

-- ── credit_transactions: append-only audit log + webhook idempotency ─────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'credit_reason') then
    create type credit_reason as enum (
      'signup_bonus',
      'monthly_free_refill',
      'subscription_grant',
      'purchase',
      'spend',
      'refund',
      'adjustment'
    );
  end if;
end $$;

create table if not exists public.credit_transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  delta           integer not null,
  reason          credit_reason not null,
  bucket          text not null check (bucket in ('free', 'sub', 'purchased')),
  balance_after   integer not null,
  stripe_event_id text unique,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists credit_transactions_user_idx
  on public.credit_transactions (user_id, created_at desc);

alter table public.credit_transactions enable row level security;

create policy "Users can view own credit transactions"
  on public.credit_transactions for select
  using (auth.uid() = user_id);

-- ── Signup grant: extend handle_new_user to seed a credits row ───────────────
-- 20 one-time signup bonus (never-expiring bucket) + 10 free monthly.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, null);

  insert into public.user_credits (user_id, free_monthly, free_period_start, balance_credits)
  values (new.id, 10, now(), 20);

  return new;
end; $$;

-- ── Backfill existing users so current accounts get balances too ─────────────
insert into public.user_credits (user_id, free_monthly, free_period_start, balance_credits)
select id, 10, now(), 20 from public.profiles
on conflict (user_id) do nothing;
```

- [ ] **Step 2: Apply the migration to the hosted Supabase project**

Apply via the Supabase MCP tool (hosted project is primary per project memory):
- Tool: `mcp__plugin_supabase_supabase__apply_migration`
- `name`: `add_credits`
- `query`: the full SQL from Step 1

(Fallback if MCP unavailable: paste the SQL into the Supabase dashboard SQL editor, or run via the Supabase CLI against the linked project.)

- [ ] **Step 3: Verify the tables and backfill**

Run via MCP `mcp__plugin_supabase_supabase__execute_sql`:
```sql
select
  (select count(*) from public.user_credits)        as credit_rows,
  (select count(*) from public.profiles)             as profile_rows,
  (select count(*) from public.user_credits where free_monthly = 10 and balance_credits = 20) as seeded_rows;
```
Expected: `credit_rows == profile_rows` and `seeded_rows == profile_rows` (every existing user backfilled with 10 free + 20 bonus).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0025_add_credits.sql
git commit -m "feat(credits): add user_credits + credit_transactions tables and signup grant"
```

---

### Task 2: Vitest setup

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest
```

- [ ] **Step 2: Create the Vitest config**

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": new URL(".", import.meta.url).pathname },
  },
});
```

- [ ] **Step 3: Add npm scripts**

In `package.json` `"scripts"`, add:
```json
    "test": "vitest run",
    "test:watch": "vitest",
    "credits:check": "tsx --env-file=.env.local scripts/credits-check.ts"
```

- [ ] **Step 4: Smoke-test that Vitest runs**

Create a throwaway `lib/credits/smoke.test.ts`:
```ts
import { describe, it, expect } from "vitest";
describe("vitest", () => {
  it("runs", () => { expect(1 + 1).toBe(2); });
});
```
Run: `npm test`
Expected: 1 passing test. Then delete the file: `rm lib/credits/smoke.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore(test): add vitest for credit-logic unit tests"
```

---

### Task 3: Credit constants + cost helpers

**Files:**
- Create: `lib/credits/constants.ts`
- Create: `lib/credits/constants.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/credits/constants.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { planCost, messageCost, TWEAK_COST, CHAT_COST } from "./constants";

describe("planCost", () => {
  it("charges the base cost for a single intent", () => {
    expect(planCost(1)).toBe(5);
  });
  it("adds 2 credits per extra intent", () => {
    expect(planCost(3)).toBe(9); // 5 + 2 + 2
  });
  it("charges nothing for zero / invalid intent counts", () => {
    expect(planCost(0)).toBe(0);
    expect(planCost(-2)).toBe(0);
  });
});

describe("messageCost (with 1-credit conversation floor)", () => {
  it("charges the plan cost when a plan is produced", () => {
    expect(messageCost(1)).toBe(5);
    expect(messageCost(3)).toBe(9);
  });
  it("falls back to a 1-credit floor when no plan is produced", () => {
    expect(messageCost(0)).toBe(1); // clarifying question / failed parse
  });
});

describe("fixed costs", () => {
  it("tweak is 1, chat is 2", () => {
    expect(TWEAK_COST).toBe(1);
    expect(CHAT_COST).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- constants`
Expected: FAIL — cannot find module `./constants`.

- [ ] **Step 3: Write the constants**

`lib/credits/constants.ts`:
```ts
// lib/credits/constants.ts
// Single source of truth for credit amounts. Mirrors the pricing spec
// (docs/superpowers/specs/2026-06-01-pro-credit-pricing-design.md).

/** One-time signup bonus, granted into the never-expiring bucket. */
export const SIGNUP_BONUS = 20;

/** Free monthly allotment for non-subscribers; resets (does not stack). */
export const FREE_MONTHLY = 10;

/** How often the free allotment refills, in milliseconds (30 days). */
export const FREE_REFILL_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

/** Credits granted per Stripe subscription billing cycle. */
export const SUB_MONTHLY = 250;

// ── Action costs ─────────────────────────────────────────────────────────────
export const PLAN_BASE_COST = 5;
export const PLAN_EXTRA_INTENT_COST = 2;
export const TWEAK_COST = 1;
export const CHAT_COST = 2; // future knowledge assistant

/** Cost to generate an Organizer plan covering `intentCount` distinct moves. */
export function planCost(intentCount: number): number {
  if (intentCount <= 0) return 0;
  return PLAN_BASE_COST + PLAN_EXTRA_INTENT_COST * (intentCount - 1);
}

/**
 * Cost to charge for one submitted Organizer message. A produced plan costs
 * `planCost`; a message that yields no plan (clarifying question / failed parse)
 * still fired a Haiku call, so it charges a 1-credit conversation floor.
 */
export function messageCost(intentCount: number): number {
  return Math.max(1, planCost(intentCount));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- constants`
Expected: PASS (5 assertions).

- [ ] **Step 5: Commit**

```bash
git add lib/credits/constants.ts lib/credits/constants.test.ts
git commit -m "feat(credits): add credit constants and planCost helper"
```

---

### Task 4: Pure credit logic — normalize, totalBalance, spend

**Files:**
- Create: `lib/credits/logic.ts`
- Create: `lib/credits/logic.test.ts`

- [ ] **Step 1: Write the failing tests**

`lib/credits/logic.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { totalBalance, normalize, spend, type CreditState } from "./logic";
import { FREE_REFILL_INTERVAL_MS } from "./constants";

const NOW = 1_700_000_000_000; // fixed epoch ms for deterministic tests

function state(overrides: Partial<CreditState> = {}): CreditState {
  return {
    freeMonthly: 10,
    freePeriodStart: NOW,
    subMonthly: 0,
    subPeriodEnd: null,
    balanceCredits: 20,
    hasActiveSub: false,
    ...overrides,
  };
}

describe("totalBalance", () => {
  it("sums all three buckets", () => {
    expect(totalBalance(state({ freeMonthly: 10, subMonthly: 5, balanceCredits: 20 }))).toBe(35);
  });
});

describe("normalize", () => {
  it("refills free to 10 after 30 days for non-subscribers", () => {
    const s = state({ freeMonthly: 2, freePeriodStart: NOW - FREE_REFILL_INTERVAL_MS });
    const n = normalize(s, NOW);
    expect(n.freeMonthly).toBe(10);
    expect(n.freePeriodStart).toBe(NOW);
  });
  it("does NOT refill before 30 days", () => {
    const s = state({ freeMonthly: 2, freePeriodStart: NOW - 1000 });
    expect(normalize(s, NOW).freeMonthly).toBe(2);
  });
  it("does NOT refill free for active subscribers", () => {
    const s = state({ freeMonthly: 0, freePeriodStart: NOW - FREE_REFILL_INTERVAL_MS, hasActiveSub: true });
    expect(normalize(s, NOW).freeMonthly).toBe(0);
  });
  it("expires sub credits once the period has lapsed", () => {
    const s = state({ subMonthly: 250, subPeriodEnd: NOW - 1 });
    expect(normalize(s, NOW).subMonthly).toBe(0);
  });
  it("keeps sub credits while the period is still active", () => {
    const s = state({ subMonthly: 250, subPeriodEnd: NOW + 1000 });
    expect(normalize(s, NOW).subMonthly).toBe(250);
  });
});

describe("spend", () => {
  it("drains free first, then sub, then purchased", () => {
    const s = state({ freeMonthly: 3, subMonthly: 4, balanceCredits: 20 });
    const r = spend(s, 9, NOW); // 3 free + 4 sub + 2 purchased
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.debits).toEqual({ free: 3, sub: 4, purchased: 2 });
      expect(r.next.freeMonthly).toBe(0);
      expect(r.next.subMonthly).toBe(0);
      expect(r.next.balanceCredits).toBe(18);
    }
  });
  it("fails when the total is insufficient", () => {
    const s = state({ freeMonthly: 1, subMonthly: 0, balanceCredits: 2 });
    const r = spend(s, 5, NOW);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.shortfall).toBe(2);
  });
  it("is a no-op for zero amount", () => {
    const r = spend(state(), 0, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.debits).toEqual({ free: 0, sub: 0, purchased: 0 });
  });
  it("applies normalization before spending (refill then spend)", () => {
    const s = state({ freeMonthly: 0, freePeriodStart: NOW - FREE_REFILL_INTERVAL_MS, balanceCredits: 0 });
    const r = spend(s, 5, NOW); // refill gives 10 free, then spend 5
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.next.freeMonthly).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- logic`
Expected: FAIL — cannot find module `./logic`.

- [ ] **Step 3: Write the pure logic**

`lib/credits/logic.ts`:
```ts
// lib/credits/logic.ts
// Pure, I/O-free credit math. The server layer loads a row, runs these, and
// persists the result. Keeping this pure makes the money logic unit-testable.

import { FREE_MONTHLY, FREE_REFILL_INTERVAL_MS } from "./constants";

export type CreditState = {
  freeMonthly: number;
  freePeriodStart: number; // epoch ms
  subMonthly: number;
  subPeriodEnd: number | null; // epoch ms, or null if never subscribed
  balanceCredits: number;
  hasActiveSub: boolean;
};

export function totalBalance(s: CreditState): number {
  return s.freeMonthly + s.subMonthly + s.balanceCredits;
}

/**
 * Side-effect-free normalization applied on every read/spend:
 *  - expires sub credits if the billing period lapsed without renewal
 *  - refills the free allotment every 30 days, but ONLY for non-subscribers
 */
export function normalize(s: CreditState, nowMs: number): CreditState {
  const next = { ...s };

  if (next.subPeriodEnd !== null && nowMs > next.subPeriodEnd) {
    next.subMonthly = 0;
  }

  if (!next.hasActiveSub && nowMs - next.freePeriodStart >= FREE_REFILL_INTERVAL_MS) {
    next.freeMonthly = FREE_MONTHLY;
    next.freePeriodStart = nowMs;
  }

  return next;
}

export type SpendResult =
  | {
      ok: true;
      next: CreditState;
      debits: { free: number; sub: number; purchased: number };
    }
  | { ok: false; shortfall: number };

/** Spend `amount` credits, draining free → sub → purchased. */
export function spend(s: CreditState, amount: number, nowMs: number): SpendResult {
  const state = normalize(s, nowMs);

  if (amount <= 0) {
    return { ok: true, next: state, debits: { free: 0, sub: 0, purchased: 0 } };
  }

  const total = totalBalance(state);
  if (total < amount) {
    return { ok: false, shortfall: amount - total };
  }

  let remaining = amount;
  const fromFree = Math.min(state.freeMonthly, remaining);
  remaining -= fromFree;
  const fromSub = Math.min(state.subMonthly, remaining);
  remaining -= fromSub;
  const fromPurchased = remaining; // guaranteed <= balanceCredits by the total check

  return {
    ok: true,
    next: {
      ...state,
      freeMonthly: state.freeMonthly - fromFree,
      subMonthly: state.subMonthly - fromSub,
      balanceCredits: state.balanceCredits - fromPurchased,
    },
    debits: { free: fromFree, sub: fromSub, purchased: fromPurchased },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test -- logic`
Expected: PASS (all assertions in the 3 describe blocks).

- [ ] **Step 5: Commit**

```bash
git add lib/credits/logic.ts lib/credits/logic.test.ts
git commit -m "feat(credits): add pure credit logic (normalize, spend) with tests"
```

---

### Task 5: Server credit module — read, spend, grant

**Files:**
- Create: `lib/credits/types.ts`
- Create: `lib/credits/server.ts`

- [ ] **Step 1: Write the row type + mapper**

`lib/credits/types.ts`:
```ts
// lib/credits/types.ts
import type { CreditState } from "./logic";

/** Raw shape of a public.user_credits row. */
export type UserCreditsRow = {
  user_id: string;
  free_monthly: number;
  free_period_start: string; // ISO timestamptz
  sub_monthly: number;
  sub_period_end: string | null;
  balance_credits: number;
  has_active_sub: boolean;
  updated_at: string;
};

export function rowToState(row: UserCreditsRow): CreditState {
  return {
    freeMonthly: row.free_monthly,
    freePeriodStart: new Date(row.free_period_start).getTime(),
    subMonthly: row.sub_monthly,
    subPeriodEnd: row.sub_period_end ? new Date(row.sub_period_end).getTime() : null,
    balanceCredits: row.balance_credits,
    hasActiveSub: row.has_active_sub,
  };
}
```

- [ ] **Step 2: Write the server module**

`lib/credits/server.ts`:
```ts
// lib/credits/server.ts
// Server-only credit operations. All MUTATIONS use the service-role client
// (there are no user write RLS policies on the credit tables). Callers MUST
// have already authenticated the user and pass a verified userId.
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { normalize, spend, totalBalance, type CreditState } from "./logic";
import { rowToState, type UserCreditsRow } from "./types";

type BucketDebits = { free: number; sub: number; purchased: number };

async function readRow(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
): Promise<UserCreditsRow | null> {
  const { data, error } = await supabase
    .from("user_credits")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`readRow failed: ${error.message}`);
  return (data as UserCreditsRow | null) ?? null;
}

function stateToUpdate(state: CreditState) {
  return {
    free_monthly: state.freeMonthly,
    free_period_start: new Date(state.freePeriodStart).toISOString(),
    sub_monthly: state.subMonthly,
    sub_period_end: state.subPeriodEnd ? new Date(state.subPeriodEnd).toISOString() : null,
    balance_credits: state.balanceCredits,
    has_active_sub: state.hasActiveSub,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Load a user's credit state, applying (and persisting) lazy normalization
 * (free refill / sub expiry). Returns the normalized state + total balance.
 */
export async function getCreditState(
  userId: string,
): Promise<{ state: CreditState; total: number }> {
  const supabase = createAdminClient();
  const row = await readRow(supabase, userId);
  if (!row) {
    // Defensive: a profile with no credits row (shouldn't happen post-backfill).
    throw new Error(`No user_credits row for user ${userId}`);
  }

  const raw = rowToState(row);
  const normalized = normalize(raw, Date.now());

  // Persist only if normalization actually changed something.
  const changed =
    normalized.freeMonthly !== raw.freeMonthly ||
    normalized.subMonthly !== raw.subMonthly ||
    normalized.freePeriodStart !== raw.freePeriodStart;
  if (changed) {
    await supabase.from("user_credits").update(stateToUpdate(normalized)).eq("user_id", userId);
  }

  return { state: normalized, total: totalBalance(normalized) };
}

export async function getBalance(userId: string): Promise<number> {
  return (await getCreditState(userId)).total;
}

/**
 * Atomically spend `amount` credits using compare-and-swap on the bucket values
 * (retries on a lost race). Records one audit row per debited bucket.
 * Returns { ok: false } without charging if the balance is insufficient.
 */
export async function spendCredits(
  userId: string,
  amount: number,
  reason: "spend",
  metadata: Record<string, unknown> = {},
): Promise<{ ok: true; remaining: number } | { ok: false; shortfall: number }> {
  const supabase = createAdminClient();

  for (let attempt = 0; attempt < 3; attempt++) {
    const row = await readRow(supabase, userId);
    if (!row) throw new Error(`No user_credits row for user ${userId}`);

    const before = rowToState(row);
    const result = spend(before, amount, Date.now());
    if (!result.ok) return { ok: false, shortfall: result.shortfall };

    // Compare-and-swap: only update if the buckets still match what we read.
    const { data: updated, error } = await supabase
      .from("user_credits")
      .update(stateToUpdate(result.next))
      .eq("user_id", userId)
      .eq("free_monthly", row.free_monthly)
      .eq("sub_monthly", row.sub_monthly)
      .eq("balance_credits", row.balance_credits)
      .select("user_id");
    if (error) throw new Error(`spendCredits update failed: ${error.message}`);

    if (updated && updated.length > 0) {
      await recordDebits(supabase, userId, result.debits, result.next, reason, metadata);
      return { ok: true, remaining: totalBalance(result.next) };
    }
    // Lost the race — another write landed first; loop and retry.
  }

  throw new Error(`spendCredits: too much contention for user ${userId}`);
}

async function recordDebits(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  debits: BucketDebits,
  next: CreditState,
  reason: "spend",
  metadata: Record<string, unknown>,
) {
  const total = totalBalance(next);
  const rows = (["free", "sub", "purchased"] as const)
    .filter((b) => debits[b] > 0)
    .map((b) => ({
      user_id: userId,
      delta: -debits[b],
      reason,
      bucket: b,
      balance_after: total,
      metadata,
    }));
  if (rows.length > 0) {
    await supabase.from("credit_transactions").insert(rows);
  }
}

/**
 * Grant credits. `purchased` adds to the never-expiring bucket; `subscription`
 * SETS the monthly sub allotment and marks the sub active. Idempotent when a
 * `stripeEventId` is supplied (a duplicate event is a no-op).
 */
export async function grantCredits(
  userId: string,
  opts: {
    amount: number;
    kind: "purchased" | "subscription";
    reason: "purchase" | "subscription_grant" | "adjustment" | "refund";
    stripeEventId?: string;
    subPeriodEnd?: number; // epoch ms, required for subscription grants
  },
): Promise<{ ok: true; alreadyApplied: boolean; total: number }> {
  const supabase = createAdminClient();

  // Idempotency: if we've already recorded this Stripe event, do nothing.
  if (opts.stripeEventId) {
    const { data: existing } = await supabase
      .from("credit_transactions")
      .select("id")
      .eq("stripe_event_id", opts.stripeEventId)
      .maybeSingle();
    if (existing) {
      return { ok: true, alreadyApplied: true, total: await getBalance(userId) };
    }
  }

  const { state } = await getCreditState(userId);
  const next: CreditState = { ...state };
  let bucket: "purchased" | "sub";

  if (opts.kind === "purchased") {
    next.balanceCredits += opts.amount;
    bucket = "purchased";
  } else {
    next.subMonthly = opts.amount; // set, not add — sub credits don't stack
    next.hasActiveSub = true;
    next.subPeriodEnd = opts.subPeriodEnd ?? null;
    bucket = "sub";
  }

  await supabase.from("user_credits").update(stateToUpdate(next)).eq("user_id", userId);
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    delta: opts.amount,
    reason: opts.reason,
    bucket,
    balance_after: totalBalance(next),
    stripe_event_id: opts.stripeEventId ?? null,
  });

  return { ok: true, alreadyApplied: false, total: totalBalance(next) };
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors). If `server-only` import errors in this context, confirm it's already a dependency (it is — used by `lib/supabase/admin.ts`).

- [ ] **Step 4: Commit**

```bash
git add lib/credits/types.ts lib/credits/server.ts
git commit -m "feat(credits): add server credit module (read, spend CAS, grant)"
```

---

### Task 6: Manual verification script

**Files:**
- Create: `scripts/credits-check.ts`

- [ ] **Step 1: Write the script**

`scripts/credits-check.ts`:
```ts
// scripts/credits-check.ts
// Prints a user's credit buckets straight from the DB, applying lazy
// normalization. Usage: npm run credits:check -- <userId or email>
import { createAdminClient } from "@/lib/supabase/admin";
import { getCreditState } from "@/lib/credits/server";

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error("Usage: npm run credits:check -- <userId or email>");
    process.exit(1);
  }

  const supabase = createAdminClient();

  // Resolve email → user id if an email was passed.
  let userId = arg;
  if (arg.includes("@")) {
    const { data, error } = await supabase.auth.admin.listUsers();
    if (error) throw new Error(error.message);
    const found = data.users.find((u) => u.email?.toLowerCase() === arg.toLowerCase());
    if (!found) {
      console.error(`No user with email ${arg}`);
      process.exit(1);
    }
    userId = found.id;
  }

  const { state, total } = await getCreditState(userId);
  console.log(`\nCredits for ${userId}:`);
  console.log(`  free_monthly    : ${state.freeMonthly}`);
  console.log(`  sub_monthly     : ${state.subMonthly}`);
  console.log(`  balance_credits : ${state.balanceCredits}`);
  console.log(`  has_active_sub  : ${state.hasActiveSub}`);
  console.log(`  ─────────────────────────`);
  console.log(`  TOTAL           : ${total}\n`);
}

main().catch((err) => {
  console.error("✗ credits-check failed:", err.message ?? err);
  process.exit(1);
});
```

- [ ] **Step 2: Verify against your own account**

Ensure `.env.local` has `SUPABASE_SERVICE_ROLE_KEY` set (same key admin uses). Then:
Run: `npm run credits:check -- master@8caps.co.uk`
Expected: prints `free_monthly: 10`, `balance_credits: 20`, `TOTAL: 30` (from the backfill).

- [ ] **Step 3: Commit**

```bash
git add scripts/credits-check.ts
git commit -m "chore(credits): add manual balance verification script"
```

---

## Self-Review

**Spec coverage:**
- ✅ Three-bucket model (free/sub/purchased) — Task 1 schema + Task 4 logic
- ✅ Signup bonus 20 + free 10 — Task 1 trigger + backfill
- ✅ Free refill only for non-subscribers — Task 4 `normalize` guard
- ✅ Sub credits don't stack (set, not add) — Task 5 `grantCredits`
- ✅ Spend order free→sub→purchased — Task 4 `spend`
- ✅ Cost helpers (plan/tweak/chat) — Task 3
- ✅ Audit log + webhook idempotency — Task 1 table + Task 5 `grantCredits`/`recordDebits`
- ⏭️ Charging on Organizer actions, balance UI — **Plan 2** (out of scope here, by design)
- ⏭️ Stripe checkout/webhook calling `grantCredits` — **Plan 3** (the `grantCredits` API is built here ready for it)

**Type consistency:** `CreditState` shape is identical across `logic.ts`, `types.ts`, `server.ts`. `spend`/`normalize`/`totalBalance`/`grantCredits` signatures match their call sites and tests.

**Placeholders:** none — every step has complete code and exact commands.

**Note on `Date.now()`:** used in app/server code (`server.ts`, `getCreditState`) — fine. The pure logic takes `nowMs` as a parameter so tests stay deterministic.
