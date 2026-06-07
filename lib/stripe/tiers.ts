// lib/stripe/tiers.ts
// Display catalog for the /credits page + the lookup keys/mode used to start
// checkout. Credit *amounts* shown here are for display; fulfillment reads the
// authoritative count from Stripe product metadata (see creditsFromMetadata).
export type CreditTier = {
  lookupKey: string;
  name: string;
  credits: number;
  priceLabel: string;
  mode: "payment" | "subscription";
  blurb: string;
  featured?: boolean;
};

export const CREDIT_TIERS: CreditTier[] = [
  { lookupKey: "gtvault_starter_50", name: "Starter", credits: 50, priceLabel: "$4.99", mode: "payment", blurb: "One-time top-up." },
  { lookupKey: "gtvault_plus_150", name: "Plus", credits: 150, priceLabel: "$9.99", mode: "payment", blurb: "Best value.", featured: true },
  { lookupKey: "gtvault_pro_250_monthly", name: "Pro", credits: 250, priceLabel: "$9.99/mo", mode: "subscription", blurb: "250 credits every month. Cancel anytime." },
];

/** One-time "extra GTA-account profile" unlock (not a credit tier — multi-character). */
export const PROFILE_SLOT = {
  lookupKey: "gtvault_profile_slot_299",
  priceLabel: "$2.99",
} as const;
