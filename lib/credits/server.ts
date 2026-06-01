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

// NOTE: updated_at is intentionally NOT set here — the DB trigger
// trg_user_credits_touch maintains it on every update.
function stateToUpdate(state: CreditState) {
  return {
    free_monthly: state.freeMonthly,
    free_period_start: new Date(state.freePeriodStart).toISOString(),
    sub_monthly: state.subMonthly,
    sub_period_end: state.subPeriodEnd ? new Date(state.subPeriodEnd).toISOString() : null,
    balance_credits: state.balanceCredits,
    has_active_sub: state.hasActiveSub,
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
    throw new Error(`No user_credits row for user ${userId}`);
  }

  const raw = rowToState(row);
  const normalized = normalize(raw, Date.now());

  // Persist only if normalization actually changed something.
  const changed =
    normalized.freeMonthly !== raw.freeMonthly ||
    normalized.subMonthly !== raw.subMonthly ||
    normalized.freePeriodStart !== raw.freePeriodStart ||
    normalized.hasActiveSub !== raw.hasActiveSub;
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
