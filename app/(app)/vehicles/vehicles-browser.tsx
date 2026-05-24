"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import type { AssetCategory, FilterOptions, VehicleSummary } from "@/lib/vehicles";
import { assetCategoryOf, vehicleImageUrl } from "@/lib/vehicles";

import { FilterBar } from "./filter-bar";
import { VehicleCard } from "./vehicle-card";

type Props = {
  vehicles: VehicleSummary[];
  ownedVehicleIds: string[];
  filters: FilterOptions;
  // "all" (default) = full catalogue at /vehicles; "owned" = /my-vehicles
  mode?: "all" | "owned";
};

export function VehiclesBrowser({
  vehicles,
  ownedVehicleIds,
  filters,
  mode = "all",
}: Props) {
  const searchParams = useSearchParams();

  const q = (searchParams.get("q") ?? "").toLowerCase().trim();
  const cls = searchParams.get("class") ?? "";
  const mfr = searchParams.get("mfr") ?? "";
  const cat = (searchParams.get("cat") ?? "") as AssetCategory | "";
  const tagParam = searchParams.get("tags") ?? "";

  const ownedSet = useMemo(
    () => new Set(ownedVehicleIds),
    [ownedVehicleIds],
  );

  const tagLookup = useMemo(() => {
    const map: Record<string, string> = {};
    for (const t of filters.tags) map[t.id] = t.display;
    return map;
  }, [filters.tags]);

  // In owned mode, restrict filter options to values present in the user's
  // collection so the Class dropdown doesn't list classes they can never select.
  const scopedFilters = useMemo(() => {
    if (mode !== "owned") return filters;
    const classes = Array.from(new Set(vehicles.map((v) => v.class))).sort();
    const mfrIds = new Set(vehicles.map((v) => v.manufacturer_id));
    const tagIds = new Set(vehicles.flatMap((v) => v.tag_ids));
    return {
      classes,
      manufacturers: filters.manufacturers.filter((m) => mfrIds.has(m.id)),
      tags: filters.tags.filter((t) => tagIds.has(t.id)),
    };
  }, [filters, vehicles, mode]);

  const filtered = useMemo(() => {
    const selectedTags = tagParam.split(",").filter(Boolean);
    return vehicles.filter((v) => {
      if (
        q &&
        !v.display_name.toLowerCase().includes(q) &&
        !v.manufacturer_display.toLowerCase().includes(q)
      ) {
        return false;
      }
      if (cat && assetCategoryOf(v.class) !== cat) return false;
      if (cls && v.class !== cls) return false;
      if (mfr && v.manufacturer_id !== mfr) return false;
      if (
        selectedTags.length > 0 &&
        !selectedTags.every((t) => v.tag_ids.includes(t))
      ) {
        return false;
      }
      return true;
    });
  }, [vehicles, q, cat, cls, mfr, tagParam]);

  const isOwnedMode = mode === "owned";
  const title = isOwnedMode ? "My Vehicles" : "All Vehicles";
  const subtitle = isOwnedMode
    ? `${filtered.length.toLocaleString()} of ${vehicles.length.toLocaleString()} owned`
    : `${filtered.length.toLocaleString()} of ${vehicles.length.toLocaleString()} vehicles${
        ownedVehicleIds.length > 0 ? ` · ${ownedVehicleIds.length} owned` : ""
      }`;
  const emptyMessage =
    isOwnedMode && vehicles.length === 0
      ? "You don't own any vehicles yet — browse All Vehicles to add some."
      : "No vehicles match your filters.";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <FilterBar filters={scopedFilters} />

      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              imageUrl={vehicleImageUrl(v.image_path)}
              tagLookup={tagLookup}
            />
          ))}
        </div>
      )}
    </div>
  );
}
