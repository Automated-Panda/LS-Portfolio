# Stripe Purchasing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users actually buy credits — Stripe-hosted Checkout for one-time packs and the Pro subscription, fulfilled by a signature-verified webhook through an atomic credit-grant RPC, with a `/credits` page and customer portal.

**Architecture:** A shared server-only Stripe client. A `createCheckoutSession` server action redirects to Stripe-hosted Checkout; a webhook route handler verifies the signature and fulfills `checkout.session.completed` (packs), `invoice.paid` (subscriptions, initial + renewals), and `customer.subscription.deleted` (cancel). Fulfillment goes through a transactional Postgres `grant_credits` RPC (atomic update+audit+idempotency). A `/credits` page shows tiers, balance, and a portal link.

**Tech Stack:** Next.js 15 (App Router, server actions + route handler) · Supabase Postgres · `stripe` SDK (v22, already installed) · Stripe CLI (for local webhook testing) · Vitest.

**Approved design:** brainstorming 2026-06-01. Builds on Plans 1 & 2 (credit ledger + Organizer gating). Stripe products already exist in test & live (`scripts/stripe-setup.ts`) with `lookup_key`s `gtvault_starter_50` / `gtvault_plus_150` / `gtvault_pro_250_monthly` and `metadata.credits` on each product.

---

## Locked design decisions

- **Webhook event split:** packs fulfilled on `checkout.session.completed`; subscriptions fulfilled on `invoice.paid` (fires for the first payment AND renewals) — avoids double-granting. `customer.subscription.deleted` clears the sub.
- **Credits source of truth = Stripe metadata.** Checkout stamps `metadata.credits` (read from the product) on the session and (for subs) on the subscription, so the webhook reads it back authoritatively.
- **Atomic fulfillment** via the `grant_credits` Postgres RPC (locks the row, idempotent on `stripe_event_id`). `grant_credits` is `SECURITY DEFINER` and execute is granted ONLY to `service_role` — users can never grant themselves credits.
- **User↔Stripe mapping:** `stripe_customer_id` / `stripe_subscription_id` columns on `user_credits`; `user_id` is also stamped in session/subscription metadata so webhooks map back without a DB lookup.
- **Cancel = at period end** (Stripe portal default); `normalize` already expires `sub_monthly` at `sub_period_end`, and `customer.subscription.deleted` (fires at period end) hard-clears it.
- **`/credits` page** is the canonical buy/manage hub; the out-of-credits wall links to it.

---

## File Structure

| File | Responsibility |
|---|---|
| `supabase/migrations/0026_stripe_billing.sql` (create) | `stripe_customer_id`/`stripe_subscription_id` columns + `grant_credits` RPC (+ grants) |
| `lib/credits/server.ts` (modify) | Rewrite `grantCredits` to call the `grant_credits` RPC |
| `lib/credits/billing.ts` (create) | Server-only: `linkStripeIds`, `getStripeCustomerId`, `endSubscription` |
| `lib/stripe/client.ts` (create) | Server-only shared `getStripe()` Stripe instance |
| `lib/stripe/tiers.ts` (create) | `CREDIT_TIERS` display catalog (lookup keys + mode) |
| `lib/stripe/metadata.ts` (create) | `creditsFromMetadata()` parser |
| `lib/stripe/metadata.test.ts` (create) | Unit test for the parser |
| `app/(app)/credits/actions.ts` (create) | `createCheckoutSession`, `createPortalSession` server actions |
| `app/api/stripe/webhook/route.ts` (create) | Signature-verified webhook → fulfillment |
| `app/(app)/credits/page.tsx` (create) | Server page: balance + sub state |
| `app/(app)/credits/credits-view.tsx` (create) | Client: tier cards, buy/manage buttons, status banner |
| `app/(app)/organize/organize-chat.tsx` (modify) | Wall "Get credits →" link to `/credits`; make footer balance link there |
| `.env.local.example` (modify) | Document `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` |

---

### Task 1: Migration — Stripe columns + `grant_credits` RPC

