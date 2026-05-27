"use client";

import { useState } from "react";

import { PropertyDrawer } from "@/components/portfolio/property-drawer";
import { formatMoneyCompact, formatMoneyFull } from "@/lib/format";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import { propertyImageUrl } from "@/lib/properties";

type Props = {
  businesses: OwnedPropertyDetail[];
  instances: OwnedVehicleInstance[];
};

export function MyBusinessesGrid({ businesses, instances }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = businesses.find((b) => b.id === selectedId);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {businesses.map((b) => {
          const imageUrl = propertyImageUrl(b.image_path);
          const totalCapacity =
            b.base_capacity +
            b.upgrades.filter((u) => u.is_installed).reduce((s, u) => s + u.capacity, 0);
          const installedUpgradeCost = b.upgrades
            .filter((u) => u.is_installed && u.price !== null)
            .reduce((s, u) => s + (u.price ?? 0), 0);
          const totalCost = (b.price ?? 0) + installedUpgradeCost;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedId(b.id)}
              className="flex flex-col overflow-hidden rounded-lg border bg-card text-left hover:border-foreground/40"
            >
              <div className="relative aspect-video w-full bg-muted">
                {imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt={b.display_name} className="h-full w-full object-cover" />
                )}
                <span className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium text-white">
                  {b.total_upgrades === 0
                    ? "No upgrades"
                    : b.installed_upgrades === b.total_upgrades
                      ? "✓ Fully built"
                      : `${b.installed_upgrades} / ${b.total_upgrades} upgrades`}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-3">
                <p className="text-sm font-medium">{b.display_name}</p>
                <p className="text-xs text-muted-foreground">
                  {b.subtype_display}
                  {b.neighborhood ? ` · ${b.neighborhood}` : ""}
                </p>
                {totalCapacity > 0 && (
                  <p className="mt-1 text-xs text-emerald-400">
                    🚗 {b.total_cars} / {totalCapacity} cars stored
                  </p>
                )}
                {totalCost > 0 && (
                  <p
                    className="text-xs text-emerald-300/80 tabular-nums"
                    title={`${formatMoneyFull(b.price)} base${installedUpgradeCost > 0 ? ` + ${formatMoneyFull(installedUpgradeCost)} upgrades` : ""}`}
                  >
                    💰 {formatMoneyCompact(totalCost)} invested
                  </p>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {selected && (
        <PropertyDrawer
          property={selected}
          allOwnedProperties={businesses}
          instances={instances}
          open={true}
          onOpenChange={(o) => !o && setSelectedId(null)}
        />
      )}
    </>
  );
}
