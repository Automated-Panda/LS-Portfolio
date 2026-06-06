// lib/organizer/planner.ts
// Deterministic chained-displacement planner. Pure function — same inputs
// always produce the same plan. No LLM involved here; the LLM's job ended
// once it produced a validated ParsedIntent.

import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

import { isBayBound } from "@/lib/bays";

import { vehicleMatches } from "./filter-vehicles";
import {
  type LocationKey,
  locationKey,
  parseLocationKey,
  slotsForProperty,
  totalFreeCapacity,
} from "./locations";
import type {
  ParsedIntent,
  PlanStep,
  PlanSummary,
  PlannerResult,
  VehicleFilter,
} from "./types";

export type PlannerInput = {
  intent: ParsedIntent;
  portfolio: {
    vehicles: OwnedVehicleInstance[];
    properties: OwnedPropertyDetail[];
  };
  manufacturerIdByDisplay: Map<string, string>;
};

type WorkingState = {
  vehicleLocation: Map<string, LocationKey | "unassigned">;
  occupancy: Map<LocationKey, number>;
  capacity: Map<LocationKey, number>;
  // Property id → ordered list of slot keys, largest-capacity first.
  slotsByProperty: Map<string, Array<{ key: LocationKey; capacity: number; label: string; upgradeId: string | null }>>;
  // Property + upgrade id → human label for step UI.
  slotLabels: Map<LocationKey, string>;
  steps: PlanStep[];
  stepIndex: number;
  conflicts: string[];
};

function buildState(input: PlannerInput): WorkingState {
  const state: WorkingState = {
    vehicleLocation: new Map(),
    occupancy: new Map(),
    capacity: new Map(),
    slotsByProperty: new Map(),
    slotLabels: new Map(),
    steps: [],
    stepIndex: 0,
    conflicts: [],
  };

  for (const p of input.portfolio.properties) {
    const slots = slotsForProperty(p).sort((a, b) => b.capacity - a.capacity);
    state.slotsByProperty.set(p.id, slots);
    for (const slot of slots) {
      state.capacity.set(slot.key, slot.capacity);
      state.occupancy.set(slot.key, 0);
      state.slotLabels.set(slot.key, slot.label);
    }
  }

  for (const v of input.portfolio.vehicles) {
    if (v.storage) {
      const key = locationKey(
        v.storage.owned_property_id,
        v.storage.assigned_upgrade_id,
      );
      state.vehicleLocation.set(v.id, key);
      state.occupancy.set(key, (state.occupancy.get(key) ?? 0) + 1);
    } else {
      state.vehicleLocation.set(v.id, "unassigned");
    }
  }

  return state;
}

function labelForSlot(state: WorkingState, key: LocationKey): string {
  return state.slotLabels.get(key) ?? key;
}

/** Free space at a specific slot. */
function freeAt(state: WorkingState, key: LocationKey): number {
  return (state.capacity.get(key) ?? 0) - (state.occupancy.get(key) ?? 0);
}

/** Find the best-fit-largest-free slot ANYWHERE in the portfolio (for displacement targets). */
function bestFitSlot(
  state: WorkingState,
  excludeKey?: LocationKey,
): LocationKey | null {
  let best: LocationKey | null = null;
  let bestFree = 0;
  for (const [key, cap] of state.capacity) {
    if (excludeKey && key === excludeKey) continue;
    const free = cap - (state.occupancy.get(key) ?? 0);
    if (free > bestFree) {
      best = key;
      bestFree = free;
    }
  }
  return best;
}

/** Pick which slot WITHIN a property to use for placement (largest free first; spill across). */
function pickPropertySlot(
  state: WorkingState,
  propertyId: string,
  preferredUpgradeId?: string,
): LocationKey | null {
  if (preferredUpgradeId) {
    const k = locationKey(propertyId, preferredUpgradeId);
    if (freeAt(state, k) > 0) return k;
    // Preferred slot full — try fallbacks within same property.
  }
  const slots = state.slotsByProperty.get(propertyId) ?? [];
  for (const slot of slots) {
    if (freeAt(state, slot.key) > 0) return slot.key;
  }
  return null;
}

