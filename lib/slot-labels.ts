// lib/slot-labels.ts
// Classifies an upgrade's `sub_slots` and derives display labels for numbered
// garage slots. Pure + side-effect free so it's unit-testable and shared between
// the property page, the My Vehicles grid, and the vehicle drawer.
//
// Three flavours of sub_slots exist in the catalog:
//   - "bay"       — vehicle-bound spots (Facility Khanjali, Arena Cerberus). See
//                   lib/bays.ts. Handled elsewhere; never relabelled here.
//   - "partition" — a plain, unconditional split of the upgrade capacity into
//                   labelled sections that sum to the capacity (CEO Office Level
//                   1 → 1A/1B/1C = 6/7/7). Rendered as ONE numbered grid whose
//                   slots carry the section code: 1A-1, 1B-2, …
//   - "flags"     — display tags layered on top of the plain 1..N grid (Mansion
//                   Garage → Driveway / Podium). The grid stays numbered; a car
//                   in any slot can be flagged. The bulk section (largest, e.g.
//                   "Garage") is "normal" and carries no flag.

import { isBayUpgrade, isVehicleBoundSlot } from "@/lib/bays";

export type SlotLayout = {
  label: string;
  capacity: number;
  required_upgrade_id?: string | null;
  vehicle_id?: string | null;
  vehicle_ids?: string[] | null;
};

export type SlotMode = "none" | "bay" | "partition" | "flags";

/**
 * A plain, unconditional partition of the upgrade capacity into labelled
 * sections: every section is unconditional (no required_upgrade_id) and not
 * vehicle-bound, and the capacities sum to the upgrade's capacity. CEO Office
 * garage levels qualify; mansions don't (the Podium section is gated by an
 * upgrade), and bays don't (vehicle-bound).
 */
export function isPartitionSlots(
  subSlots: SlotLayout[] | null | undefined,
  capacity: number,
): boolean {
  if (!subSlots?.length) return false;
  if (subSlots.some((s) => s.required_upgrade_id || isVehicleBoundSlot(s)))
    return false;
  const sum = subSlots.reduce((n, s) => n + s.capacity, 0);
  return sum === capacity;
}

/** Classify an upgrade's sub_slots. `capacity` is the upgrade's total capacity. */
export function slotMode(
  subSlots: SlotLayout[] | null | undefined,
  capacity: number,
): SlotMode {
  if (!subSlots?.length) return "none";
  if (isBayUpgrade(subSlots)) return "bay";
  if (isPartitionSlots(subSlots, capacity)) return "partition";
  return "flags";
}

/**
 * Label for a 1-based slot number within a partitioned area, e.g. slot 8 in
 * [1A:6, 1B:7, 1C:7] → "1B-2". Falls back to the bare number when the slot sits
 * outside the partition (shouldn't happen for a clean partition).
 */
export function partitionSlotLabel(
  subSlots: SlotLayout[],
  slotNumber: number,
): string {
  let acc = 0;
  for (const s of subSlots) {
    if (slotNumber <= acc + s.capacity) {
      return `${s.label}-${slotNumber - acc}`;
    }
    acc += s.capacity;
  }
  return String(slotNumber);
}

/**
 * A formatter for an area's numbered slots: section-coded labels for a
 * partitioned area (CEO offices), bare numbers for everything else. Pass the
 * result to GarageGrid / the slot badges so the label is consistent everywhere.
 */
export function slotLabeler(
  subSlots: SlotLayout[] | null | undefined,
  capacity: number,
): (n: number) => string {
  if (isPartitionSlots(subSlots, capacity)) {
    const layout = subSlots as SlotLayout[];
    return (n) => partitionSlotLabel(layout, n);
  }
  return (n) => String(n);
}

/**
 * The "flag" sections of a flags-mode area — every section except the bulk
 * (largest by capacity, e.g. the Mansion's 17-car "Garage"). Cars in the bulk
 * are normal and carry no badge; cars flagged into a returned section (Driveway,
 * Podium) do. Order is preserved.
 */
export function flagSections(subSlots: SlotLayout[]): SlotLayout[] {
  if (subSlots.length <= 1) return [];
  const maxCap = Math.max(...subSlots.map((s) => s.capacity));
  let droppedBulk = false;
  return subSlots.filter((s) => {
    if (!droppedBulk && s.capacity === maxCap) {
      droppedBulk = true; // drop only the first max-capacity section
      return false;
    }
    return true;
  });
}

/** Is this stored sub_slot value a display flag (Driveway/Podium) vs normal? */
export function isFlagSubSlot(
  subSlots: SlotLayout[] | null | undefined,
  subSlot: string | null | undefined,
): boolean {
  if (!subSlot || !subSlots?.length) return false;
  return flagSections(subSlots).some((s) => s.label === subSlot);
}
