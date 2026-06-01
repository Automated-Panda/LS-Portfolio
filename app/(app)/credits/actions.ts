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
