// components/marketing/screenshot-showcase.tsx
import Image from "next/image";

import { Section } from "./section";
import { cn } from "@/lib/utils";

const SHOTS = [
  {
    src: "/marketing/vehicles.webp",
    alt: "GT Vault vehicles browser showing the GTA V vehicle catalog with owned counts and filters",
    title: "Browse the full catalog",
    body: "Every vehicle in the game, searchable and filterable, with your owned count on each.",
  },
  {
    src: "/marketing/property.webp",
    alt: "GT Vault property detail showing storage upgrades and assigned vehicles",
    title: "Manage your properties",
    body: "Track upgrades, storage capacity and exactly which vehicles live where.",
  },
];

export function ScreenshotShowcase() {
  return (
    <Section eyebrow="See it in action">
      <div className="flex flex-col gap-20">
        {SHOTS.map((shot, i) => (
          <div
            key={shot.src}
            className="grid grid-cols-1 items-center gap-8 lg:grid-cols-2"
          >
            <div className={cn(i % 2 === 1 && "lg:order-2")}>
              <h3 className="text-2xl font-bold tracking-tight text-neutral-100">
                {shot.title}
              </h3>
              <p className="mt-3 text-base leading-relaxed text-neutral-400">
                {shot.body}
              </p>
            </div>
            <div
              className={cn(
                "overflow-hidden rounded-xl border border-neutral-800 bg-[#101010]",
                i % 2 === 1 && "lg:order-1",
              )}
            >
              <Image
                src={shot.src}
                alt={shot.alt}
                width={1200}
                height={800}
                loading="lazy"
                className="h-auto w-full"
              />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
