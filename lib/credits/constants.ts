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
