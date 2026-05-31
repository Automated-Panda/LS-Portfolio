// components/marketing/feature-cards.tsx
import { Boxes, Wallet, Trophy, Warehouse } from "lucide-react";

import { Section } from "./section";

const FEATURES = [
  {
    icon: Boxes,
    title: "Track everything",
    body: "Vehicles, properties, businesses, aircraft and boats — your full GTA V portfolio in one place.",
  },
  {
    icon: Wallet,
    title: "Know your net worth",
    body: "See the total value of everything you own, broken down by category.",
  },
  {
    icon: Trophy,
    title: "Catalog coverage",
    body: "Track how close you are to owning it all — per category, against the in-game caps.",
  },
  {
    icon: Warehouse,
    title: "Storage management",
    body: "Assign vehicles to specific garages and properties, and keep capacity under control.",
  },
];

export function FeatureCards() {
  return (
    <Section id="features" eyebrow="What you get">
      <h2 className="text-center text-3xl font-bold tracking-tight text-neutral-100 md:text-4xl">
        Everything you own, organized
      </h2>
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <div
              key={f.title}
              className="rounded-xl border border-neutral-800 bg-[#101010] p-6"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[#84cc16]/10 text-[#84cc16]">
                <Icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-semibold text-neutral-100">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400">
                {f.body}
              </p>
            </div>
          );
        })}
      </div>
    </Section>
  );
}