**Files:** Create `supabase/migrations/0026_stripe_billing.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0026_stripe_billing.sql
-- Stripe ↔ user mapping + an atomic, idempotent credit-grant function used by
-- the Stripe webhook to fulfill purchases.

alter table public.user_credits
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text;

create index if not exists idx_user_credits_stripe_customer
  on public.user_credits (stripe_customer_id);

-- grant_credits: atomic fulfillment. Locks the user's row, is idempotent on
-- stripe_event_id, updates the correct bucket, and writes the audit row — all
-- in one transaction. 'purchased' ADDS to the never-expiring bucket;
-- 'subscription' SETS the monthly allotment (does not stack) + marks active.
create or replace function public.grant_credits(
  p_user_id         uuid,
  p_amount          integer,
  p_kind            text,          -- 'purchased' | 'subscription'
  p_reason          credit_reason,
  p_stripe_event_id text,
  p_sub_period_end  timestamptz default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket text;
  v_total  integer;
begin
  -- Idempotency: skip if this Stripe event was already applied.
  if p_stripe_event_id is not null and exists (
    select 1 from public.credit_transactions where stripe_event_id = p_stripe_event_id
  ) then
    return;
  end if;

  -- Lock the user's credit row for the duration of the transaction.
  perform 1 from public.user_credits where user_id = p_user_id for update;
  if not found then
    raise exception 'grant_credits: no user_credits row for %', p_user_id;
  end if;

  if p_kind = 'purchased' then
    update public.user_credits
      set balance_credits = balance_credits + p_amount
      where user_id = p_user_id;
    v_bucket := 'purchased';
  elsif p_kind = 'subscription' then
    update public.user_credits
      set sub_monthly     = p_amount,
          has_active_sub  = true,
          sub_period_end  = p_sub_period_end
      where user_id = p_user_id;
    v_bucket := 'sub';
  else
    raise exception 'grant_credits: invalid kind %', p_kind;
  end if;

  select free_monthly + sub_monthly + balance_credits into v_total
    from public.user_credits where user_id = p_user_id;

  insert into public.credit_transactions
    (user_id, delta, reason, bucket, balance_after, stripe_event_id)
    values (p_user_id, p_amount, p_reason, v_bucket, v_total, p_stripe_event_id);
end;
$$;

-- Lock it down: only the service role (server) may grant credits.
revoke all on function public.grant_credits(uuid, integer, text, credit_reason, text, timestamptz) from public;
revoke all on function public.grant_credits(uuid, integer, text, credit_reason, text, timestamptz) from anon;
revoke all on function public.grant_credits(uuid, integer, text, credit_reason, text, timestamptz) from authenticated;
grant execute on function public.grant_credits(uuid, integer, text, credit_reason, text, timestamptz) to service_role;
```

- [ ] **Step 2: Apply** via the Supabase MCP tool `mcp__plugin_supabase_supabase__apply_migration` (project GT Vault `bzoizaakcqzlvpraysjn`), name `stripe_billing`, query = the SQL above. (Use ToolSearch `select:mcp__plugin_supabase_supabase__apply_migration` first.)

- [ ] **Step 3: Verify** via `mcp__plugin_supabase_supabase__execute_sql`:
```sql
select
  (select count(*) from information_schema.columns
     where table_name='user_credits' and column_name in ('stripe_customer_id','stripe_subscription_id')) as cols,
  (select count(*) from pg_proc where proname='grant_credits') as fn;
```
Expected: `cols = 2`, `fn = 1`.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/0026_stripe_billing.sql
git commit -m "feat(billing): add stripe mapping columns + atomic grant_credits RPC"
```
(End body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.)

---

### Task 2: Rewrite `grantCredits` to use the RPC + add billing helpers

**Files:** Modify `lib/credits/server.ts`; Create `lib/credits/billing.ts`

- [ ] **Step 1: Replace `grantCredits` in `lib/credits/server.ts`**

First READ `lib/credits/server.ts` to find the current `grantCredits` function. Replace the ENTIRE `grantCredits` function with:
```ts
/**
 * Grant credits via the atomic, idempotent `grant_credits` Postgres RPC.
 * `purchased` adds to the never-expiring bucket; `subscription` sets the
 * monthly allotment + marks the sub active. A duplicate `stripeEventId` is a
 * no-op (idempotent at the DB layer).
 */
