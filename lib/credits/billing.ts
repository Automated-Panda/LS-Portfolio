// lib/credits/billing.ts
// Server-only helpers that map a user to their Stripe customer/subscription and
// end a subscription. Credit *amounts* are handled by grant_credits (the RPC);
// this file is only the Stripe-id bookkeeping + cancel.
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/** Persist the user's Stripe customer / subscription ids (only the provided ones). */
export async function linkStripeIds(
  userId: string,
  ids: { customerId?: string; subscriptionId?: string },
): Promise<void> {
  const patch: Record<string, string> = {};
  if (ids.customerId) patch.stripe_customer_id = ids.customerId;
  if (ids.subscriptionId) patch.stripe_subscription_id = ids.subscriptionId;
  if (Object.keys(patch).length === 0) return;

  const supabase = createAdminClient();
  const { error } = await supabase.from("user_credits").update(patch).eq("user_id", userId);
  if (error) throw new Error(`linkStripeIds failed: ${error.message}`);
}

export async function getStripeCustomerId(userId: string): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("user_credits")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`getStripeCustomerId failed: ${error.message}`);
  return (data?.stripe_customer_id as string | null) ?? null;
}

/** Subscription ended (cancel at period end): zero the sub bucket + clear flags. */
export async function endSubscription(userId: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("user_credits")
    .update({ sub_monthly: 0, has_active_sub: false, stripe_subscription_id: null })
    .eq("user_id", userId);
  if (error) throw new Error(`endSubscription failed: ${error.message}`);
}