function emitMove(
  state: WorkingState,
  vehicle: OwnedVehicleInstance,
  toKey: LocationKey,
  reason: "user-asked" | "displaced",
): void {
  const fromKey = state.vehicleLocation.get(vehicle.id);
  const fromParsed =
    fromKey && fromKey !== "unassigned" ? parseLocationKey(fromKey) : null;
  const toParsed = parseLocationKey(toKey);

  state.steps.push({
    index: state.stepIndex++,
    type: "move",
    owned_vehicle_id: vehicle.id,
    vehicle_label: vehicle.nickname ?? vehicle.display_name,
    from: {
      property_id: fromParsed?.propertyId ?? "",
      upgrade_id: fromParsed?.upgradeId ?? null,
      label:
        fromKey === "unassigned" || !fromKey
          ? "Unassigned"
          : labelForSlot(state, fromKey),
    },
    to: {
      property_id: toParsed.propertyId,
      upgrade_id: toParsed.upgradeId,
      label: labelForSlot(state, toKey),
    },
    reason,
    completed_at: null,
  });

  // Update state.
  if (fromKey && fromKey !== "unassigned") {
    state.occupancy.set(fromKey, (state.occupancy.get(fromKey) ?? 1) - 1);
  }
  state.occupancy.set(toKey, (state.occupancy.get(toKey) ?? 0) + 1);
  state.vehicleLocation.set(vehicle.id, toKey);
}

function emitUnassign(state: WorkingState, vehicle: OwnedVehicleInstance): void {
  const fromKey = state.vehicleLocation.get(vehicle.id);
  const fromParsed =
    fromKey && fromKey !== "unassigned" ? parseLocationKey(fromKey) : null;

  state.steps.push({
    index: state.stepIndex++,
    type: "unassign",
    owned_vehicle_id: vehicle.id,
    vehicle_label: vehicle.nickname ?? vehicle.display_name,
    from: {
      property_id: fromParsed?.propertyId ?? "",
      upgrade_id: fromParsed?.upgradeId ?? null,
      label:
        fromKey === "unassigned" || !fromKey
          ? "Unassigned"
          : labelForSlot(state, fromKey),
    },
    to: { property_id: null, upgrade_id: null, label: "Unassigned" },
    reason: "displaced",
    completed_at: null,
  });

  if (fromKey && fromKey !== "unassigned") {
    state.occupancy.set(fromKey, (state.occupancy.get(fromKey) ?? 1) - 1);
  }
  state.vehicleLocation.set(vehicle.id, "unassigned");
}

