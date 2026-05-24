"use client";

import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationFilter } from "@/components/portfolio/location-filter";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

import { MyVehiclesGrid } from "./my-vehicles-grid";
import { MyVehiclesTable } from "./my-vehicles-table";
import { UnassignedBanner } from "./unassigned-banner";

type Props = {
  instances: OwnedVehicleInstance[];
  ownedProperties: OwnedPropertyDetail[];
  tagLookup: Record<string, string>;
};

const VIEW_KEY = "my-vehicles:view";

export function MyVehiclesClient({ instances, ownedProperties, tagLookup }: Props) {
  // Union of every custom tag in the user's fleet — feeds the autocomplete in
  // the instance drawer so adding the same tag to multiple cars suggests itself.
  const tagSuggestions = useMemo(
    () =>
      Array.from(new Set(instances.flatMap((i) => i.custom_tags))).sort(),
    [instances],
  );
  const [view, setView] = useState<"cards" | "table">("cards");
  const [search, setSearch] = useState("");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "table" || v === "cards") setView(v);
  }, []);
  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  const filtered = instances.filter((i) => {
    if (unassignedOnly && i.storage) return false;
    if (selectedPropertyIds.length > 0 && (!i.storage || !selectedPropertyIds.includes(i.storage.owned_property_id))) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!i.display_name.toLowerCase().includes(q) && !(i.nickname ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const unassignedCount = instances.filter((i) => !i.storage).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">My Vehicles ({instances.length})</h1>
        <div className="flex flex-wrap gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search"
            className="w-48"
          />
          <LocationFilter
            properties={ownedProperties.map((p) => ({ id: p.id, display_name: p.display_name }))}
            selectedPropertyIds={selectedPropertyIds}
            unassignedOnly={unassignedOnly}
            onChange={({ properties, unassignedOnly }) => {
              setSelectedPropertyIds(properties);
              setUnassignedOnly(unassignedOnly);
            }}
          />
          <div className="flex rounded-md border">
            <Button
              size="sm"
              variant={view === "cards" ? "default" : "ghost"}
              onClick={() => setView("cards")}
            >▦ Cards</Button>
            <Button
              size="sm"
              variant={view === "table" ? "default" : "ghost"}
              onClick={() => setView("table")}
            >☰ Table</Button>
          </div>
        </div>
      </div>
      <UnassignedBanner count={unassignedCount} />
      {view === "cards" ? (
        <MyVehiclesGrid
          instances={filtered}
          ownedProperties={ownedProperties}
          tagLookup={tagLookup}
          tagSuggestions={tagSuggestions}
        />
      ) : (
        <MyVehiclesTable
          instances={filtered}
          ownedProperties={ownedProperties}
          tagSuggestions={tagSuggestions}
        />
      )}
    </div>
  );
}
