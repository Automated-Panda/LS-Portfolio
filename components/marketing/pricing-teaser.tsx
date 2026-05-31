// components/marketing/pricing-teaser.tsx
import { Check } from "lucide-react";

import { Section } from "./section";

const FREE = [
  "Track unlimited vehicles, properties & businesses",
  "Net worth & catalog coverage",
  "Storage management",
];

export function PricingTeaser() {
  return (
    <Section eyebrow="Pricing">
      <h2 className="text-center text-3xl font-bold tracking-tight text-neutral-100 md:text-4xl">
        Free to use
      </h2>
      <p className="mx-auto mt-3 max-w-md text-center text-neutral-400">
        Everything you need to track your empire, free. A Pro tier with the AI
        Organizer is coming.
      </p>
      <div className="mx-auto mt-10 max-w-md rounded-xl border border-neutral-800 bg-[#101010] p-8">
        <ul className="flex flex-col gap-3">
          {FREE.map((f) => (
            <li key={f} className="flex items-start gap-3 text-sm text-neutral-300">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#84cc16]" />
              {f}
            </li>
          ))}
        </ul>
      </div>
    </Section>
  );
}
