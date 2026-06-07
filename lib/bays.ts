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

// A vehicle pinned to a dedicated bay. `subtypes` lists every property subtype
// whose bay can hold it — usually one, but some vehicles have more than one
// valid home (the Terrorbyte fits a Nightclub OR a Garment Factory).
export type BayBinding = { subtypes: string[]; label: string };

export const BAY_BOUND_VEHICLES: Record<string, BayBinding> = {
  // Facility (single-vehicle bays)
  avenger: { subtypes: ["facility"], label: "Avenger" },
  thruster: { subtypes: ["facility"], label: "Thruster" },
  khanjali: { subtypes: ["facility"], label: "Khanjali" },
  chernobog: { subtypes: ["facility"], label: "Chernobog" },
  riot2: { subtypes: ["facility"], label: "RCV" },
  // Arena Workshop "large vehicle" spot (Cerberus family)
  cerberus: { subtypes: ["arena-workshop"], label: "Large Vehicle" },
  cerberus2: { subtypes: ["arena-workshop"], label: "Large Vehicle" },
  cerberus3: { subtypes: ["arena-workshop"], label: "Large Vehicle" },
  // Container vehicles parked at their business HQ. Their bays are seeded on the
  // host properties in migration 0044 (MOC → Bunker, Terrorbyte → Nightclub /
  // Garment Factory). They still work as containers wherever they're parked.
  moc: { subtypes: ["bunker"], label: "Mobile Operations Center" },
  terbyte: {
    subtypes: ["nightclub", "garment-factory"],
    label: "Terrorbyte",
  },
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
  bunker: "Bunker",
  nightclub: "Nightclub",
  "garment-factory": "Garment Factory",
};

/** The property name(s) a bay-bound vehicle needs — e.g. "Facility", or
 *  "Nightclub or Garment Factory" when more than one subtype fits. Null when
 *  the vehicle isn't bay-bound. */
export function bayPropertyLabel(vehicleId: string): string | null {
  const b = bayBinding(vehicleId);
  if (!b) return null;
  return b.subtypes.map((s) => BAY_PROPERTY_LABEL[s] ?? s).join(" or ");
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
