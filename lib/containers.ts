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
  terrorbyte: [{ label: "Oppressor Mk II", vehicleIds: ["oppressor2"] }],
  kosatka: [
    { label: "Sparrow", vehicleIds: ["sparrow"] }, // TODO confirm Sparrow id (Phase 1b)
    { label: "Kraken Avisa", vehicleIds: ["avisa"] },
  ],
  brickade2: [{ label: "Acid Bike", vehicleIds: ["manchez2"] }],
  // MOC id is a Phase 1b catalogue addition; bay gated by its Vehicle Workshop.
  moc: [
    {
      label: "Vehicle Bay",
      vehicleIds: [], // empty = any vehicle (class-checked in UI); refine in 1b
      requiresUpgradeId: "moc-vehicle-workshop",
    },
  ],
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
