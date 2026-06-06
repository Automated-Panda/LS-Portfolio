// lib/pegasus-storage.ts
// Curated storage classification for Pegasus vehicles, so the "N vehicles need a
// home" nag never counts a vehicle that has nowhere to live. Researched against
// the GTA Wiki (Pegasus Lifestyle Management + Hangars). Three buckets:
//
//  1. PEGASUS-ONLY (no personal storage anywhere) → ALWAYS summon-only, never
//     nagged. This is SUMMON_ONLY_VEHICLE_IDS below: every non-aircraft Pegasus
//     vehicle (boats, military, utility, service, vans, limos, industrial,
//     commercial, off-road, emergency) PLUS the Blimp (the one aircraft that
//     can't be stored in a Hangar).
//
//  2. PEGASUS + STORABLE → the Pegasus *aircraft* (planes & helicopters, except
//     the Blimp). These become assignable once you own a Hangar, so they are NOT
//     listed here — the normal hasCompatibleStorage(aircraft → hangar) logic in
//     lib/pegasus.ts handles them (summon until you own a hangar, then nagged if
//     unstored). Examples: Hydra, P-996 Lazer, Savage, Buzzard, Luxor, Titan,
//     Annihilator, Valkyrie, Volatus, Besra, Cuban 800, Duster, Mammatus, …
//
//  3. NOT PEGASUS → normal garage/hangar/yacht vehicles. Unaffected here.
//
// Maintenance: if Rockstar makes a former-Pegasus vehicle storable (or vice
// versa), move its id in/out of the set below.

/**
 * Pegasus vehicles with NO personal storage in the game — they can only ever be
 * summoned, so they must never appear in "needs a home" regardless of which
 * properties the user owns.
 */
export const SUMMON_ONLY_VEHICLE_IDS = new Set<string>([
  // Boats (no personal boat storage modelled; Pegasus-delivered)
  "submersible2", // Kraken
  "patrolboat", // Kurtz 31 Patrol Boat
  "longfin",
  "marquis",
  "predator", // Police Predator
  "seashark",
  "suntrap",
  "toro",
  "tropic",
  "dinghy5", // Weaponized Dinghy
  // Commercial
  "benson2", // Benson (Cluckin' Bell)
  "stockade4", // Bobcat Security Stockade
  "mule",
  "stockade",
  // Emergency
  "riot", // Police Riot
  "pbus", // Prison Bus
  // Industrial
  "bulldozer", // Dozer
  "dump",
  "mixer",
  // Military
  "barracks",
  "barracks2", // Barracks Semi
  "crusader",
  "rhino", // Rhino Tank
  "vetir",
  // Off-road
  "insurgent", // Insurgent Pick-Up (plain — the Custom lives in an MOC/Facility)
  "marshall",
  "dune2", // Space Docker
  "technical",
  // Sedan (limos — Pegasus, not garage-storable)
  "stretch",
  "limo2", // Turreted Limo
  // Service
  "airbus", // Airport Bus
  "brickade", // plain Brickade (the Acid Lab is brickade2, a container)
  "coach", // Dashound
  "rallytruck", // Dune
  "pbus2", // Festival Bus
  "rentalbus", // Rental Shuttle Bus
  "trash", // Trashmaster
  // Utility
  "tractor",
  // Van
  "boxville6", // Boxville (LSDS)
  "speedo2", // Clown Van
  "journey",
  "taco", // Taco Van
  // Aircraft exception — the Blimp is Pegasus-only (cannot be stored in a Hangar)
  "blimp3",
]);

/** True when a vehicle has no personal storage anywhere (always summon-only). */
export function isSummonOnlyVehicle(vehicleId: string): boolean {
  return SUMMON_ONLY_VEHICLE_IDS.has(vehicleId);
}