export async function grantCredits(
  userId: string,
  opts: {
    amount: number;
    kind: "purchased" | "subscription";
    reason: "purchase" | "subscription_grant" | "adjustment" | "refund";
    stripeEventId?: string;
    subPeriodEnd?: number; // epoch ms; for subscription grants
  },
): Promise<{ ok: true }> {
  const supabase = createAdminClient();
  const { error } = await supabase.rpc("grant_credits", {
    p_user_id: userId,
    p_amount: opts.amount,
    p_kind: opts.kind,
    p_reason: opts.reason,
    p_stripe_event_id: opts.stripeEventId ?? null,
    p_sub_period_end: opts.subPeriodEnd ? new Date(opts.subPeriodEnd).toISOString() : null,
  });
  if (error) throw new Error(`grantCredits RPC failed: ${error.message}`);
  return { ok: true };
}
```
(The old `grantCredits` had no callers, so the simplified return shape is safe. Leave `getCreditState`, `getBalance`, `spendCredits`, `recordDebits`, `readRow`, `stateToUpdate`, `rowToState` imports/usage untouched. If `createAdminClient` is already imported, don't re-import.)

- [ ] **Step 2: Create `lib/credits/billing.ts`**

```ts
// lib/credits/billing.ts
// Server-only helpers that map a user to their Stripe customer/subscription and
// end a subscription. Credit *amounts* are handled by grant_credits (the RPC);
// this file is only the Stripe-id bookkeeping + cancel.
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** Persist the user's Stripe customer / subscription ids (only the provided ones). */
export async function linkStripeIds(
  userId: string,
  ids: { customerId?: string; subscriptionId?: string },
): Promise<void> {
  const patch: Record<string, string> = {};
  if (ids.customerId) patch.stripe_customer_id = ids.customerId;
  if (ids.subscriptionId) patch.stripe_subscription_id = ids.subscriptionId;
  if (Object.keys(patch).length === 0) return;

  const supabase = createAdminClient();
  const { error } = await supabase.from("user_credits").update(patch).eq("user_id", userId);
  if (error) throw new Error(`linkStripeIds failed: ${error.message}`);
}

export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_credits")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`getStripeCustomerId failed: ${error.message}`);
  return (data?.stripe_customer_id as string | null) ?? null;
}

/** Subscription ended (cancel at period end): zero the sub bucket + clear flags. */
export async function endSubscription(userId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_credits")
    .update({ sub_monthly: 0, has_active_sub: false, stripe_subscription_id: null })
    .eq("user_id", userId);
  if (error) throw new Error(`endSubscription failed: ${error.message}`);
}
```

- [ ] **Step 3: Typecheck** — `npm run typecheck` (clean). **Tests** — `npm test` (still 23+ pass).

- [ ] **Step 4: Commit**
```bash
git add lib/credits/server.ts lib/credits/billing.ts
git commit -m "feat(billing): grantCredits via RPC + stripe-id/cancel helpers"
```

---

### Task 3: Stripe client, tier catalog, metadata parser

**Files:** Create `lib/stripe/client.ts`, `lib/stripe/tiers.ts`, `lib/stripe/metadata.ts`, `lib/stripe/metadata.test.ts`

- [ ] **Step 1: Write the failing test** — `lib/stripe/metadata.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { creditsFromMetadata } from "./metadata";

describe("creditsFromMetadata", () => {
  it("parses a positive integer credits string", () => {
    expect(creditsFromMetadata({ credits: "50" })).toBe(50);
  });
  it("throws on missing, non-numeric, zero, or negative credits", () => {
    expect(() => creditsFromMetadata({})).toThrow();
    expect(() => creditsFromMetadata(null)).toThrow();
    expect(() => creditsFromMetadata({ credits: "abc" })).toThrow();
    expect(() => creditsFromMetadata({ credits: "0" })).toThrow();
    expect(() => creditsFromMetadata({ credits: "-5" })).toThrow();
  });
});
```

- [ ] **Step 2: Run it** — `npm test -- metadata` → FAIL (no module).

- [ ] **Step 3: Implement the three files**

`lib/stripe/client.ts`:
```ts
// lib/stripe/client.ts
import "server-only";
import Stripe from "stripe";

let cached: Stripe | null = null;

/** Shared server-side Stripe client. Throws if the secret key isn't configured. */
export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set.");
  cached = new Stripe(key);
  return cached;
}
```

`lib/stripe/tiers.ts`:
```ts
// lib/stripe/tiers.ts
// Display catalog for the /credits page + the lookup keys/mode used to start
// checkout. Credit *amounts* shown here are for display; fulfillment reads the
// authoritative count from Stripe product metadata (see creditsFromMetadata).
export type CreditTier = {
  lookupKey: string;
  name: string;
  credits: number;
  priceLabel: string;
  mode: "payment" | "subscription";
  blurb: string;
  featured?: boolean;
};

