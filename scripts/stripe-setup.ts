// scripts/stripe-setup.ts
//
// Idempotently creates the GT Vault credit products + prices in Stripe,
// matching docs/superpowers/specs/2026-06-01-pro-credit-pricing-design.md.
//
// Run it as many times as you like — it finds existing products/prices by a
// stable id and reuses them instead of duplicating.
//
//   Test mode:  npm run stripe:setup            (needs sk_test_... key)
//   Live mode:  npm run stripe:setup -- --live  (needs sk_live_... key + the flag)
//
// The secret key is read from STRIPE_SECRET_KEY in .env.local — never paste it
// on the command line or in chat.
//
// Credit amounts live in product metadata.credits, so checkout/webhook code can
// read how many credits to grant straight from Stripe (single source of truth).

import Stripe from "stripe";

type CatalogItem = {
  /** stable id stored in product metadata.gtvault_id — used to find-or-create */
  id: string;
  name: string;
  description: string;
  credits: number;
  /** "pack" = one-time payment, "subscription" = recurring monthly */
  kind: "pack" | "subscription";
  priceCents: number;
  /** stable lookup_key on the price so re-runs can find it */
  lookupKey: string;
};

const CATALOG: CatalogItem[] = [
  {
    id: "starter",
    name: "Starter Pack",
    description: "50 credits — one-time top-up.",
    credits: 50,
    kind: "pack",
    priceCents: 499,
    lookupKey: "gtvault_starter_50",
  },
  {
    id: "plus",
    name: "Plus Pack",
    description: "150 credits — one-time top-up. Best value.",
    credits: 150,
    kind: "pack",
    priceCents: 999,
    lookupKey: "gtvault_plus_150",
  },
  {
    id: "pro",
    name: "Pro",
    description: "250 credits every month. Cancel anytime.",
    credits: 250,
    kind: "subscription",
    priceCents: 999,
    lookupKey: "gtvault_pro_250_monthly",
  },
];

async function findOrCreateProduct(
  stripe: Stripe,
  item: CatalogItem,
): Promise<Stripe.Product> {
  const search = await stripe.products.search({
    query: `metadata['gtvault_id']:'${item.id}'`,
  });

  const metadata = {
    gtvault_id: item.id,
    credits: String(item.credits),
    kind: item.kind,
  };

  if (search.data.length > 0) {
    const existing = search.data[0];
    const updated = await stripe.products.update(existing.id, {
      name: item.name,
      description: item.description,
      metadata,
      active: true,
    });
    console.log(`  ↻ product reused & updated: ${updated.id} (${item.name})`);
    return updated;
  }

  const created = await stripe.products.create({
    name: item.name,
    description: item.description,
    metadata,
  });
  console.log(`  ✚ product created: ${created.id} (${item.name})`);
  return created;
}

async function findOrCreatePrice(
  stripe: Stripe,
  item: CatalogItem,
  product: Stripe.Product,
): Promise<Stripe.Price> {
  const existing = await stripe.prices.list({
    lookup_keys: [item.lookupKey],
    active: true,
    limit: 1,
  });

  const recurring =
    item.kind === "subscription"
      ? ({ interval: "month" } as const)
      : undefined;

  let replacing = false;
  if (existing.data.length > 0) {
    const price = existing.data[0];
    const matches =
      price.unit_amount === item.priceCents &&
      price.currency === "usd" &&
      (item.kind === "subscription"
        ? price.recurring?.interval === "month"
        : price.recurring === null);

    if (matches) {
      console.log(`  ↻ price reused: ${price.id} ($${(item.priceCents / 100).toFixed(2)})`);
      return price;
    }

    // Amount/interval changed — prices are immutable, so mint a new one and
    // move the lookup_key onto it (deactivating the old).
    console.log(`  ⚠ price changed — creating a replacement for ${price.id}`);
    await stripe.prices.update(price.id, { active: false });
    replacing = true;
  }

  const created = await stripe.prices.create({
    product: product.id,
    currency: "usd",
    unit_amount: item.priceCents,
    lookup_key: item.lookupKey,
    ...(replacing ? { transfer_lookup_key: true } : {}),
    ...(recurring ? { recurring } : {}),
    metadata: { gtvault_id: item.id, credits: String(item.credits) },
  });
  console.log(`  ✚ price created: ${created.id} ($${(item.priceCents / 100).toFixed(2)}${recurring ? "/mo" : ""})`);
  return created;
}

async function main() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("✗ STRIPE_SECRET_KEY is not set in .env.local. Aborting.");
    process.exit(1);
  }

  const isLiveKey = key.startsWith("sk_live_") || key.startsWith("rk_live_");
  const liveFlag = process.argv.includes("--live");

  if (isLiveKey && !liveFlag) {
    console.error(
      "✗ That's a LIVE key. Re-run with `-- --live` to confirm you mean it.\n" +
        "  (Strongly recommended: set up in test mode first.)",
    );
    process.exit(1);
  }
  if (!isLiveKey && liveFlag) {
    console.error("✗ --live was passed but the key isn't a live key. Aborting to be safe.");
    process.exit(1);
  }

  const mode = isLiveKey ? "🔴 LIVE" : "🟢 TEST";
  console.log(`\nGT Vault → Stripe product setup  [${mode}]\n`);

  const stripe = new Stripe(key);

  const results: Array<{ item: CatalogItem; product: string; price: string }> = [];
  for (const item of CATALOG) {
    console.log(`• ${item.name}`);
    const product = await findOrCreateProduct(stripe, item);
    const price = await findOrCreatePrice(stripe, item, product);
    results.push({ item, product: product.id, price: price.id });
  }

  console.log(`\n✅ Done. Price IDs to wire into the app later:\n`);
  for (const r of results) {
    console.log(
      `   ${r.item.id.padEnd(8)} ${r.item.credits} cr · $${(r.item.priceCents / 100).toFixed(2)}${r.item.kind === "subscription" ? "/mo" : ""}`,
    );
    console.log(`   ${" ".repeat(8)} price: ${r.price}`);
  }
  console.log("");
}

main().catch((err) => {
  console.error("✗ Stripe setup failed:", err.message ?? err);
  process.exit(1);
});
