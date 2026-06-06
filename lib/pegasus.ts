// Pegasus / special-storage classification helpers. A vehicle needs "special"
// storage if it's a Pegasus vehicle (tag) OR a bay-bound vehicle (lib/bays.ts).
// Such a vehicle is summon-only until the user owns somewhere it can live
// (aircraft → hangar, Khanjali → a Facility bay). These helpers decide, per
// instance + owned properties, whether it's currently summon-only vs
// assignable. Client-safe (type-only imports).

import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import { assetCategoryOf, storageAssetCategory } from "@/lib/vehicles";
import { bayBinding, isBayBound } from "@/lib/bays";

export const PEGASUS_TAG_ID = "pegasus";

export function isPegasus(tagIds: string[]): boolean {
  return tagIds.includes(PEGASUS_TAG_ID);
}

type StorageProp = Pick<OwnedPropertyDetail, "counts_as_garage" | "subtype">;
type VehicleBits = Pick<
  OwnedVehicleInstance,
  "vehicle_id" | "tag_ids" | "class" | "storage"
>;

/** A vehicle that needs non-garage / dedicated storage — Pegasus or bay-bound. */
export function isSpecialStorage(
  vehicle: Pick<OwnedVehicleInstance, "vehicle_id" | "tag_ids">,
): boolean {
  return isPegasus(vehicle.tag_ids) || isBayBound(vehicle.vehicle_id);
}

/** Does the user own any property that can store this vehicle? Bay-bound
 *  vehicles need a property of their bay's subtype (e.g. a Facility); everything
 *  else needs a garage matching its asset category (aircraft → hangar, …). */
export function hasCompatibleStorage(
  vehicle: Pick<OwnedVehicleInstance, "vehicle_id" | "class">,
  ownedProperties: StorageProp[],
): boolean {
  const bay = bayBinding(vehicle.vehicle_id);
  if (bay) {
    return ownedProperties.some((p) => p.subtype === bay.subtype);
  }
  const cat = assetCategoryOf(vehicle.class);
  return ownedProperties.some(
    (p) => p.counts_as_garage && storageAssetCategory(p.subtype) === cat,
  );
}

/** A special vehicle that is unstored AND has nowhere ownable to live —
 *  i.e. genuinely summon-only right now. */
export function isSummonOnly(
  instance: VehicleBits,
  ownedProperties: StorageProp[],
): boolean {
  return (
    isSpecialStorage(instance) &&
    !instance.storage &&
    !hasCompatibleStorage(instance, ownedProperties)
  );
}

/** Should this vehicle count as "unassigned / needs attention"? Unstored, but
 *  NOT a summon-only special vehicle (there's nowhere to assign those). */
export function isUnassignedNagworthy(
  instance: VehicleBits,
  ownedProperties: StorageProp[],
): boolean {
  return !instance.storage && !isSummonOnly(instance, ownedProperties);
}
