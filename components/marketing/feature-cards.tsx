// components/marketing/feature-cards.tsx
import { Boxes, Wallet, Trophy, Warehouse, Sparkles, Search } from "lucide-react";

import { Section } from "./section";

const FEATURES = [
  {
    icon: Boxes,
    title: "Track everything you own",
    body: "Vehicles, properties, businesses, aircraft and boats — your entire GTA V portfolio in one place. Mark what you own in a couple of taps and GT Vault remembers it across every session.",
  },
  {
    icon: Wallet,
    title: "Know your real net worth",
    body: "See the total value of everything you own, broken down by category. Watch your empire grow over time and know exactly where your in-game fortune is tied up.",
  },
  {
    icon: Trophy,
    title: "Chase 100% completion",
    body: "Track how close you are to owning it all — per category and against the real in-game caps — so you always know what's left to collect and what to buy next.",
  },
  {
    icon: Warehouse,
    title: "Master your storage",
    body: "Assign vehicles to specific garages and properties, see capacity at a glance, and stop double-booking spaces. Plan your storage before you spend a dollar in-game.",
  },
  {
    icon: Sparkles,
    title: "Organize with AI",
    body: "Describe what you want in plain English — \"move my supercars to Eclipse Towers\" — and the AI Organizer plans the moves and applies them for you in seconds.",
  },
  {
    icon: Search,
    title: "Search the full catalog",
    body: "Every vehicle, property and business in the game, searchable and filterable by class, price and source — with your owned count on each, kept up to date as the game changes.",
  },
];

export function FeatureCards() {
  return (
    <Section id="features" eyebrow="What you get">
      <h2 className="text-center text-3xl font-bold tracking-tight text-neutral-100 md:text-4xl">
        Everything you own, organized
      </h2>
      <p className="mx-auto mt-3 max-w-2xl text-center text-base leading-relaxed text-neutral-400">
        GT Vault turns the sprawl of GTA Online into a single, clear picture of
        your empire — what you own, what it's worth, and what's left to collect.
      </p>
      <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
