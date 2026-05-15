"use client";

import { useSearchParams } from "next/navigation";
import { useMemo } from "react";

import type {
  PropertyFilterOptions,
  PropertySummary,
} from "@/lib/properties";
import { propertyImageUrl } from "@/lib/properties";
import type { PropertyScope } from "@/lib/queries/properties";

import { FilterBar } from "./filter-bar";
import { PropertyCard } from "./property-card";

type Props = {
  scope: PropertyScope;
  properties: PropertySummary[];
  ownedPropertyIds: string[];
  filters: PropertyFilterOptions;
};

const COPY: Record<PropertyScope, { title: string; noun: string; searchPlaceholder: string }> = {
  properties: {
    title: "All Properties",
    noun: "properties",
    searchPlaceholder: "Search properties…",
  },
  businesses: {
    title: "All Businesses",
    noun: "businesses",
    searchPlaceholder: "Search businesses…",
  },
};

export function PropertiesBrowser({
  scope,
  properties,
  ownedPropertyIds,
  filters,
}: Props) {
  const copy = COPY[scope];
  const searchParams = useSearchParams();

  const q = (searchParams.get("q") ?? "").toLowerCase().trim();
  const type = searchParams.get("type") ?? "";
  const subtype = searchParams.get("subtype") ?? "";
  const nbhd = searchParams.get("nbhd") ?? "";

  const ownedSet = useMemo(
    () => new Set(ownedPropertyIds),
    [ownedPropertyIds],
  );

  // Slim index passed to FilterBar so it can derive visible subtypes per type.
  const propertiesIndex = useMemo(
    () => properties.map((p) => ({ subtype: p.subtype, property_type: p.property_type })),
    [properties],
  );

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      if (
        q &&
        !p.display_name.toLowerCase().includes(q) &&
        !(p.neighborhood ?? "").toLowerCase().includes(q) &&
        !(p.subtype_display ?? "").toLowerCase().includes(q)
      ) {
        return false;
      }
      if (type && p.property_type !== type) return false;
      if (subtype && p.subtype !== subtype) return false;
      if (nbhd && p.neighborhood !== nbhd) return false;
      return true;
    });
  }, [properties, q, type, subtype, nbhd]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length.toLocaleString()} of{" "}
          {properties.length.toLocaleString()} {copy.noun}
          {ownedPropertyIds.length > 0 &&
            ` · ${ownedPropertyIds.length} owned`}
        </p>
      </div>

      <FilterBar
        filters={filters}
        propertiesIndex={propertiesIndex}
        searchPlaceholder={copy.searchPlaceholder}
      />

      {filtered.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
          No {copy.noun} match your filters.
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
