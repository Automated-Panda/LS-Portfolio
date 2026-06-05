"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  PropertyFilterOptions,
  PropertySummary,
} from "@/lib/properties";
import { propertyImageUrl } from "@/lib/properties";
import { priceMatches, priceParam, sortByParam } from "@/lib/browse-filters";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import type { PropertyScope } from "@/lib/queries/properties";
import { TowerUnitsDialog } from "@/components/portfolio/tower-units-dialog";

import { FilterBar } from "./filter-bar";
import { PropertyCard } from "./property-card";

type Props = {
  scope: PropertyScope;
  properties: PropertySummary[];
  ownedPropertyIds: string[];
  filters: PropertyFilterOptions;
  /** Owned detail lets the Settings icon / owned-card click resolve the owned
   * id and navigate to the asset's dedicated detail page. */
  ownedProperties?: OwnedPropertyDetail[];
  selectionMode?: "browse" | "multi";
  selectedIds?: string[];
  onToggleSelection?: (propertyId: string) => void;
};

const COPY: Record<PropertyScope, { title: string; noun: string; searchPlaceholder: string }> = {
  properties: {
    title: "All Properties",
    noun: "properties",
    searchPlaceholder: "Search property name…",
  },
  businesses: {
    title: "All Businesses",
    noun: "businesses",
    searchPlaceholder: "Search business name…",
  },
};

export function PropertiesBrowser({
  scope,
  properties,
  ownedPropertyIds,
  filters,
  ownedProperties,
  selectionMode,
  selectedIds,
  onToggleSelection,
}: Props) {
  const copy = COPY[scope];
  const router = useRouter();
  const searchParams = useSearchParams();
  const [openTowerId, setOpenTowerId] = useState<string | null>(null);
  // Owned-card management navigates to the asset's dedicated detail page
  // (/my-properties/[id] or /my-businesses/[id]) — the card grid where you see
  // & add vehicles. Only enabled when ownedProperties is supplied and we're not
  // in multi-select (onboarding picker) mode.
  const canManageOwned = !!ownedProperties && selectionMode !== "multi";

  const handleOpenManagement = (catalogueId: string) => {
    const owned = ownedProperties?.find((p) => p.property_id === catalogueId);
    if (!owned) return;
    const base = scope === "businesses" ? "/my-businesses" : "/my-properties";
    router.push(`${base}/${owned.id}`);
  };

  const q = (searchParams.get("q") ?? "").toLowerCase().trim();
  const type = searchParams.get("type") ?? "";
  const subtype = searchParams.get("subtype") ?? "";
  const nbhd = searchParams.get("nbhd") ?? "";
  const pmin = priceParam(searchParams.get("pmin"));
  const pmax = priceParam(searchParams.get("pmax"));
  const sort = searchParams.get("sort") ?? "default";

  const ownedSet = useMemo(
    () => new Set(ownedPropertyIds),
    [ownedPropertyIds],
  );
  const selectedSet = useMemo(
    () => new Set(selectedIds ?? []),
    [selectedIds],
  );

  // Group units under their parent_building so each tower knows its children.
  const unitsByTower = useMemo(() => {
    const m = new Map<string, PropertySummary[]>();
    for (const p of properties) {
      if (!p.parent_building) continue;
      const arr = m.get(p.parent_building) ?? [];
      arr.push(p);
      m.set(p.parent_building, arr);
    }
    return m;
  }, [properties]);

  // Slim index passed to FilterBar so it can derive visible subtypes per type.
  // Don't include unit rows — they share their tower's subtype so they don't
  // affect the available pills, and including them would inflate the count.
  const propertiesIndex = useMemo(
    () =>
      properties
        .filter((p) => !p.parent_building)
        .map((p) => ({ subtype: p.subtype, property_type: p.property_type })),
    [properties],
  );

  const filtered = useMemo(() => {
    return properties.filter((p) => {
      // Hide units from the main grid — they live inside their tower dialog.
      if (p.parent_building) return false;
      // Search matches the property NAME only — location / subtype filters
      // have their own dedicated pills (Neighborhood + Subtype).
      if (q && !p.display_name.toLowerCase().includes(q)) {
        return false;
      }
      if (type && p.property_type !== type) return false;
      if (subtype && p.subtype !== subtype) return false;
      if (nbhd && p.neighborhood !== nbhd) return false;
      if (!priceMatches(p.price, pmin, pmax)) return false;
      return true;
    });
  }, [properties, q, type, subtype, nbhd, pmin, pmax]);

  const sortedFiltered = useMemo(
    () => sortByParam(filtered, sort),
    [filtered, sort],
  );

  const openTower = openTowerId
    ? properties.find((p) => p.id === openTowerId) ?? null
    : null;
  const openTowerUnits = openTowerId ? unitsByTower.get(openTowerId) ?? [] : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{copy.title}</h1>
        <p className="text-sm text-muted-foreground">
          {filtered.length.toLocaleString()} of{" "}
          {properties.filter((p) => !p.parent_building).length.toLocaleString()}{" "}
          {copy.noun}
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
          {sortedFiltered.map((p) => {
            const units = unitsByTower.get(p.id);
            const isTower = units !== undefined && units.length > 0;
            return (
              <PropertyCard
                key={p.id}
                property={p}
                imageUrl={propertyImageUrl(p.image_path)}
                owned={ownedSet.has(p.id)}
                selectionMode={selectionMode ?? "browse"}
                selected={selectedSet.has(p.id)}
                onSelect={onToggleSelection}
                onOpenManagement={
                  canManageOwned ? handleOpenManagement : undefined
                }
                tower={
                  isTower
                    ? {
                        totalUnits: units!.length,
                        ownedCount: units!.filter((u) => ownedSet.has(u.id)).length,
                        selectedCount: units!.filter((u) => selectedSet.has(u.id)).length,
                        onOpen: () => setOpenTowerId(p.id),
                      }
                    : undefined
                }
              />
            );
          })}
        </div>
      )}

      {openTower && (
        <TowerUnitsDialog
          tower={openTower}
          units={openTowerUnits}
          ownedSet={ownedSet}
          open={true}
          onOpenChange={(o) => !o && setOpenTowerId(null)}
          selectionMode={selectionMode}
          selectedIds={selectedIds}
          onToggleSelection={onToggleSelection}
        />
      )}

    </div>
  );
}
