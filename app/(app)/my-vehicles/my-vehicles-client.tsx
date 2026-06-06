"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomTagFilter } from "@/components/portfolio/custom-tag-filter";
import { LocationFilter, type LocationOption } from "@/components/portfolio/location-filter";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import { isPegasus, isSummonOnlyPegasus, isUnassignedNagworthy } from "@/lib/pegasus";

import { MyVehiclesGrid } from "./my-vehicles-grid";
import { MyVehiclesTable } from "./my-vehicles-table";
import { UnassignedBanner } from "./unassigned-banner";

type Props = {
  instances: OwnedVehicleInstance[];
  ownedProperties: OwnedPropertyDetail[];
  tagLookup: Record<string, string>;
  initialUnassignedOnly: boolean;
  initialDuplicatesOnly: boolean;
};

const VIEW_KEY = "my-vehicles:view";

export function MyVehiclesClient({
  instances,
  ownedProperties,
  tagLookup,
  initialUnassignedOnly,
  initialDuplicatesOnly,
}: Props) {
  const router = useRouter();

  const tagSuggestions = useMemo(
    () =>
      Array.from(new Set(instances.flatMap((i) => i.custom_tags))).sort(),
    [instances],
  );
  const [view, setView] = useState<"cards" | "table">("cards");
  const [search, setSearch] = useState("");
  const [selectedLocations, setSelectedLocations] = useState<string[]>([]);
  const [unassignedOnly, setUnassignedOnly] = useState(initialUnassignedOnly);
  const [favouritesOnly, setFavouritesOnly] = useState(false);
  const [duplicatesOnly, setDuplicatesOnly] = useState(initialDuplicatesOnly);
  const [pegasusOnly, setPegasusOnly] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const pegasusCount = useMemo(
    () => instances.filter((i) => isPegasus(i.tag_ids)).length,
    [instances],
  );

  // vehicle_ids the user owns 2+ of — the "duplicates" set.
  const duplicateVehicleIds = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of instances) {
      counts.set(i.vehicle_id, (counts.get(i.vehicle_id) ?? 0) + 1);
    }
    return new Set(
      Array.from(counts.entries())
        .filter(([, n]) => n >= 2)
        .map(([id]) => id),
    );
  }, [instances]);
  const favouritesCount = useMemo(
    () => instances.filter((i) => i.is_favourite).length,
    [instances],
  );
  const duplicatesCount = useMemo(
    () => instances.filter((i) => duplicateVehicleIds.has(i.vehicle_id)).length,
    [instances, duplicateVehicleIds],
  );

  // Location filter tree: garage-capable properties (or any with a stored
  // vehicle), each with the occupied levels within it (shown only when its
  // cars span 2+ distinct levels — upgrade/floor and/or sub-slot).
  const locations = useMemo<LocationOption[]>(() => {
    type Entry = {
      count: number;
      levels: Map<string, { key: string; label: string; count: number }>;
    };
    const byProp = new Map<string, Entry>();
    for (const i of instances) {
      if (!i.storage) continue;
      const pid = i.storage.owned_property_id;
      const entry = byProp.get(pid) ?? { count: 0, levels: new Map() };
      entry.count += 1;
      const key = `lvl:${pid}::${i.storage.assigned_upgrade_id ?? "base"}::${i.storage.sub_slot ?? ""}`;
      const label =
        [i.storage.upgrade_display_name, i.storage.sub_slot]
          .filter(Boolean)
          .join(" · ") || "Base storage";
      const lvl = entry.levels.get(key) ?? { key, label, count: 0 };
      lvl.count += 1;
      entry.levels.set(key, lvl);
      byProp.set(pid, entry);
    }
    const hasStorage = (p: OwnedPropertyDetail) =>
      p.base_capacity > 0 ||
      p.upgrades.some((u) => u.is_installed && u.capacity > 0);
    const shown = new Set<string>();
    for (const p of ownedProperties) if (hasStorage(p)) shown.add(p.id);
    for (const pid of byProp.keys()) shown.add(pid);
    const nameById = new Map(ownedProperties.map((p) => [p.id, p.display_name]));
    return Array.from(shown)
      .map((pid) => {
        const entry = byProp.get(pid);
        const levels =
          entry && entry.levels.size >= 2
            ? Array.from(entry.levels.values()).sort((a, b) =>
                a.label.localeCompare(b.label),
              )
            : [];
        return {
          propertyId: pid,
          propertyName: nameById.get(pid) ?? "Unknown",
          count: entry?.count ?? 0,
          levels,
        };
      })
      .sort((a, b) => a.propertyName.localeCompare(b.propertyName));
  }, [instances, ownedProperties]);

  useEffect(() => {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "table" || v === "cards") setView(v);
  }, []);
  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  // Sync ?unassigned=1 with state. Read window.location.search (not the
  // searchParams hook) and guard with an equality check — otherwise the
  // searchParams reference churn from router.replace would re-fire this
  // effect forever.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const had = params.get("unassigned") === "1";
    if (had === unassignedOnly) return;
    if (unassignedOnly) {
      params.set("unassigned", "1");
    } else {
      params.delete("unassigned");
    }
    const qs = params.toString();
    router.replace(qs ? `/my-vehicles?${qs}` : "/my-vehicles", {
      scroll: false,
    });
  }, [unassignedOnly, router]);

  // Sync ?duplicates=1 with state (mirrors the unassigned sync above) so the
  // dashboard stat can deep-link straight into the filtered view.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const had = params.get("duplicates") === "1";
    if (had === duplicatesOnly) return;
    if (duplicatesOnly) {
      params.set("duplicates", "1");
    } else {
      params.delete("duplicates");
    }
    const qs = params.toString();
    router.replace(qs ? `/my-vehicles?${qs}` : "/my-vehicles", {
      scroll: false,
    });
  }, [duplicatesOnly, router]);

  const filtered = instances.filter((i) => {
    // "Unassigned only" hides stored vehicles AND summon-only Pegasus (there's
    // nowhere to assign those, so they aren't really "unassigned").
    if (unassignedOnly && (i.storage || isSummonOnlyPegasus(i, ownedProperties)))
      return false;
    if (pegasusOnly && !isPegasus(i.tag_ids)) return false;
    if (favouritesOnly && !i.is_favourite) return false;
    if (duplicatesOnly && !duplicateVehicleIds.has(i.vehicle_id)) return false;
    if (selectedLocations.length > 0) {
      if (!i.storage) return false;
      const pid = i.storage.owned_property_id;
      const propKey = `prop:${pid}`;
      const lvlKey = `lvl:${pid}::${i.storage.assigned_upgrade_id ?? "base"}::${i.storage.sub_slot ?? ""}`;
      if (!selectedLocations.includes(propKey) && !selectedLocations.includes(lvlKey)) {
        return false;
      }
    }
    if (selectedTags.length > 0) {
      // AND match — instance must carry every selected custom_tag.
      const owned = new Set(i.custom_tags);
      if (!selectedTags.every((t) => owned.has(t))) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!i.display_name.toLowerCase().includes(q) && !(i.nickname ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Summon-only Pegasus vehicles aren't really "unassigned" — exclude them so
  // the banner/count only nags about vehicles you can actually store.
  const unassignedCount = instances.filter((i) =>
    isUnassignedNagworthy(i, ownedProperties),
  ).length;

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
            locations={locations}
            selected={selectedLocations}
            unassignedOnly={unassignedOnly}
            onChange={({ selected, unassignedOnly }) => {
              setSelectedLocations(selected);
              setUnassignedOnly(unassignedOnly);
            }}
          />
          <CustomTagFilter
            tags={tagSuggestions}
            selectedTags={selectedTags}
            onChange={setSelectedTags}
          />
          {favouritesCount > 0 && (
            <Button
              size="sm"
              variant={favouritesOnly ? "default" : "outline"}
              onClick={() => setFavouritesOnly((v) => !v)}
              aria-pressed={favouritesOnly}
            >
              ⭐ Favourites ({favouritesCount})
            </Button>
          )}
          {duplicatesCount > 0 && (
            <Button
              size="sm"
              variant={duplicatesOnly ? "default" : "outline"}
              onClick={() => setDuplicatesOnly((v) => !v)}
              aria-pressed={duplicatesOnly}
            >
              👯 Duplicates ({duplicatesCount})
            </Button>
          )}
          {pegasusCount > 0 && (
            <Button
              size="sm"
              variant={pegasusOnly ? "default" : "outline"}
              onClick={() => setPegasusOnly((v) => !v)}
              aria-pressed={pegasusOnly}
            >
              ✈️ Pegasus ({pegasusCount})
            </Button>
          )}
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
