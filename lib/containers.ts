// lib/containers.ts
// Catalogue map of "container vehicles" — vehicles that store other vehicles
// (Terrorbyte/MOC/Kosatka/Acid Lab). Client-safe, mirrors lib/bays.ts. The
// authoritative storage capacity/gating lives in the vehicle_upgrades table;
// this map is the client-side reverse lookup for reasoning without a DB call.
// Keep in sync with the catalogue seeded in Phase 1b.

export type ContainerBay = {
  label: string;
  /** Vehicle id(s) this bay accepts. Empty = any vehicle (class-checked in UI). */
  vehicleIds: string[];
  /** If set, the bay only exists when this vehicle_upgrade is installed
   *  (e.g. the MOC Vehicle Workshop). Omitted = always available. */
  requiresUpgradeId?: string;
};

export const CONTAINER_VEHICLES: Record<string, ContainerBay[]> = {
  // Terrorbyte: the Oppressor Mk II bay only exists with the Specialized Workshop.
  terbyte: [
    {
      label: "Oppressor Mk II",
      vehicleIds: ["oppressor2"],
      requiresUpgradeId: "terbyte-specialized-workshop",
    },
  ],
  // Kosatka moon pool (included): the Sparrow heli + the Kraken Avisa mini-sub.
  kosatka: [
    { label: "Sparrow", vehicleIds: ["seasparrow2"] },
    { label: "Kraken Avisa", vehicleIds: ["avisa"] },
  ],
  // Acid Lab (Brickade 6x6): the Manchez Scout C acid bike (included).
  brickade2: [{ label: "Acid Bike", vehicleIds: ["manchez2"] }],
  // MOC is a follow-up — it needs a catalogue vehicle row first (Phase 1b-MOC),
  // then its Vehicle Workshop-gated bays go here.
};

export function isContainerVehicle(vehicleId: string): boolean {
  return vehicleId in CONTAINER_VEHICLES;
}

export function containerBays(vehicleId: string): ContainerBay[] {
  return CONTAINER_VEHICLES[vehicleId] ?? [];
}

/** Which container + bay stores the given vehicle id, or null. */
export function bayForStoredVehicle(
  vehicleId: string,
): { containerVehicleId: string; bay: ContainerBay } | null {
  for (const [containerVehicleId, bays] of Object.entries(CONTAINER_VEHICLES)) {
    const bay = bays.find((b) => b.vehicleIds.includes(vehicleId));
    if (bay) return { containerVehicleId, bay };
  }
  return null;
}
