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
