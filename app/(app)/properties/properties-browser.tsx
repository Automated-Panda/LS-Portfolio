"use client";

import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  PropertyFilterOptions,
  PropertySummary,
} from "@/lib/properties";
import { propertyImageUrl } from "@/lib/properties";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { PropertyScope } from "@/lib/queries/properties";
import { PropertyDrawer } from "@/components/portfolio/property-drawer";
import { TowerUnitsDialog } from "@/components/portfolio/tower-units-dialog";

import { FilterBar } from "./filter-bar";
import { PropertyCard } from "./property-card";

type Props = {
  scope: PropertyScope;
  properties: PropertySummary[];
  ownedPropertyIds: string[];
  filters: PropertyFilterOptions;
  /** Owned detail + instances power the in-place management drawer so the
   * Settings icon on an owned card doesn't have to redirect to /my-properties. */
  ownedProperties?: OwnedPropertyDetail[];
  instances?: OwnedVehicleInstance[];
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
  instances,
  selectionMode,
  selectedIds,
  onToggleSelection,
}: Props) {
  const copy = COPY[scope];
  const searchParams = useSearchParams();
  const [openTowerId, setOpenTowerId] = useState<string | null>(null);
  // Catalogue property_id of the owned property whose management drawer is
  // open. Only enabled when ownedProperties + instances are supplied
  // (the /properties + /businesses pages) — selection-mode flows like the
  // onboarding wizard pass neither and keep the old non-drawer behaviour.
  const [openOwnedCatalogueId, setOpenOwnedCatalogueId] = useState<
    string | null
  >(null);
  const canOpenDrawerInPlace =
    !!ownedProperties && !!instances && selectionMode !== "multi";
  const openOwnedDetail = openOwnedCatalogueId
    ? ownedProperties?.find((p) => p.property_id === openOwnedCatalogueId) ?? null
    : null;

  const q = (searchParams.get("q") ?? "").toLowerCase().trim();
  const type = searchParams.get("type") ?? "";
  const subtype = searchParams.get("subtype") ?? "";
  const nbhd = searchParams.get("nbhd") ?? "";

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
      return true;
    });
  }, [properties, q, type, subtype, nbhd]);

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
          {filtered.map((p) => {
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
                  canOpenDrawerInPlace
                    ? (id) => setOpenOwnedCatalogueId(id)
                    : undefined
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

      {openOwnedDetail && ownedProperties && instances && (
        <PropertyDrawer
          property={openOwnedDetail}
          allOwnedProperties={ownedProperties}
          instances={instances}
          open={true}
          onOpenChange={(o) => !o && setOpenOwnedCatalogueId(null)}
        />
      )}
    </div>
  );
}
