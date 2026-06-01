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
  it("clears hasActiveSub when the sub period lapses and resumes free refill", () => {
    const s = state({
      subMonthly: 250,
      subPeriodEnd: NOW - 1,
      hasActiveSub: true,
      freeMonthly: 0,
      freePeriodStart: NOW - FREE_REFILL_INTERVAL_MS,
    });
    const n = normalize(s, NOW);
    expect(n.subMonthly).toBe(0);
    expect(n.hasActiveSub).toBe(false);
    expect(n.freeMonthly).toBe(10); // free refill resumes now that they're not subscribed
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
  it("handles spending exactly the full balance", () => {
    const s = state({ freeMonthly: 3, subMonthly: 2, balanceCredits: 5 });
    const r = spend(s, 10, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.debits).toEqual({ free: 3, sub: 2, purchased: 5 });
      expect(r.next.freeMonthly).toBe(0);
      expect(r.next.subMonthly).toBe(0);
      expect(r.next.balanceCredits).toBe(0);
    }
  });
  it("draws only from purchased when free and sub are empty", () => {
    const s = state({ freeMonthly: 0, subMonthly: 0, balanceCredits: 10 });
    const r = spend(s, 5, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.debits).toEqual({ free: 0, sub: 0, purchased: 5 });
      expect(r.next.balanceCredits).toBe(5);
    }
  });
  it("throws on negative or non-integer amounts", () => {
    expect(() => spend(state(), -1, NOW)).toThrow(RangeError);
    expect(() => spend(state(), 2.5, NOW)).toThrow(RangeError);
  });
});
