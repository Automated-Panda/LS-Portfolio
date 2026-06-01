"use client";

import { useEffect, useState, useTransition } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CREDIT_TIERS } from "@/lib/stripe/tiers";
import type { CreditDisplay } from "@/lib/credits/access";

import { createCheckoutSession, createPortalSession } from "./actions";

type Props = {
  balance: CreditDisplay;
  hasActiveSub: boolean;
  hasBillingAccount: boolean;
};

export function CreditsView({ balance, hasActiveSub, hasBillingAccount }: Props) {
  const params = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  useEffect(() => {
    const status = params.get("status");
    if (status === "success") toast.success("Payment complete — your credits are on the way!");
    else if (status === "cancel") toast("Checkout canceled.");
    if (status) router.replace("/credits");
  }, [params, router]);

  const buy = (lookupKey: string) => {
    setBusyKey(lookupKey);
    startTransition(async () => {
      const r = await createCheckoutSession(lookupKey);
      if ("url" in r) window.location.href = r.url;
      else {
        toast.error(r.error);
        setBusyKey(null);
      }
    });
  };

  const manage = () => {
    setBusyKey("portal");
    startTransition(async () => {
      const r = await createPortalSession();
      if ("url" in r) window.location.href = r.url;
      else {
        toast.error(r.error);
        setBusyKey(null);
      }
    });
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-bold text-neutral-100">Credits</h1>
        <div className="text-sm text-neutral-300">
          Balance: <span className="font-semibold text-[#84cc16]">
            {balance.unlimited ? "Unlimited ⚡" : `⚡ ${balance.total}`}
          </span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {CREDIT_TIERS.map((tier) => (
          <div
            key={tier.lookupKey}
            className={cn(
              "flex flex-col rounded-lg border border-[#1f1f1f] bg-[#0a0a0a] p-4",
              tier.featured && "border-[#84cc16]",
            )}
          >
            <div className="text-sm font-bold text-neutral-100">{tier.name}</div>
            <div className="mt-1 text-2xl font-bold text-neutral-100">{tier.priceLabel}</div>
            <div className="mt-1 text-sm text-[#84cc16]">{tier.credits} credits</div>
            <p className="mt-2 flex-1 text-xs text-neutral-400">{tier.blurb}</p>
            <Button
              className="mt-4 rounded-full bg-[#84cc16] text-black hover:bg-[#84cc16]/90"
              disabled={pending}
              onClick={() => buy(tier.lookupKey)}
            >
              {busyKey === tier.lookupKey ? "…" : tier.mode === "subscription" ? "Subscribe" : "Buy"}
            </Button>
          </div>
        ))}
      </div>

      {(hasActiveSub || hasBillingAccount) && (
        <div className="mt-6 text-center">
          <Button variant="outline" disabled={pending} onClick={manage}>
            {busyKey === "portal" ? "…" : "Manage subscription & billing"}
          </Button>
        </div>
      )}
    </div>
  );
}
