// lib/organizer/filter-vehicles.ts
// Decide whether an owned vehicle matches a VehicleFilter (one criterion's
// targeting). All filter fields are OR-within-field and AND-across-fields:
//
//   tags: ["drift"]                    → has tag "drift"
//   tags: ["drift", "hsw"]             → has tag "drift" OR "hsw"
//   tags: ["drift"], classes: ["Super"] → has tag "drift" AND class "Super"

import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";

import type { VehicleFilter } from "./types";

export function vehicleMatches(
  filter: VehicleFilter,
  vehicle: OwnedVehicleInstance,
  /** Manufacturer id lookup so we can match by id even though OwnedVehicleInstance only carries display. */
  manufacturerIdByDisplay: Map<string, string>,
): boolean {
  // Empty filter matches everything — defensive, but useful for "leave everything".
  const hasAny =
    (filter.tags?.length ?? 0) > 0 ||
    (filter.custom_tags?.length ?? 0) > 0 ||
    (filter.classes?.length ?? 0) > 0 ||
    (filter.manufacturers?.length ?? 0) > 0 ||
    filter.favourites === true;
  if (!hasAny) return false;

  // Favourites is a boolean constraint (AND-across like the rest): when set to
  // true, the vehicle must be ⭐ favourited. false/undefined = no constraint.
  if (filter.favourites === true && !vehicle.is_favourite) return false;

  if (filter.tags && filter.tags.length > 0) {
    const hasMatch = filter.tags.some((t) => vehicle.tag_ids.includes(t));
    if (!hasMatch) return false;
  }

  if (filter.custom_tags && filter.custom_tags.length > 0) {
    const hasMatch = filter.custom_tags.some((t) =>
      vehicle.custom_tags.includes(t),
    );
    if (!hasMatch) return false;
  }

  if (filter.classes && filter.classes.length > 0) {
    if (!filter.classes.includes(vehicle.class)) return false;
  }

  if (filter.manufacturers && filter.manufacturers.length > 0) {
    const mfrId = manufacturerIdByDisplay.get(vehicle.manufacturer_display);
    if (!mfrId || !filter.manufacturers.includes(mfrId)) return false;
  }

  return true;
}
