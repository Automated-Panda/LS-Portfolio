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
  // MOC: one vehicle bay (any personal vehicle), gated by the Vehicle & Weapon
  // Workshop. Empty vehicleIds = unrestricted (capacity-checked, not bound).
  moc: [
    {
      label: "Vehicle Bay",
      vehicleIds: [],
      requiresUpgradeId: "moc-vehicle-weapon-workshop",
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

// ---------------------------------------------------------------------------
// Owned-container view derivation (pure; client-safe so it stays testable). The
// server query in lib/queries/container-vehicles.ts feeds DB rows into this.
// ---------------------------------------------------------------------------

export type ContainerSubSlot = {
  label: string;
  capacity: number;
  vehicle_id: string | null;
  vehicle_ids: string[] | null;
};

export type ContainerUpgradeView = {
  id: string;
  display_name: string;
  capacity: number;
  sub_slots: ContainerSubSlot[] | null;
  required_upgrade_id: string | null;
  mutex_group: string | null;
  included_on_purchase: boolean;
  price: number | null;
  sort_order: number;
  is_installed: boolean;
};

/** A storage bay exposed by an installed upgrade. */
export type ContainerBayView = {
  upgrade_id: string;
  label: string;
  capacity: number;
  /** Vehicle binding (single or set); null/empty = any vehicle. */
  vehicle_id: string | null;
  vehicle_ids: string[] | null;
};

export type RawContainerUpgrade = {
  id: string;
  display_name: string;
  capacity: number;
  sub_slots: ContainerSubSlot[] | null;
  required_upgrade_id: string | null;
  mutex_group: string | null;
  included_on_purchase: boolean | null;
  price: number | null;
  sort_order: number;
};

/**
 * Resolve a container's catalogue upgrade rows + the set of installed upgrade ids
 * into the sorted upgrade view + the bays exposed by installed upgrades.
 * included_on_purchase upgrades are always installed.
 */
export function deriveContainerView(
  rawUpgrades: RawContainerUpgrade[],
  installedUpgradeIds: Set<string>,
): { upgrades: ContainerUpgradeView[]; bays: ContainerBayView[] } {
  const upgrades: ContainerUpgradeView[] = rawUpgrades
    .map((u) => ({
      id: u.id,
      display_name: u.display_name,
      capacity: u.capacity,
      sub_slots: u.sub_slots ?? null,
      required_upgrade_id: u.required_upgrade_id ?? null,
      mutex_group: u.mutex_group ?? null,
      included_on_purchase: u.included_on_purchase ?? false,
      price: u.price ?? null,
      sort_order: u.sort_order,
      is_installed:
        installedUpgradeIds.has(u.id) || (u.included_on_purchase ?? false),
    }))
    .sort((a, b) => a.sort_order - b.sort_order);

  const bays: ContainerBayView[] = [];
  for (const u of upgrades) {
    if (!u.is_installed || !u.sub_slots) continue;
    for (const s of u.sub_slots) {
      bays.push({
        upgrade_id: u.id,
        label: s.label,
        capacity: s.capacity,
        vehicle_id: s.vehicle_id ?? null,
        vehicle_ids: s.vehicle_ids ?? null,
      });
    }
  }
  return { upgrades, bays };
}
