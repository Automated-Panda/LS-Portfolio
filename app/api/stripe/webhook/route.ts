import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";

import { getStripe } from "@/lib/stripe/client";
import { creditsFromMetadata } from "@/lib/stripe/metadata";
import { grantCredits } from "@/lib/credits/server";
import { linkStripeIds, endSubscription, grantProfileSlot } from "@/lib/credits/billing";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET not set" }, { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 });
  }

  const body = await request.text(); // raw body required for signature verification
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, secret);
  } catch (err) {
    return NextResponse.json(
      { error: `Signature verification failed: ${(err as Error).message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        if (!userId) break;

        await linkStripeIds(userId, {
          customerId: typeof session.customer === "string" ? session.customer : undefined,
          subscriptionId:
            typeof session.subscription === "string" ? session.subscription : undefined,
        });

        // Multi-character: one-time "extra GTA-account profile" unlock.
        if (session.metadata?.sku === "profile_slot") {
          await grantProfileSlot(userId, event.id);
          break;
        }

        // Packs grant here; subscriptions are granted on invoice.paid.
        if (session.mode === "payment") {
          const credits = creditsFromMetadata(session.metadata);
          await grantCredits(userId, {
            amount: credits,
            kind: "purchased",
            reason: "purchase",
            stripeEventId: event.id,
          });
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;

        // In stripe-node v22, the subscription reference moved off the top-level
        // Invoice object and into invoice.parent.subscription_details.subscription
        // (type: Invoice.Parent.SubscriptionDetails.subscription = string | Subscription).
        const subRef = invoice.parent?.subscription_details?.subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (!subId) break;

        const sub = await stripe.subscriptions.retrieve(subId);
        const userId = sub.metadata?.user_id;
        if (!userId) break;

        // In stripe-node v22, current_period_end moved off the top-level
        // Subscription object and onto each SubscriptionItem
        // (type: SubscriptionItem.current_period_end = number, Unix seconds).
        // We use the first item's value, which covers the overwhelmingly common
        // single-item subscription case.
        const periodEndSec = sub.items.data[0]?.current_period_end;
        if (periodEndSec === undefined) {
          throw new Error(`No subscription items found for subscription ${subId}`);
        }

        const credits = creditsFromMetadata(sub.metadata);
        await grantCredits(userId, {
          amount: credits,
          kind: "subscription",
          reason: "subscription_grant",
          stripeEventId: event.id,
          subPeriodEnd: periodEndSec * 1000, // Stripe sends seconds; grantCredits wants ms
        });
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.user_id;
        if (!userId) break;
        await endSubscription(userId);
        break;
      }

      default:
        break;
    }
  } catch (err) {
    // Non-2xx makes Stripe retry — correct for transient failures.
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
