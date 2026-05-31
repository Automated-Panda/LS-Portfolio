"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { PropertyDrawer } from "@/components/portfolio/property-drawer";
import { formatMoneyCompact, formatMoneyFull } from "@/lib/format";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import { propertyImageUrl } from "@/lib/properties";
import { storageAssetCategory, ASSET_NOUN } from "@/lib/vehicles";

const STORAGE_ICON = { land: "🚗", air: "✈️", sea: "🛥️" } as const;

type Props = {
  properties: OwnedPropertyDetail[];
  instances: OwnedVehicleInstance[];
};

export function MyPropertiesGrid({ properties, instances }: Props) {
  const searchParams = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Deep-link: /my-properties?open=<catalogue property_id> auto-opens that
  // property's drawer. Used by the toast action on /properties to jump the
  // user straight into "add cars" after owning a new property.
  useEffect(() => {
    const focus = searchParams.get("open");
    if (!focus) return;
    const match = properties.find((p) => p.property_id === focus);
    if (match) setSelectedId(match.id);
  }, [searchParams, properties]);

  const selected = properties.find((p) => p.id === selectedId);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {properties.map((p) => {
          const imageUrl = propertyImageUrl(p.image_path);
          const totalCapacity =
            p.base_capacity +
            p.upgrades.filter((u) => u.is_installed).reduce((s, u) => s + u.capacity, 0);
          const storageCat = storageAssetCategory(p.subtype);
          const storageNoun = ASSET_NOUN[storageCat];
          const installedUpgradeCost = p.upgrades
            .filter((u) => u.is_installed && u.price !== null)
            .reduce((s, u) => s + (u.price ?? 0), 0);
          const totalCost = (p.price ?? 0) + installedUpgradeCost;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className="flex flex-col overflow-hidden rounded-lg border bg-card text-left hover:border-foreground/40"
            >
              <div className="relative aspect-video w-full bg-muted">
                {imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt={p.display_name} className="h-full w-full object-cover" />
                )}
                <span className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium text-white">
                  {p.total_upgrades === 0
                    ? "No upgrades"
                    : p.installed_upgrades === p.total_upgrades
                      ? "✓ Fully built"
                      : `${p.installed_upgrades} / ${p.total_upgrades} upgrades`}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-3">
                <p className="text-sm font-medium">{p.display_name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.subtype_display}
                  {p.neighborhood ? ` · ${p.neighborhood}` : ""}
                </p>
                {totalCapacity > 0 && (
                  <p className="mt-1 text-xs text-emerald-400">
                    {STORAGE_ICON[storageCat]} {p.total_cars} / {totalCapacity} {storageNoun} stored
                  </p>
                )}
                {totalCost > 0 && (
                  <p
                    className="text-xs text-emerald-300/80 tabular-nums"
                    title={`${formatMoneyFull(p.price)} base${installedUpgradeCost > 0 ? ` + ${formatMoneyFull(installedUpgradeCost)} upgrades` : ""}`}
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
          allOwnedProperties={properties}
          instances={instances}
          open={true}
          onOpenChange={(o) => !o && setSelectedId(null)}
        />
      )}
    </>
  );
}