export const CREDIT_TIERS: CreditTier[] = [
  { lookupKey: "gtvault_starter_50", name: "Starter", credits: 50, priceLabel: "$4.99", mode: "payment", blurb: "One-time top-up." },
  { lookupKey: "gtvault_plus_150", name: "Plus", credits: 150, priceLabel: "$9.99", mode: "payment", blurb: "Best value.", featured: true },
  { lookupKey: "gtvault_pro_250_monthly", name: "Pro", credits: 250, priceLabel: "$9.99/mo", mode: "subscription", blurb: "250 credits every month. Cancel anytime." },
];
```

`lib/stripe/metadata.ts`:
```ts
// lib/stripe/metadata.ts
/** Read the authoritative credit count from a Stripe metadata bag. Throws if absent/invalid. */
export function creditsFromMetadata(
  metadata: Record<string, string> | null | undefined,
): number {
  const raw = metadata?.credits;
  const n = raw != null ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`Invalid credits metadata: ${JSON.stringify(raw)}`);
  }
  return n;
}
```

- [ ] **Step 4: Run it** — `npm test -- metadata` → PASS. Then `npm run typecheck` → clean.

- [ ] **Step 5: Commit**
```bash
git add lib/stripe/client.ts lib/stripe/tiers.ts lib/stripe/metadata.ts lib/stripe/metadata.test.ts
git commit -m "feat(stripe): shared client, tier catalog, credits metadata parser"
```

---

### Task 4: Checkout + portal server actions

**Files:** Create `app/(app)/credits/actions.ts`

- [ ] **Step 1: Write the actions**

```ts
"use server";

import { headers } from "next/headers";
import type Stripe from "stripe";

import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe/client";
import { CREDIT_TIERS } from "@/lib/stripe/tiers";
import { creditsFromMetadata } from "@/lib/stripe/metadata";
import { getStripeCustomerId, linkStripeIds } from "@/lib/credits/billing";

async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export type CheckoutResult = { url: string } | { error: string };

export async function createCheckoutSession(lookupKey: string): Promise<CheckoutResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const tier = CREDIT_TIERS.find((t) => t.lookupKey === lookupKey);
  if (!tier) return { error: "Unknown product." };

  const stripe = getStripe();

  // Resolve the live price + its product metadata (source of truth for credits).
  const prices = await stripe.prices.list({
    lookup_keys: [lookupKey],
    active: true,
    expand: ["data.product"],
    limit: 1,
  });
  const price = prices.data[0];
  if (!price) return { error: "Price not configured in Stripe." };
  const product = price.product as Stripe.Product;
  let credits: number;
  try {
    credits = creditsFromMetadata(product.metadata);
  } catch {
    return { error: "Product is missing credit metadata." };
  }

  // Find or create this user's Stripe customer.
  let customerId = await getStripeCustomerId(user.id);
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    await linkStripeIds(user.id, { customerId });
  }

  const origin = await getOrigin();
  const kind = tier.mode === "subscription" ? "subscription" : "purchased";
  const session = await stripe.checkout.sessions.create({
    mode: tier.mode,
    customer: customerId,
    line_items: [{ price: price.id, quantity: 1 }],
    client_reference_id: user.id,
    success_url: `${origin}/credits?status=success`,
    cancel_url: `${origin}/credits?status=cancel`,
    metadata: { user_id: user.id, credits: String(credits), kind },
    ...(tier.mode === "subscription"
      ? { subscription_data: { metadata: { user_id: user.id, credits: String(credits) } } }
      : {}),
  });

  if (!session.url) return { error: "Failed to create checkout session." };
  return { url: session.url };
}

export async function createPortalSession(): Promise<CheckoutResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const customerId = await getStripeCustomerId(user.id);
  if (!customerId) return { error: "No billing account yet — buy credits first." };

  const stripe = getStripe();
  const origin = await getOrigin();
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/credits`,
  });
  return { url: session.url };
}
```

