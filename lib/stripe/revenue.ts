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
        // The pinned API version (2026-05-27.dahlia) dropped `invoice` from the
        // Charge typings, but it's still present on the wire for renewal charges.
        hasInvoice: (ch as { invoice?: unknown }).invoice != null,
        createdAt: ch.created * 1000,
        email: ch.billing_details?.email ?? ch.receipt_email ?? null,
      });
    }

    return { ok: true, subs, charges, testMode };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : "Stripe request failed." };
  }
}
