// Vehicles that live ONLY in a dedicated, vehicle-bound bay in a specific
// property subtype — e.g. the Facility's Avenger / Thruster / Khanjali /
// Chernobog / RCV bays (migration 0036). They can't go in normal garages and
// are summon-only until you own a property whose bay fits them.
//
// The bays themselves are property_upgrade `sub_slots` carrying a `vehicle_id`.
// This map is the catalog-level reverse lookup so the client can reason about a
// vehicle without scanning every property. Keep it in sync with the bay
// sub_slots seeded in migrations.

export type BayBinding = { subtype: string; label: string };

export const BAY_BOUND_VEHICLES: Record<string, BayBinding> = {
  avenger: { subtype: "facility", label: "Avenger" },
  thruster: { subtype: "facility", label: "Thruster" },
  khanjali: { subtype: "facility", label: "Khanjali" },
  chernobog: { subtype: "facility", label: "Chernobog" },
  riot2: { subtype: "facility", label: "RCV" },
};

export function isBayBound(vehicleId: string): boolean {
  return vehicleId in BAY_BOUND_VEHICLES;
}

export function bayBinding(vehicleId: string): BayBinding | null {
  return BAY_BOUND_VEHICLES[vehicleId] ?? null;
}

/** True when an upgrade's sub_slots are vehicle-bound bays (carry a vehicle_id). */
export function isBayUpgrade(
  subSlots: Array<{ vehicle_id?: string | null }> | null | undefined,
): boolean {
  return !!subSlots?.some((s) => s.vehicle_id);
}
