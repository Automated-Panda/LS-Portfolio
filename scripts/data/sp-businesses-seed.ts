import type { Property } from "../schema";

/**
 * Story-mode & narrative-tied businesses — 3 properties.
 *
 * These are properties closely associated with GTA V's single-player story
 * and are included in GT Vault with a "story-mode" narrative context.
 * In practice their purchasable versions exist as follows:
 *
 *   • Garment Factory (Darnell Bros) — GTA Online only (Agents of Sabotage,
 *     Dec 2024). In story mode it is Lester's factory used as the heist
 *     planning hub; it is never player-purchasable in SP.
 *     Price: $2,350,000 (GTA Online).
 *
 *   • Smoke on the Water — purchasable in GTA V Story Mode by Franklin
 *     for $204,000 (after Nervous Ron). Also re-appears as a GTA Online
 *     Money Fronts business ($850,000, June 2025).
 *     Seed here uses the story-mode instance ($204,000).
 *
 *   • Hands On Car Wash — GTA Online Money Fronts (June 2025), $1,000,000.
 *     The physical car wash building exists in the SP map but is not a
 *     purchasable property in story mode.
 *
 * All three are seeded with verify: true so the UI flags them for review.
 * Garment Factory has a 10-slot basement garage (counts_as_garage: true);
 * Smoke on the Water and Hands On Car Wash store no personal vehicles.
 * No purchasable upgrades exist for any of these properties; upgrades: [].
 *
 * Sources:
 *   https://www.gtabase.com/properties/gta-online/darnell-bros-garment-factory
 *   https://www.gtabase.com/grand-theft-auto-v/properties/story-mode/smoke-on-the-water
 *   https://www.gtabase.com/properties/gta-online/smoke-on-the-water
 *   https://www.gtabase.com/properties/gta-online/hands-on-car-wash
 *   https://gta.fandom.com/wiki/Garment_Factory
 *   https://gta.fandom.com/wiki/Smoke_on_the_Water_(business)
 *   https://gta.fandom.com/wiki/Hands_On_Car_Wash
 */

// ---------------------------------------------------------------------------
// Garment Factory (Darnell Bros)
// GTA Online — Agents of Sabotage update (December 2024)
// Lester's factory in SP story; purchasable in GTA Online at $2,350,000.
// ---------------------------------------------------------------------------
export const GARMENT_FACTORY_SEED: Omit<Property, "image_path">[] = [
  {
    id: "sp-garment-factory",
    display_name: "Garment Factory",
    property_type: "business",
    subtype: "garment-factory",
    subtype_display: "Garment Factory",
    location: "Popular Street, La Mesa",
    neighborhood: "La Mesa",
    // Agents of Sabotage added a basement garage with 10 vehicle slots
    // (two rows of 5 split by a brick wall).
    capacity: 10,
    counts_as_garage: true,
    price: 2350000,
    upgrades: [],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Garment_Factory",
      gtabase:
        "https://www.gtabase.com/properties/gta-online/darnell-bros-garment-factory",
    },
    verify: true,
  },
];

// ---------------------------------------------------------------------------
// Smoke on the Water
// Story Mode — purchasable by Franklin for $204,000 after Nervous Ron.
// Also appears as GTA Online Money Fronts ($850,000, June 2025).
// Seeded here as the SP instance.
// ---------------------------------------------------------------------------
export const SMOKE_ON_THE_WATER_SEED: Omit<Property, "image_path">[] = [
  {
    id: "sp-smoke-on-the-water",
    display_name: "Smoke on the Water",
    property_type: "business",
    subtype: "smoke-on-the-water",
    subtype_display: "Smoke On The Water",
    location: "Vespucci Beach Sidewalk, Vespucci Beach",
    neighborhood: "Vespucci Beach",
    capacity: 0,
    counts_as_garage: false,
    price: 204000,
    upgrades: [],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Smoke_on_the_Water_(business)",
      gtabase:
        "https://www.gtabase.com/grand-theft-auto-v/properties/story-mode/smoke-on-the-water",
    },
    verify: true,
  },
];

// ---------------------------------------------------------------------------
// Hands On Car Wash
// GTA Online — Money Fronts update (June 2025), $1,000,000.
// The building exists on the SP map but is not purchasable in story mode.
// ---------------------------------------------------------------------------
export const HANDS_ON_CAR_WASH_SEED: Omit<Property, "image_path">[] = [
  {
    id: "sp-hands-on-car-wash",
    display_name: "Hands On Car Wash",
    property_type: "business",
    subtype: "hands-on-car-wash",
    subtype_display: "Hands On Car Wash",
    location: "Innocence Boulevard, Strawberry",
    neighborhood: "Strawberry",
    capacity: 0,
    counts_as_garage: false,
    price: 1000000,
    upgrades: [],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Hands_On_Car_Wash",
      gtabase:
        "https://www.gtabase.com/properties/gta-online/hands-on-car-wash",
    },
    verify: true,
  },
];
