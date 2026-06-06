// Pegasus classification helpers. A "Pegasus" vehicle (tagged from the game's
// "Vehicles requested via Pegasus Lifestyle Management" category) is summoned
// rather than garaged by default — BUT some (aircraft) become assignable once
// the user owns a compatible property (a hangar). These helpers decide, per
// instance + the user's owned properties, whether it's currently summon-only
// vs assignable. Client-safe (type-only imports).

import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import { assetCategoryOf, storageAssetCategory } from "@/lib/vehicles";

export const PEGASUS_TAG_ID = "pegasus";

export function isPegasus(tagIds: string[]): boolean {
  return tagIds.includes(PEGASUS_TAG_ID);
}

type StorageProp = Pick<OwnedPropertyDetail, "counts_as_garage" | "subtype">;
type VehicleBits = Pick<OwnedVehicleInstance, "tag_ids" | "class" | "storage">;

/** Does the user own any property that can store this vehicle's category
 *  (e.g. an aircraft + a hangar)? */
export function hasCompatibleStorage(
  vehicleClass: string,
  ownedProperties: StorageProp[],
): boolean {
  const cat = assetCategoryOf(vehicleClass);
  return ownedProperties.some(
    (p) => p.counts_as_garage && storageAssetCategory(p.subtype) === cat,
  );
}

/** A Pegasus vehicle that is unstored AND has nowhere ownable to live —
 *  i.e. genuinely summon-only right now. */
export function isSummonOnlyPegasus(
  instance: VehicleBits,
  ownedProperties: StorageProp[],
): boolean {
  return (
    isPegasus(instance.tag_ids) &&
    !instance.storage &&
    !hasCompatibleStorage(instance.class, ownedProperties)
  );
}

/** Should this vehicle count as "unassigned / needs attention"? Unstored, but
 *  NOT a summon-only Pegasus (there's nowhere to assign those, so don't nag). */
export function isUnassignedNagworthy(
  instance: VehicleBits,
  ownedProperties: StorageProp[],
): boolean {
  return !instance.storage && !isSummonOnlyPegasus(instance, ownedProperties);
}
