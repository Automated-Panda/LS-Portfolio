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
