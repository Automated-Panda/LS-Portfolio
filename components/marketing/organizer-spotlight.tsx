// components/marketing/organizer-spotlight.tsx
import Image from "next/image";
import { Sparkles } from "lucide-react";

import { Section } from "./section";

export function OrganizerSpotlight() {
  return (
    <Section eyebrow="Pro · Coming soon">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[#84cc16]/40 bg-[#84cc16]/10 px-3 py-1 text-xs font-medium text-[#84cc16]">
            <Sparkles className="h-3.5 w-3.5" />
            Pro · Coming soon
          </span>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-neutral-100 md:text-4xl">
            Organize your garage with AI
          </h2>
          <p className="mt-4 text-base leading-relaxed text-neutral-400">
            Describe what you want in plain English and the AI Organizer plans
            the moves and applies them for you.
          </p>
          <div className="mt-6 rounded-lg border border-neutral-800 bg-[#101010] p-4">
            <p className="text-xs uppercase tracking-wider text-neutral-500">
              You type
            </p>
            <p className="mt-1 text-neutral-200">
              &ldquo;Put all my sports cars in Eclipse Towers&rdquo;
            </p>
            <p className="mt-3 text-sm text-[#84cc16]">
              → GT Vault plans the moves and does it.
            </p>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-neutral-800 bg-[#101010]">
          <Image
            src="/marketing/organizer.webp"
            alt="GT Vault AI Organizer turning a natural-language request into a plan of vehicle moves"
            width={1211}
            height={580}
            loading="lazy"
            className="h-auto w-full"
          />
        </div>
      </div>
    </Section>
  );
}