export function generatePlan(input: PlannerInput): PlannerResult {
  const state = buildState(input);
  const { intent, portfolio } = input;

  // Bay-bound weaponized vehicles (Khanjali, Cerberus…) live ONLY in their
  // dedicated bay — the planner must never move them to a normal garage nor
  // displace them. Treat them as untouchable: skip from matching, victim pools,
  // consolidation, and the capacity pre-flight (they don't use normal slots).
  const isBay = (v: OwnedVehicleInstance): boolean => isBayBound(v.vehicle_id);

  // Track which vehicles match ANY criterion (for displacement-victim selection).
  const allCriteriaUnion: VehicleFilter[] = intent.criteria.map((c) => c.filter);

  const matchesAnyCriterion = (v: OwnedVehicleInstance): boolean =>
    allCriteriaUnion.some((f) =>
      vehicleMatches(f, v, input.manufacturerIdByDisplay),
    );

  // Pre-flight: insufficient total capacity?
  // (Reference: keep totalFreeCapacity import in use even though the more
  // accurate check below is what gates the failure.)
  void totalFreeCapacity;

  const totalCapacity = Array.from(state.capacity.values()).reduce((a, b) => a + b, 0);
  // Bay-bound vehicles don't consume normal slots, so exclude them from the
  // "does everything fit?" check.
  const placeableCount = portfolio.vehicles.filter((v) => !isBay(v)).length;
  if (placeableCount > totalCapacity) {
    return {
      ok: false,
      failure: {
        reason: "insufficient-capacity",
        shortBy: placeableCount - totalCapacity,
      },
    };
  }

  // Validate every target's upgrade is installed (planner-level check; the
  // server already validated, this is defense in depth).
  for (const c of intent.criteria) {
    if (c.target.upgrade_id) {
      const k = locationKey(c.target.property_id, c.target.upgrade_id);
      if (!state.capacity.has(k)) {
        return {
          ok: false,
          failure: {
            reason: "target-not-built",
            missingUpgradeIds: [c.target.upgrade_id],
          },
        };
      }
    }
  }

  // Main loop: process criteria in order.
  for (const criterion of intent.criteria) {
    const matchingVehicles = portfolio.vehicles.filter(
      (v) =>
        !isBay(v) &&
        vehicleMatches(criterion.filter, v, input.manufacturerIdByDisplay),
    );

    for (const v of matchingVehicles) {
      // Skip if already at the target property (and, if upgrade specified, the target slot).
      const currentKey = state.vehicleLocation.get(v.id);
      if (currentKey && currentKey !== "unassigned") {
        const cur = parseLocationKey(currentKey);
        if (cur.propertyId === criterion.target.property_id) {
          if (
            !criterion.target.upgrade_id ||
            cur.upgradeId === criterion.target.upgrade_id
          ) {
            continue; // already where we want
          }
        }
      }

      // Find a slot at the target property.
      let toKey = pickPropertySlot(
        state,
        criterion.target.property_id,
        criterion.target.upgrade_id,
      );

      if (!toKey) {
        // Target full. Displace a victim.
        const targetSlots = state.slotsByProperty.get(criterion.target.property_id) ?? [];
        // Pick the slot with the most cars first (so we can find a victim).
        const slotToFreeFrom = targetSlots[0]?.key;
        if (!slotToFreeFrom) {
          // Property has zero slots — unrecoverable for this vehicle.
          emitUnassign(state, v);
          continue;
        }

        // Find a victim AT that slot, preferring vehicles not matching any
        // criterion. Bay-bound vehicles are never valid victims.
        const occupants = portfolio.vehicles.filter(
          (occ) =>
            !isBay(occ) &&
            state.vehicleLocation.get(occ.id) === slotToFreeFrom,
        );
        const nonMatchVictims = occupants.filter((o) => !matchesAnyCriterion(o));
        const matchVictims = occupants.filter((o) => matchesAnyCriterion(o));
        // Within each group, oldest created_at first (defensive: data may lack created_at — fall back to id order)
        const sortByOldest = (a: OwnedVehicleInstance, b: OwnedVehicleInstance) =>
          a.id.localeCompare(b.id);
        const victim =
          nonMatchVictims.sort(sortByOldest)[0] ??
          matchVictims.sort(sortByOldest)[0];

        if (!victim) {
          emitUnassign(state, v);
          continue;
        }

        // Find a new home for the victim.
        const victimDest = bestFitSlot(state, slotToFreeFrom);
        if (!victimDest) {
          // Nowhere for the victim — unassign them.
          emitUnassign(state, victim);
        } else {
          emitMove(state, victim, victimDest, "displaced");
        }

        // Now place the target vehicle.
        toKey = pickPropertySlot(
          state,
          criterion.target.property_id,
          criterion.target.upgrade_id,
        );
        if (!toKey) {
          // Still no room (e.g., victim left but slot is a specific upgrade that's still full).
          emitUnassign(state, v);
          continue;
        }
      }

      emitMove(state, v, toKey, "user-asked");
    }
  }

  // unmatched_handling = "consolidate-to-target" → take any still-unassigned
  // (or non-matched) vehicles and try to fit them in the LAST criterion's target.
  if (intent.unmatched_handling === "consolidate-to-target" && intent.criteria.length > 0) {
    const lastTarget = intent.criteria[intent.criteria.length - 1].target;
    const unmatched = portfolio.vehicles.filter(
      (v) => !isBay(v) && !matchesAnyCriterion(v),
    );
    for (const v of unmatched) {
      const currentKey = state.vehicleLocation.get(v.id);
      if (currentKey && currentKey !== "unassigned") {
        const cur = parseLocationKey(currentKey);
        if (cur.propertyId === lastTarget.property_id) continue;
      }
      const toKey = pickPropertySlot(state, lastTarget.property_id, lastTarget.upgrade_id);
      if (!toKey) break; // target full — stop trying
      emitMove(state, v, toKey, "user-asked");
    }
  }

  // Order steps: all displacements first, then placements (already mostly in this
  // order due to emit order, but explicit sort guarantees executability).
  state.steps.sort((a, b) => {
    if (a.reason === "displaced" && b.reason !== "displaced") return -1;
    if (a.reason !== "displaced" && b.reason === "displaced") return 1;
    return a.index - b.index;
  });
  // Re-index after sort.
  state.steps.forEach((s, i) => {
    s.index = i;
  });

  // Build summary.
  const carsMoved = state.steps.filter(
    (s) => s.type === "move" && s.reason === "user-asked",
  ).length;
  const carsUnassigned = state.steps.filter((s) => s.type === "unassign").length;
  const displacements = state.steps.filter(
    (s) => s.reason === "displaced" && s.type === "move",
  ).length;

  // Conflict notes: vehicles that matched multiple criteria.
  const multiMatch = portfolio.vehicles.filter((v) => {
    const matchCount = intent.criteria.filter((c) =>
      vehicleMatches(c.filter, v, input.manufacturerIdByDisplay),
    ).length;
    return matchCount > 1;
  });
  if (multiMatch.length > 0) {
    state.conflicts.push(
      `${multiMatch.length} vehicle(s) matched multiple criteria — used the first match for each.`,
    );
  }

  const summary: PlanSummary = {
    total_steps: state.steps.length,
    cars_moved: carsMoved,
    cars_unassigned: carsUnassigned,
    displacements,
    conflicts: state.conflicts,
  };

  return { ok: true, steps: state.steps, summary };
}