- [ ] **Step 2: Typecheck** — `npm run typecheck`. If the Stripe SDK's `checkout.sessions.create` params type rejects any field, read the SDK type and adjust minimally (do not cast to `any`). Expected: clean.

- [ ] **Step 3: Commit**
```bash
git add "app/(app)/credits/actions.ts"
git commit -m "feat(credits): checkout + customer-portal server actions"
```

---

### Task 5: Stripe webhook route handler

**Files:** Create `app/api/stripe/webhook/route.ts`

- [ ] **Step 1: Write the route handler**

```ts
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe/client";
import { creditsFromMetadata } from "@/lib/stripe/metadata";
import { grantCredits } from "@/lib/credits/server";
import { linkStripeIds, endSubscription } from "@/lib/credits/billing";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not set" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const body = await request.text(); // raw body required for signature verification
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        if (!userId) break;

        await linkStripeIds(userId, {
          customerId: typeof session.customer === "string" ? session.customer : undefined,
          subscriptionId:
            typeof session.subscription === "string" ? session.subscription : undefined,
        });

        // Packs grant here; subscriptions are granted on invoice.paid.
        if (session.mode === "payment") {
          const credits = creditsFromMetadata(session.metadata);
          await grantCredits(userId, {
            amount: credits,
            kind: "purchased",
            reason: "purchase",
            stripeEventId: event.id,
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        // NOTE: confirm how the installed Stripe SDK exposes the subscription id
        // on an Invoice (typecheck will tell you). As of v22 it is `invoice.subscription`
        // (string | Stripe.Subscription | null). If the SDK types it differently,
        // adapt this line — do NOT cast to any.
        const subId =
          typeof invoice.subscription === "string"
            ? invoice.subscription
            : invoice.subscription?.id;
        if (!subId) break;

        const sub = await stripe.subscriptions.retrieve(subId);
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        const credits = creditsFromMetadata(sub.metadata);
        await grantCredits(userId, {
          amount: credits,
          kind: "subscription",
          reason: "subscription_grant",
          stripeEventId: event.id,
          subPeriodEnd: sub.current_period_end * 1000, // Stripe sends seconds
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;
        await endSubscription(userId);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    // Non-2xx makes Stripe retry — correct for transient failures.
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
```

- [ ] **Step 2: Typecheck** — `npm run typecheck`. The `invoice.subscription` and `sub.current_period_end` fields are the likely friction points against the installed `stripe@^22` types. If a field doesn't exist as written, READ the SDK type (`node_modules/stripe/types/...`) and adjust to the correct accessor while preserving behavior (get the subscription id and the current period end). Report exactly what you changed. Expected: clean.

- [ ] **Step 3: Commit**
```bash
git add "app/api/stripe/webhook/route.ts"
git commit -m "feat(billing): stripe webhook — fulfill packs, subs, cancellations"
```

---

### Task 6: `/credits` page + view

**Files:** Create `app/(app)/credits/page.tsx`, `app/(app)/credits/credits-view.tsx`

- [ ] **Step 1: Write the server page** — `app/(app)/credits/page.tsx`:
```tsx
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { organizerBalance } from "@/lib/credits/gate";

import { CreditsView } from "./credits-view";

export default async function CreditsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [balance, { data: row }] = await Promise.all([
    organizerBalance(user.id, user.email),
    supabase
      .from("user_credits")
      .select("has_active_sub, stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  return (
    <CreditsView
      balance={balance}
      hasActiveSub={Boolean(row?.has_active_sub)}
      hasBillingAccount={Boolean(row?.stripe_customer_id)}
    />
  );
}
```

