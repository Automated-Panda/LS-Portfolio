// Vehicles that live ONLY in a dedicated bay in a specific property subtype —
// e.g. the Facility's Avenger/Thruster/Khanjali/Chernobog/RCV bays (single
// vehicle each, migration 0036) and the Arena Workshop's "large vehicle" spot
// (the Cerberus family, migration 0037). They can't go in normal garages and
// are summon-only until you own a property whose bay fits them.
//
// The bays are property_upgrade `sub_slots` carrying either a single `vehicle_id`
// or a `vehicle_ids` set. This map is the catalog-level reverse lookup so the
// client can reason about a vehicle without scanning every property. Keep it in
// sync with the bay sub_slots seeded in migrations.

export type BayBinding = { subtype: string; label: string };

export const BAY_BOUND_VEHICLES: Record<string, BayBinding> = {
  // Facility (single-vehicle bays)
  avenger: { subtype: "facility", label: "Avenger" },
  thruster: { subtype: "facility", label: "Thruster" },
  khanjali: { subtype: "facility", label: "Khanjali" },
  chernobog: { subtype: "facility", label: "Chernobog" },
  riot2: { subtype: "facility", label: "RCV" },
  // Arena Workshop "large vehicle" spot (Cerberus family)
  cerberus: { subtype: "arena-workshop", label: "Large Vehicle" },
  cerberus2: { subtype: "arena-workshop", label: "Large Vehicle" },
  cerberus3: { subtype: "arena-workshop", label: "Large Vehicle" },
};

export function isBayBound(vehicleId: string): boolean {
  return vehicleId in BAY_BOUND_VEHICLES;
}

export function bayBinding(vehicleId: string): BayBinding | null {
  return BAY_BOUND_VEHICLES[vehicleId] ?? null;
}

/** Human-readable property name for a bay subtype (for prompts/badges). */
export const BAY_PROPERTY_LABEL: Record<string, string> = {
  facility: "Facility",
  "arena-workshop": "Arena Workshop",
};

/** The property name a bay-bound vehicle needs (e.g. "Facility"), or null. */
export function bayPropertyLabel(vehicleId: string): string | null {
  const b = bayBinding(vehicleId);
  if (!b) return null;
  return BAY_PROPERTY_LABEL[b.subtype] ?? b.subtype;
}

type SlotBinding = { vehicle_id?: string | null; vehicle_ids?: string[] | null };

/** Is this sub-slot a vehicle-bound bay (single or family)? */
export function isVehicleBoundSlot(slot: SlotBinding): boolean {
  return !!slot.vehicle_id || !!slot.vehicle_ids?.length;
}

/** Does this vehicle-bound bay accept the given vehicle? */
export function slotAcceptsVehicle(slot: SlotBinding, vehicleId: string): boolean {
  if (slot.vehicle_id) return slot.vehicle_id === vehicleId;
  if (slot.vehicle_ids?.length) return slot.vehicle_ids.includes(vehicleId);
  return false;
}

/** All vehicle ids a bay sub-slot can hold (for restricting the add picker). */
export function slotVehicleIds(slot: SlotBinding): string[] {
  if (slot.vehicle_id) return [slot.vehicle_id];
  return slot.vehicle_ids ?? [];
}

/** True when an upgrade's sub_slots include any vehicle-bound bay. */
export function isBayUpgrade(
  subSlots: SlotBinding[] | null | undefined,
): boolean {
  return !!subSlots?.some(isVehicleBoundSlot);
}
