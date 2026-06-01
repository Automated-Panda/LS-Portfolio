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
    next.hasActiveSub = false; // sub lapsed → free-refill eligibility resumes below
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
  if (!Number.isInteger(amount) || amount < 0) {
    throw new RangeError(`spend: amount must be a non-negative integer, got ${amount}`);
  }

  const state = normalize(s, nowMs);

  if (amount === 0) {
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
  const fromPurchased = remaining; // safe: total >= amount, so what's left after free+sub fits within balanceCredits

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
