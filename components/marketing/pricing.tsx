// components/marketing/pricing.tsx
import Link from "next/link";
import { Check, Sparkles } from "lucide-react";

import { CREDIT_TIERS } from "@/lib/stripe/tiers";
import { SIGNUP_BONUS, FREE_MONTHLY, PLAN_BASE_COST } from "@/lib/credits/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { Section } from "./section";

const FREE_FEATURES = [
  "Track unlimited vehicles, properties, businesses, aircraft & boats",
  "Live net worth across your entire portfolio",
  "Catalog coverage against every in-game cap",
  "Garage & storage management",
  `${SIGNUP_BONUS} bonus AI credits when you sign up`,
  `${FREE_MONTHLY} free AI credits, topped up every month`,
];

export function Pricing() {
  return (
    <Section id="pricing" eyebrow="Pricing">
      <h2 className="text-center text-3xl font-bold tracking-tight text-neutral-100 md:text-4xl">
        Start free. Pay only when you want AI.
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-base leading-relaxed text-neutral-400">
        Tracking and valuing your empire is free, forever — no card required. The
        AI Organizer runs on credits: top up with a one-off pack, or go Pro for a
        fresh batch every month.
      </p>

      {/* Free plan */}
      <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-[#84cc16]/30 bg-[#101010] p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-bold text-neutral-100">Free</h3>
            <p className="mt-1 text-sm text-neutral-400">
              Everything you need to track and value your portfolio.
            </p>
          </div>
          <div className="shrink-0 sm:text-right">
            <p className="text-3xl font-extrabold text-neutral-100">$0</p>
            <p className="text-xs uppercase tracking-wider text-neutral-500">
              forever
            </p>
          </div>
        </div>
        <ul className="mt-6 grid gap-3 sm:grid-cols-2">
          {FREE_FEATURES.map((f) => (
            <li
              key={f}
              className="flex items-start gap-3 text-sm text-neutral-300"
            >
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#84cc16]" />
              {f}
            </li>
          ))}
        </ul>
        <div className="mt-8">
          <Button
            asChild
            size="lg"
            className="bg-[#84cc16] text-black hover:bg-[#84cc16]/90"
          >
            <Link href="/signup">Get started free</Link>
          </Button>
        </div>
      </div>

      {/* Credit packs + subscription */}
      <p className="mx-auto mt-14 max-w-xl text-center text-sm font-medium uppercase tracking-[0.2em] text-neutral-500">
        Need more AI? Add credits.
      </p>
      <div className="mx-auto mt-6 grid max-w-4xl grid-cols-1 gap-4 sm:grid-cols-3">
        {CREDIT_TIERS.map((tier) => (
          <div
            key={tier.lookupKey}
            className={cn(
              "relative flex flex-col rounded-xl border bg-[#101010] p-6",
              tier.featured
                ? "border-[#84cc16] shadow-[0_0_50px_rgba(132,204,22,0.10)]"
                : "border-neutral-800",
            )}
          >
            {tier.featured && (
              <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-[#84cc16] px-3 py-0.5 text-xs font-semibold text-black">
                <Sparkles className="h-3 w-3" />
                Best value
              </span>
            )}
            <h4 className="font-semibold text-neutral-100">{tier.name}</h4>
            <p className="mt-2 text-3xl font-extrabold text-neutral-100">
              {tier.priceLabel}
            </p>
            <p className="mt-1 text-xs uppercase tracking-wider text-neutral-500">
              {tier.mode === "subscription" ? "billed monthly" : "one-time"}
            </p>
            <p className="mt-4 flex items-center gap-2 text-sm text-[#84cc16]">
              <Sparkles className="h-4 w-4" />
              {tier.credits} credits
              {tier.mode === "subscription" ? " / month" : ""}
            </p>
            <p className="mt-2 flex-1 text-sm leading-relaxed text-neutral-400">
              {tier.blurb}
            </p>
            <div className="mt-6">
              <Button
                asChild
                className={cn(
                  "w-full",
                  tier.featured
                    ? "bg-[#84cc16] text-black hover:bg-[#84cc16]/90"
                    : "border border-neutral-700 bg-transparent text-neutral-100 hover:bg-neutral-900",
                )}
              >
                <Link href="/signup">
                  {tier.mode === "subscription" ? "Go Pro" : "Get credits"}
                </Link>
              </Button>
            </div>
          </div>
        ))}
      </div>
      <p className="mx-auto mt-8 max-w-xl text-center text-xs leading-relaxed text-neutral-500">
        Credits power the AI Organizer. A typical plan costs about{" "}
        {PLAN_BASE_COST} credits — so a Starter pack is roughly 10 plans. Buy a
        pack once, or subscribe and never run dry. Cancel anytime.
      </p>
    </Section>
  );
}
