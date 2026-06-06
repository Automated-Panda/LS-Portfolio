// lib/arena-bay.ts
// The Arena Workshop's "Large Vehicle Bay" (the Cerberus spots) has exactly one
// large spot per installed garage floor: the ground floor (always) plus the two
// optional, paid basement floors (B1, B2). So its capacity is 1..3 depending on
// what the user has installed — not a flat 3. Mirrors the lib/hangar-boost.ts
// dynamic-capacity pattern. Pure + client-safe.

export const ARENA_PROPERTY_ID = "arena-workshop";
export const ARENA_LARGE_BAY_UPGRADE_ID = "arena-workshop-large-bay";

/** The two optional basement floors; each adds one large-vehicle spot. */
export const ARENA_FLOOR_UPGRADE_IDS = [
  "arena-workshop-garage-b1",
  "arena-workshop-garage-b2",
] as const;

/**
 * Large-vehicle-bay capacity = 1 (ground floor, always present) + one per
 * installed basement floor. `installedUpgradeIds` is the set of property_upgrade
 * ids the user has installed on their Arena Workshop.
 */
export function arenaLargeBayCapacity(
  installedUpgradeIds: Iterable<string>,
): number {
  const set = new Set(installedUpgradeIds);
  return 1 + ARENA_FLOOR_UPGRADE_IDS.filter((id) => set.has(id)).length;
}
