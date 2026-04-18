"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import type {
  PropertyFilterOptions,
  PropertySummary,
} from "@/lib/properties";
import { propertyImageUrl } from "@/lib/properties";

import { FilterBar } from "./filter-bar";
import { PropertyCard } from "./property-card";

type Props = {
  properties: PropertySummary[];
  ownedPropertyIds: string[];
  filters: PropertyFilterOptions;
};

export function PropertiesBrowser({
  properties,
  ownedPropertyIds,
  filters,
}: Props) {
  const searchParams = useSearchParams();

  const q = (searchParams.get("q") ?? "").toLowerCase().trim();
  const type = searchParams.get("type") ?? "";
  const loc = searchParams.get("loc") ?? "";

  const ownedSet = useMemo(
    () => new Set(ownedPropertyIds),
    [ownedPropertyIds],
  );

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (
        q &&
        !p.display_name.toLowerCase().includes(q) &&
        !(p.location ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      if (type && p.property_type !== type) return false;
      if (loc && p.location !== loc) return false;
      return true;
    });
  }, [properties, q, type, loc]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">All Properties</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length.toLocaleString()} of{" "}
          {properties.length.toLocaleString()} properties
          {ownedPropertyIds.length > 0 &&
            ` · ${ownedPropertyIds.length} owned`}
        </p>
      </div>

      <FilterBar filters={filters} />

      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          No properties match your filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((p) => (
            <PropertyCard
              key={p.id}
              property={p}
              imageUrl={propertyImageUrl(p.image_path)}
              owned={ownedSet.has(p.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
