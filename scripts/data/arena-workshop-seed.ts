import type { Property } from "../schema";

/**
 * GTA Online Arena Workshop — Arena War update (Dec 2018).
 * A single purchasable workshop beneath the Maze Bank Arena, used to build and
 * upgrade Arena War vehicles. Comes with a default 10-car garage; two optional
 * garage floors add 10 each (30 personal vehicles total).
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Arena_Workshop
 *   https://www.gtabase.com/grand-theft-auto-v/guides/property-types/arena-war-workshop
 */
const ID = "arena-workshop";

export const ARENA_WORKSHOP_SEED: Omit<Property, "image_path">[] = [
  {
    id: ID,
    display_name: "Arena Workshop",
    property_type: "business",
    subtype: "arena-workshop",
    subtype_display: "Arena Workshop",
    location: "Maze Bank Arena, La Puerta",
    neighborhood: "La Puerta",
    // The default ground-floor garage (10 cars) is included with the workshop.
    capacity: 10,
    counts_as_garage: true,
    price: 995000,
    upgrades: [
      // ── Garage floors ────────────────────────────────────────────────────
      {
        id: `${ID}-garage-b1`,
        display_name: "Garage Floor B1",
        tier: 1,
        capacity: 10,
        required_upgrade_id: null,
        notes: "Adds a second 10-car garage floor.",
        price: 195000,
      },
      {
        id: `${ID}-garage-b2`,
        display_name: "Garage Floor B2",
        tier: 2,
        capacity: 10,
        required_upgrade_id: null,
        notes: "Adds a third 10-car garage floor (30 personal vehicles total).",
        price: 265000,
      },
      // ── Office styles (mutually exclusive) ───────────────────────────────
      {
        id: `${ID}-style-business`,
        display_name: "Style: Business",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Default office style (free).",
        price: 0,
        mutex_group: `${ID}-style`,
      },
      {
        id: `${ID}-style-modern`,
        display_name: "Style: Modern",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Alternate office style.",
        price: 180000,
        mutex_group: `${ID}-style`,
      },
      {
        id: `${ID}-style-urbane`,
        display_name: "Style: Urbane",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Alternate office style.",
        price: 265000,
        mutex_group: `${ID}-style`,
      },
      // ── Amenities & staff ────────────────────────────────────────────────
      {
        id: `${ID}-personal-quarters`,
        display_name: "Personal Quarters",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Living quarters; adds a spawn point at the workshop.",
        price: 220000,
      },
      {
        id: `${ID}-bennys-mechanic`,
        display_name: "Benny's O.M.W. Mechanic",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Guest mechanic enabling Benny's lowrider modifications.",
        price: 247500,
      },
      {
        id: `${ID}-weapons-expert`,
        display_name: "Weapons Expert",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Enables weaponized-vehicle and weapon upgrades.",
        price: 727500,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Arena_Workshop",
      gtabase:
        "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/arena-war-workshop",
    },
  },
];
