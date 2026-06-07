// Pegasus / special-storage classification helpers. A vehicle needs "special"
// storage if it's a Pegasus vehicle (tag) OR a bay-bound vehicle (lib/bays.ts).
// Such a vehicle is summon-only until the user owns somewhere it can live
// (aircraft → hangar, Khanjali → a Facility bay). These helpers decide, per
// instance + owned properties, whether it's currently summon-only vs
// assignable. Client-safe (type-only imports).

import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import { assetCategoryOf, propertyAcceptsVehicleCategory } from "@/lib/vehicles";
import { bayBinding, bayPropertyLabel, isBayBound } from "@/lib/bays";
import { isContainerVehicle } from "@/lib/containers";
import { isSummonOnlyVehicle } from "@/lib/pegasus-storage";

export const PEGASUS_TAG_ID = "pegasus";

export function isPegasus(tagIds: string[]): boolean {
  return tagIds.includes(PEGASUS_TAG_ID);
}

type StorageProp = Pick<OwnedPropertyDetail, "counts_as_garage" | "subtype">;
type VehicleBits = Pick<
  OwnedVehicleInstance,
  "vehicle_id" | "tag_ids" | "class" | "storage" | "nested_in"
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
    return ownedProperties.some((p) => bay.subtypes.includes(p.subtype));
  }
  const cat = assetCategoryOf(vehicle.class);
  return ownedProperties.some((p) => propertyAcceptsVehicleCategory(p, cat));
}

/** A genuinely summon-only vehicle: BROAD Pegasus (jets/helis you can legitimately
 *  own without a hangar), unstored, with nowhere ownable to live. Bay-bound
 *  weaponized vehicles are deliberately excluded — owning one implies owning its
 *  Facility/Arena in-game, so a missing bay property is an inconsistency we nag
 *  about (see needsBayProperty), not a valid "summon" state. */
export function isSummonOnly(
  instance: VehicleBits,
  ownedProperties: StorageProp[],
): boolean {
  // Already stored (in a property or nested in a container) → not summon-only.
  if (instance.storage || instance.nested_in) return false;
  // Curated: vehicles with no personal storage anywhere are ALWAYS summon-only,
  // regardless of which properties the user owns (fixes Pegasus-only land
  // vehicles wrongly counted as "needs a home"). See lib/pegasus-storage.ts.
  if (isSummonOnlyVehicle(instance.vehicle_id)) return true;
  // Broad Pegasus that COULD be stored (aircraft → hangar) but has no compatible
  // property yet.
  return (
    isPegasus(instance.tag_ids) &&
    !isBayBound(instance.vehicle_id) &&
    !hasCompatibleStorage(instance, ownedProperties)
  );
}

/** A bay-bound weaponized vehicle (Khanjali, Cerberus…) that is unstored AND
 *  whose bay property the user doesn't own. In GTA you must own the Facility /
 *  Arena to buy it, so this state is impossible in-game — we surface it as a
 *  nudge to add the missing property. Returns the property's label, or null. */
export function needsBayProperty(
  instance: VehicleBits,
  ownedProperties: StorageProp[],
): { label: string } | null {
  if (!isBayBound(instance.vehicle_id) || instance.storage || instance.nested_in)
    return null;
  if (hasCompatibleStorage(instance, ownedProperties)) return null; // owns the bay already
  const label = bayPropertyLabel(instance.vehicle_id);
  return label ? { label } : null;
}

/** Should this vehicle count as "unassigned / needs attention"? Unstored, but
 *  NOT a summon-only Pegasus (there's nowhere to assign those). Bay-bound
 *  vehicles DO count — either they need parking in their owned bay or they need
 *  the bay property added. */
export function isUnassignedNagworthy(
  instance: VehicleBits,
  ownedProperties: StorageProp[],
): boolean {
  return (
    !instance.storage &&
    !instance.nested_in && // nested inside a container vehicle = stored
    !isContainerVehicle(instance.vehicle_id) && // containers don't need a garage
    !isSummonOnly(instance, ownedProperties)
  );
}