- [ ] **Step 2: Write the client view** — `app/(app)/credits/credits-view.tsx`:
```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CREDIT_TIERS } from "@/lib/stripe/tiers";
import type { CreditDisplay } from "@/lib/credits/access";

import { createCheckoutSession, createPortalSession } from "./actions";

type Props = {
  balance: CreditDisplay;
  hasActiveSub: boolean;
  hasBillingAccount: boolean;
};

export function CreditsView({ balance, hasActiveSub, hasBillingAccount }: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    const status = params.get("status");
    if (status === "success") toast.success("Payment complete — your credits are on the way!");
    else if (status === "cancel") toast("Checkout canceled.");
    if (status) router.replace("/credits");
  }, [params, router]);

  const buy = (lookupKey: string) => {
    setBusyKey(lookupKey);
    startTransition(async () => {
      const r = await createCheckoutSession(lookupKey);
      if ("url" in r) window.location.href = r.url;
      else {
        toast.error(r.error);
        setBusyKey(null);
      }
    });
  };

  const manage = () => {
    setBusyKey("portal");
    startTransition(async () => {
      const r = await createPortalSession();
      if ("url" in r) window.location.href = r.url;
      else {
        toast.error(r.error);
        setBusyKey(null);
      }
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-100">Credits</h1>
        <div className="text-sm text-neutral-300">
          Balance: <span className="font-semibold text-[#84cc16]">
            {balance.unlimited ? "Unlimited ⚡" : `⚡ ${balance.total}`}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {CREDIT_TIERS.map((tier) => (
          <div
            key={tier.lookupKey}
            className={cn(
              "flex flex-col rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-4",
              tier.featured && "border-[#84cc16]",
            )}
          >
            <div className="text-sm font-bold text-neutral-100">{tier.name}</div>
            <div className="mt-1 text-2xl font-bold text-neutral-100">{tier.priceLabel}</div>
            <div className="mt-1 text-sm text-[#84cc16]">{tier.credits} credits</div>
            <p className="mt-2 flex-1 text-xs text-neutral-400">{tier.blurb}</p>
            <Button
              className="mt-4 rounded-full bg-[#84cc16] text-black hover:bg-[#84cc16]/90"
              disabled={pending}
              onClick={() => buy(tier.lookupKey)}
            >
              {busyKey === tier.lookupKey ? "…" : tier.mode === "subscription" ? "Subscribe" : "Buy"}
            </Button>
          </div>
        ))}
      </div>

      {(hasActiveSub || hasBillingAccount) && (
        <div className="mt-6 text-center">
          <Button variant="outline" disabled={pending} onClick={manage}>
            {busyKey === "portal" ? "…" : "Manage subscription & billing"}
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck** — `npm run typecheck` (clean). Confirm `@/components/ui/button` and `sonner` import paths match the rest of the app (they're used in `organize-chat.tsx`).

- [ ] **Step 4: Commit**
```bash
git add "app/(app)/credits/page.tsx" "app/(app)/credits/credits-view.tsx"
git commit -m "feat(credits): /credits page with tier cards + portal link"
```

---

### Task 7: Wire the out-of-credits wall + env docs

**Files:** Modify `app/(app)/organize/organize-chat.tsx`, `.env.local.example`

- [ ] **Step 1: Wall → /credits.** In `organize-chat.tsx`, the `phase.kind === "out-of-credits"` render block currently has a "Got it" button. Replace that block with one that links to `/credits` (the component already has `const router = useRouter()`):
```tsx
          {phase.kind === "out-of-credits" && (
            <MessageBubble role="assistant">
              <p className="mb-2">You&apos;re out of credits ⚡</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="rounded-full bg-[#84cc16] text-black hover:bg-[#84cc16]/90"
                  onClick={() => router.push("/credits")}
                >
                  Get credits →
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPhase({ kind: "idle" })}>
                  Dismiss
                </Button>
              </div>
            </MessageBubble>
          )}
```

- [ ] **Step 2: Make the footer balance a link.** In the input footer, wrap the balance line so non-unlimited users can click through to buy. Replace the balance `<div className="mb-1.5 px-1 text-[11px] text-neutral-400">…</div>` with:
```tsx
          <div className="mb-1.5 flex items-center justify-between px-1 text-[11px] text-neutral-400">
            <span>{balance.unlimited ? "Unlimited ⚡" : `⚡ ${balance.total} credit${balance.total === 1 ? "" : "s"}`}</span>
            {!balance.unlimited && (
              <button type="button" className="text-[#84cc16] hover:underline" onClick={() => router.push("/credits")}>
                Get more
              </button>
            )}
          </div>
