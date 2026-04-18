"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import type { FilterOptions, VehicleSummary } from "@/lib/vehicles";
import { vehicleImageUrl } from "@/lib/vehicles";

import { FilterBar } from "./filter-bar";
import { VehicleCard } from "./vehicle-card";

type Props = {
  vehicles: VehicleSummary[];
  ownedVehicleIds: string[];
  filters: FilterOptions;
};

export function VehiclesBrowser({
  vehicles,
  ownedVehicleIds,
  filters,
}: Props) {
  const searchParams = useSearchParams();

  const q = (searchParams.get("q") ?? "").toLowerCase().trim();
  const cls = searchParams.get("class") ?? "";
  const mfr = searchParams.get("mfr") ?? "";
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
  }, [vehicles, q, cls, mfr, tagParam]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">All Vehicles</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length.toLocaleString()} of{" "}
          {vehicles.length.toLocaleString()} vehicles
          {ownedVehicleIds.length > 0 &&
            ` · ${ownedVehicleIds.length} owned`}
        </p>
      </div>

      <FilterBar filters={filters} />

      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          No vehicles match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {filtered.map((v) => (
            <VehicleCard
              key={v.id}
              vehicle={v}
              imageUrl={vehicleImageUrl(v.image_path)}
              owned={ownedSet.has(v.id)}
              tagLookup={tagLookup}
            />
          ))}
        </div>
      )}
    </div>
  );
}
