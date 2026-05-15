import type { Property } from "../schema";
import { NIGHTCLUBS_SEED } from "./nightclubs-seed";

/**
 * Phase 4b granular property seed. Each row is a single in-game
 * property instance (specific location), not a type-level archetype.
 *
 * Pilot scope: Nightclubs only (10 rows × 6 upgrades = 60 upgrade rows).
 * Apartments, garages, bunkers, offices, MC clubhouses, businesses,
 * vehicle warehouses, arcades, auto shops, agencies, salvage yards,
 * facilities, hangars, yachts, and biker businesses follow in
 * subsequent sessions.
 */
export const PROPERTIES_SEED: Omit<Property, "image_path">[] = [
  ...NIGHTCLUBS_SEED,
];