```

- [ ] **Step 3: Document env vars.** In `.env.local.example`, add (after the Anthropic block):
```
# Stripe — secret key (sk_test_… locally, sk_live_… in prod) for checkout/webhook/portal.
STRIPE_SECRET_KEY=...
# Stripe webhook signing secret. Locally: from `stripe listen --forward-to localhost:3000/api/stripe/webhook`.
# In prod: from the Stripe dashboard webhook endpoint.
STRIPE_WEBHOOK_SECRET=...
```

- [ ] **Step 4: Typecheck** — `npm run typecheck` (clean). **Tests** — `npm test` (all pass).

- [ ] **Step 5: Commit**
```bash
git add "app/(app)/organize/organize-chat.tsx" .env.local.example
git commit -m "feat(organizer): wall + footer link to /credits; document stripe env"
```

---

### Task 8: Manual verification with the Stripe CLI

**Files:** none (verification only). Requires the Stripe CLI (installed) logged in, and `.env.local` with `STRIPE_SECRET_KEY` (sk_test_…), `STRIPE_WEBHOOK_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`. Prereq: the **Customer portal must be enabled** in the Stripe dashboard (Test mode → Settings → Billing → Customer portal).

- [ ] **Step 1:** In terminal A: `stripe listen --forward-to localhost:3000/api/stripe/webhook` → copy the `whsec_…` into `.env.local` as `STRIPE_WEBHOOK_SECRET`. In terminal B: `npm run dev`.
- [ ] **Step 2: Pack purchase** — sign in as a NON-owner, go to `/credits`, click **Buy** on Starter, pay with test card `4242 4242 4242 4242` (any future expiry/CVC). After redirect to `/credits?status=success`, confirm the webhook logged `checkout.session.completed` and `npm run credits:check -- <email>` shows **+50** in the purchased bucket.
- [ ] **Step 3: Subscription** — click **Subscribe** on Pro, pay with the test card. Confirm `invoice.paid` fired and the balance reflects **+250 sub** (and `has_active_sub = true`); the free monthly refill is suppressed for the subscriber.
- [ ] **Step 4: Idempotency** — `stripe events resend <evt_id>` (or replay from the `stripe listen` output) for the pack event; confirm the balance does **not** change again (RPC idempotency).
- [ ] **Step 5: Cancel** — open **Manage subscription**, cancel; trigger/await `customer.subscription.deleted` (you can `stripe trigger customer.subscription.deleted` for a synthetic test, but prefer the real portal cancel at period end). Confirm `has_active_sub` clears and sub credits zero out.
- [ ] **Step 6: Wall link** — spend a non-owner to 0 in `/organize`, confirm the "Get credits →" button routes to `/credits`.
- [ ] **Step 7:** Report results; capture repro for anything wrong.

---

## Self-Review

**Spec coverage:**
- ✅ Transactional `grant_credits` RPC (atomic, idempotent, service-role-only) — Task 1; `grantCredits` rewired — Task 2.
- ✅ Stripe customer/subscription mapping — Task 1 columns + Task 2 helpers.
- ✅ Checkout (packs `payment` / Pro `subscription`) + portal — Task 4.
- ✅ Webhook split (pack on `checkout.session.completed`, sub on `invoice.paid`, cancel on `subscription.deleted`), credits from Stripe metadata, idempotent on `event.id` — Task 5.
- ✅ `/credits` page (tiers, balance, manage link, success/cancel banner) — Task 6.
- ✅ Wall + footer link to `/credits`; env documented — Task 7.
- ✅ Manual end-to-end verification via Stripe CLI — Task 8.

**Placeholder scan:** none — all code complete. The two SDK-shape watch-points (`invoice.subscription`, `current_period_end`) are explicit verify-against-types instructions, not placeholders.

**Type consistency:** `grantCredits(userId, { amount, kind, reason, stripeEventId?, subPeriodEnd? })` is identical in Task 2 (def) and Task 5 (calls). `creditsFromMetadata(metadata)` consistent across Tasks 3/4/5. `CreditDisplay` reused from `lib/credits/access.ts` in Task 6. `CREDIT_TIERS` shape consistent (Task 3 def → Tasks 4/6 use). `getStripeCustomerId`/`linkStripeIds`/`endSubscription` signatures match between Task 2 and Tasks 4/5.

**Security note:** `grant_credits` execute is revoked from `public`/`anon`/`authenticated` and granted only to `service_role`; all credit mutations run through the service-role admin client server-side. The webhook verifies the Stripe signature before any fulfillment.

**Dependency note:** Needs `STRIPE_SECRET_KEY` (have) + `STRIPE_WEBHOOK_SECRET` (new) in `.env.local`; live values in Vercel. Customer portal must be enabled in the Stripe dashboard before the portal button works.
