"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

import { formatMoneyCompact, formatMoneyFull } from "@/lib/format";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import { propertyImageUrl } from "@/lib/properties";
import { storageAssetCategory, ASSET_NOUN } from "@/lib/vehicles";

const STORAGE_ICON = { land: "🚗", air: "✈️", sea: "🛥️" } as const;

type Props = {
  businesses: OwnedPropertyDetail[];
};

export function MyBusinessesGrid({ businesses }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Deep-link: /my-businesses?open=<catalogue property_id> redirects to the
  // business's dedicated page.
  useEffect(() => {
    const focus = searchParams.get("open");
    if (!focus) return;
    const match = businesses.find((b) => b.property_id === focus);
    if (match) router.replace(`/my-businesses/${match.id}`);
  }, [searchParams, businesses, router]);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {businesses.map((b) => {
          const imageUrl = propertyImageUrl(b.image_path);
          const totalCapacity =
            b.base_capacity +
            b.upgrades.filter((u) => u.is_installed).reduce((s, u) => s + u.capacity, 0);
          const storageCat = storageAssetCategory(b.subtype);
          const storageNoun = ASSET_NOUN[storageCat];
          const installedUpgradeCost = b.upgrades
            .filter((u) => u.is_installed && u.price !== null)
            .reduce((s, u) => s + (u.price ?? 0), 0);
          const totalCost = (b.price ?? 0) + installedUpgradeCost;
          return (
            <Link
              key={b.id}
              href={`/my-businesses/${b.id}`}
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
                    {STORAGE_ICON[storageCat]} {b.total_cars} / {totalCapacity} {storageNoun} stored
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
            </Link>
          );
        })}
      </div>
    </>
  );
}
