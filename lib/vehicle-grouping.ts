// lib/vehicle-grouping.ts
// Pure grouping for the My Vehicles cards view. Given the owned instances and a
// grouping dimension, return ordered sections ready to render. Side-effect free
// and unit-tested. See app/(app)/my-vehicles.

import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";

export type GroupBy = "none" | "garage" | "manufacturer" | "class" | "model";

export type VehicleGroup = {
  key: string;
  label: string;
  /** Direct cards. Empty when `subgroups` is used (e.g. a multi-floor garage). */
  items: OwnedVehicleInstance[];
  /** Nested sections — used for per-floor breakdown within a multi-floor garage. */
  subgroups?: VehicleGroup[];
};

const NOT_STORED = "Not stored";
const UNKNOWN = "—";

/** Sort within a garage group: placed cars by slot asc, then unplaced, then by
 *  name — so a garage reads top-to-bottom like its numbered spots. */
function bySlotThenName(a: OwnedVehicleInstance, b: OwnedVehicleInstance): number {
  const sa = a.storage?.slot_number ?? Number.MAX_SAFE_INTEGER;
  const sb = b.storage?.slot_number ?? Number.MAX_SAFE_INTEGER;
  if (sa !== sb) return sa - sb;
  return name(a).localeCompare(name(b));
}

function name(i: OwnedVehicleInstance): string {
  return (i.nickname || i.display_name || "").toLowerCase();
}

function byName(a: OwnedVehicleInstance, b: OwnedVehicleInstance): number {
  return name(a).localeCompare(name(b));
}

/**
 * Group instances into ordered sections.
 *  - none: a single unlabelled group preserving input order.
 *  - garage: by property; cars ordered by slot; the "Not stored" group sinks last.
 *  - manufacturer / class: alphabetical; blanks ("—") last.
 *  - model: by display name, largest groups first (handy for the Duplicates view).
 */
export function groupInstances(
  instances: OwnedVehicleInstance[],
  groupBy: GroupBy,
): VehicleGroup[] {
  if (groupBy === "none") {
    return [{ key: "all", label: "", items: instances }];
  }

  const buckets = new Map<string, VehicleGroup>();
  const push = (key: string, label: string, item: OwnedVehicleInstance) => {
    const g = buckets.get(key) ?? { key, label, items: [] };
    g.items.push(item);
    buckets.set(key, g);
  };

  for (const i of instances) {
    switch (groupBy) {
      case "garage": {
        const label = i.storage?.property_display_name || NOT_STORED;
        push(label, label, i);
        break;
      }
      case "manufacturer": {
        const label = i.manufacturer_display || UNKNOWN;
        push(label, label, i);
        break;
      }
      case "class": {
        const label = i.class || UNKNOWN;
        push(label, label, i);
        break;
      }
      case "model": {
        push(i.vehicle_id, i.display_name || i.vehicle_id, i);
        break;
      }
    }
  }

  const groups = Array.from(buckets.values());

  // Order items within each group.
  for (const g of groups) {
    g.items.sort(groupBy === "garage" ? bySlotThenName : byName);
  }

  // Order the groups themselves.
  groups.sort((a, b) => {
    if (groupBy === "garage") {
      // "Not stored" always last; everything else alphabetical.
      if (a.label === NOT_STORED) return 1;
      if (b.label === NOT_STORED) return -1;
      return a.label.localeCompare(b.label);
    }
    if (groupBy === "model") {
      // Biggest clusters first (duplicates view), then alphabetical.
      if (a.items.length !== b.items.length) return b.items.length - a.items.length;
      return a.label.localeCompare(b.label);
    }
    // manufacturer / class: blanks last, else alphabetical.
    if (a.label === UNKNOWN) return 1;
    if (b.label === UNKNOWN) return -1;
    return a.label.localeCompare(b.label);
  });

  // Garage groups whose cars span 2+ storage areas (e.g. Vinewood / Eclipse
  // floors) break down into per-floor subgroups. Single-area garages stay flat.
  if (groupBy === "garage") {
    for (const g of groups) {
      if (g.label === NOT_STORED) continue;
      const areas = new Map<string, VehicleGroup>();
      for (const i of g.items) {
        const areaKey = i.storage?.assigned_upgrade_id ?? "base";
        const areaLabel = i.storage?.upgrade_display_name || "Base storage";
        const sg =
          areas.get(areaKey) ??
          ({ key: `${g.key}::${areaKey}`, label: areaLabel, items: [] } as VehicleGroup);
        sg.items.push(i);
        areas.set(areaKey, sg);
      }
      if (areas.size < 2) continue;
      const subgroups = Array.from(areas.values());
      for (const sg of subgroups) sg.items.sort(bySlotThenName);
      subgroups.sort((a, b) => {
        if (a.label === "Base storage") return -1;
        if (b.label === "Base storage") return 1;
        return a.label.localeCompare(b.label, undefined, { numeric: true });
      });
      g.subgroups = subgroups;
      g.items = [];
    }
  }

  return groups;
}
