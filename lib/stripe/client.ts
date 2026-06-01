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
