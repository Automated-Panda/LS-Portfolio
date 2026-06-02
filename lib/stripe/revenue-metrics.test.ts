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
      charge({ amountCents: 499, hasInvoice: false }),
      charge({ amountCents: 999, hasInvoice: false }),
      charge({ amountCents: 999, hasInvoice: true }),
      charge({ amountCents: 499, hasInvoice: false, refunded: true }),
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
