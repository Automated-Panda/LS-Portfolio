// lib/organizer/locations.ts
// Helpers for working with "location slots" — the smallest unit a vehicle
// can be stored in. A location is either a property's base storage
// (upgrade_id=null) or one of its installed sub-garage upgrades.

import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import { isBayUpgrade } from "@/lib/bays";

/** Stable string key for a location slot. */
export type LocationKey = string;

export function locationKey(
  propertyId: string,
  upgradeId: string | null,
): LocationKey {
  return `${propertyId}:${upgradeId ?? "base"}`;
}

export function parseLocationKey(
  key: LocationKey,
): { propertyId: string; upgradeId: string | null } {
  const [propertyId, upgradePart] = key.split(":");
  return {
    propertyId,
    upgradeId: upgradePart === "base" ? null : upgradePart,
  };
}

/**
 * For a property: enumerate every storage slot it offers RIGHT NOW.
 * - If the property has installed sub-garages with capacity > 0, those are the slots.
 * - If the property has base capacity > 0 (and no installed sub-garages), the base is the slot.
 * - A property with no installed storage upgrades AND base_capacity=0 has zero slots.
 */
export function slotsForProperty(
  prop: OwnedPropertyDetail,
): Array<{ key: LocationKey; capacity: number; label: string; upgradeId: string | null }> {
  // Vehicle-bound bays (Facility weaponized bays, Arena large-vehicle bay) are
  // NOT general-purpose slots — the planner must never park a normal car there
  // or displace a bay-bound vehicle out of one. Exclude them from the universe.
  const installedStorageUpgrades = prop.upgrades.filter(
    (u) => u.is_installed && u.capacity > 0 && !isBayUpgrade(u.sub_slots),
  );

  if (installedStorageUpgrades.length > 0) {
    return installedStorageUpgrades.map((u) => ({
      key: locationKey(prop.id, u.id),
      capacity: u.capacity,
      label: `${prop.display_name} · ${u.display_name}`,
      upgradeId: u.id,
    }));
  }

  if (prop.base_capacity > 0) {
    return [
      {
        key: locationKey(prop.id, null),
        capacity: prop.base_capacity,
        label: prop.display_name,
        upgradeId: null,
      },
    ];
  }

  return [];
}

/** Total free slots across an entire portfolio. */
export function totalFreeCapacity(
  properties: OwnedPropertyDetail[],
  occupancy: Map<LocationKey, number>,
): number {
  let total = 0;
  for (const p of properties) {
    for (const slot of slotsForProperty(p)) {
      total += slot.capacity - (occupancy.get(slot.key) ?? 0);
    }
  }
  return total;
}
