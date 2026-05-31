// components/marketing/stat-bar.tsx
import type { MarketingStats } from "@/lib/marketing/stats";

function roundDown(n: number): string {
  if (n < 50) return String(n);
  const floored = Math.floor(n / 10) * 10;
  return `${floored}+`;
}

export function StatBar({ stats }: { stats: MarketingStats }) {
  const items = [
    { value: roundDown(stats.vehicles), label: "Vehicles tracked" },
    { value: roundDown(stats.properties), label: "Properties & garages" },
    { value: roundDown(stats.businesses), label: "Businesses" },
  ];
  return (
    <div className="border-y border-neutral-800 bg-[#101010]">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 py-10 sm:grid-cols-3">
        {items.map((it) => (
          <div key={it.label} className="text-center">
            <div className="text-3xl font-extrabold tabular-nums text-neutral-100 md:text-4xl">
              {it.value}
            </div>
            <div className="mt-1 text-sm text-neutral-400">{it.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
