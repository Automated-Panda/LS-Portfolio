import type { Property } from "../schema";

/**
 * Hand-curated GTA Online property list with upgrade capacities.
 * Upgrade tiers model separately-purchased levels (e.g. Nightclub garage floors).
 * `counts_as_garage` distinguishes personal-vehicle garages from portfolio-only
 * properties like hangars, facilities, and bunkers. Capacity figures reflect
 * in-game values per Fandom/gtabase as of Online 1.72.
 */
export const PROPERTIES_SEED: Omit<Property, "image_path">[] = [
  {
    id: "high-end-apartment",
    display_name: "High-End Apartment",
    property_type: "residence",
    location: "Various",
    counts_as_garage: true,
    upgrades: [
      {
        id: "high-end-apartment-garage",
        display_name: "10-Car Garage",
        tier: null,
        capacity: 10,
        required_upgrade_id: null,
        notes: null,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Apartments",
      gtabase: "https://www.gtabase.com/gta-online/property-types/",
    },
  },
  {
    id: "stand-alone-garage",
    display_name: "Stand-Alone Garage",
    property_type: "garage",
    location: "Various",
    counts_as_garage: true,
    upgrades: [
      {
        id: "stand-alone-garage-small",
        display_name: "2-Car Garage",
        tier: 1,
        capacity: 2,
        required_upgrade_id: null,
        notes: null,
      },
      {
        id: "stand-alone-garage-medium",
        display_name: "6-Car Garage",
        tier: 2,
        capacity: 6,
        required_upgrade_id: null,
        notes: null,
      },
      {
        id: "stand-alone-garage-large",
        display_name: "10-Car Garage",
        tier: 3,
        capacity: 10,
        required_upgrade_id: null,
        notes: null,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Garage_(GTA_Online)",
      gtabase: null,
    },
  },
  {
    id: "eclipse-blvd-garages",
    display_name: "Eclipse Blvd Garages",
    property_type: "garage",
    location: "Eclipse Boulevard, Vinewood",
    counts_as_garage: true,
    upgrades: [
      {
        id: "eclipse-blvd-garages-all",
        display_name: "50-Car Garage",
        tier: null,
        capacity: 50,
        required_upgrade_id: null,
        notes: "Available as single purchase with all floors",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Eclipse_Boulevard_Garages",
      gtabase: null,
    },
  },
  {
    id: "office-garage",
    display_name: "Office Garage",
    property_type: "garage",
    location: "CEO Office Extension",
    counts_as_garage: true,
    upgrades: [
      {
        id: "office-garage-floor-1",
        display_name: "Garage Level 1",
        tier: 1,
        capacity: 20,
        required_upgrade_id: null,
        notes: null,
      },
      {
        id: "office-garage-floor-2",
        display_name: "Garage Level 2",
        tier: 2,
        capacity: 20,
        required_upgrade_id: "office-garage-floor-1",
        notes: null,
      },
      {
        id: "office-garage-floor-3",
        display_name: "Garage Level 3",
        tier: 3,
        capacity: 20,
        required_upgrade_id: "office-garage-floor-2",
        notes: null,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Executive_Offices",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/executive-offices",
    },
  },
  {
    id: "nightclub",
    display_name: "Nightclub",
    property_type: "business",
    location: "Various",
    counts_as_garage: true,
    upgrades: [
      {
        id: "nightclub-garage-1",
        display_name: "Garage Level 1",
        tier: 1,
        capacity: 10,
        required_upgrade_id: null,
        notes: null,
      },
      {
        id: "nightclub-garage-2",
        display_name: "Garage Level 2",
        tier: 2,
        capacity: 10,
        required_upgrade_id: "nightclub-garage-1",
        notes: null,
      },
      {
        id: "nightclub-garage-3",
        display_name: "Garage Level 3",
        tier: 3,
        capacity: 11,
        required_upgrade_id: "nightclub-garage-2",
        notes: "Includes the MTL Pounder Custom slot",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Nightclubs",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/nightclubs",
    },
  },
  {
    id: "facility",
    display_name: "Facility",
    property_type: "business",
    location: "Various",
    counts_as_garage: false,
    upgrades: [
      {
        id: "facility-garage",
        display_name: "Facility Garage",
        tier: null,
        capacity: 7,
        required_upgrade_id: null,
        notes: "Stores Avenger, MOC, TM-02 Khanjali, RCV, and other Doomsday vehicles",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Facility",
      gtabase: null,
    },
  },
  {
    id: "arena-workshop",
    display_name: "Arena Workshop",
    property_type: "business",
    location: "Maze Bank Arena",
    counts_as_garage: true,
    upgrades: [
      {
        id: "arena-workshop-garage",
        display_name: "Workshop Garage",
        tier: null,
        capacity: 30,
        required_upgrade_id: null,
        notes: null,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Arena_Workshop",
      gtabase: null,
    },
  },
  {
    id: "agency",
    display_name: "The Agency",
    property_type: "business",
    location: "Various",
    counts_as_garage: true,
    upgrades: [
      {
        id: "agency-garage",
        display_name: "Agency Garage",
        tier: null,
        capacity: 20,
        required_upgrade_id: null,
        notes: null,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Agencies",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/the-agency",
    },
  },
  {
    id: "arcade",
    display_name: "Arcade",
    property_type: "business",
    location: "Various",
    counts_as_garage: true,
    upgrades: [
      {
        id: "arcade-garage",
        display_name: "Arcade Garage",
        tier: null,
        capacity: 10,
        required_upgrade_id: null,
        notes: null,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Arcades",
      gtabase: null,
    },
  },
  {
    id: "auto-shop",
    display_name: "Auto Shop",
    property_type: "business",
    location: "Various",
    counts_as_garage: true,
    upgrades: [
      {
        id: "auto-shop-garage",
        display_name: "Auto Shop Garage",
        tier: null,
        capacity: 10,
        required_upgrade_id: null,
        notes: null,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Auto_Shop",
      gtabase: null,
    },
  },
  {
    id: "casino-penthouse",
    display_name: "Casino Penthouse",
    property_type: "residence",
    location: "Diamond Casino & Resort",
    counts_as_garage: true,
    upgrades: [
      {
        id: "casino-penthouse-garage",
        display_name: "Penthouse Garage",
        tier: null,
        capacity: 10,
        required_upgrade_id: null,
        notes: null,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Master_Penthouse",
      gtabase: null,
    },
  },
  {
    id: "hangar",
    display_name: "Hangar",
    property_type: "business",
    location: "LSIA or Fort Zancudo",
    counts_as_garage: false,
    upgrades: [
      {
        id: "hangar-all",
        display_name: "Hangar Storage",
        tier: null,
        capacity: 20,
        required_upgrade_id: null,
        notes: "Stores planes and helicopters, not garage vehicles",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Hangar",
      gtabase: null,
    },
  },
  {
    id: "bunker",
    display_name: "Bunker",
    property_type: "business",
    location: "Blaine County",
    counts_as_garage: false,
    upgrades: [
      {
        id: "bunker-personal-quarters",
        display_name: "Personal Quarters",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Does not store personal vehicles directly",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Bunker",
      gtabase: null,
    },
  },
  {
    id: "salvage-yard",
    display_name: "Salvage Yard",
    property_type: "business",
    location: "Various",
    counts_as_garage: false,
    upgrades: [
      {
        id: "salvage-yard-tow-truck",
        display_name: "Tow Truck Bay",
        tier: null,
        capacity: 1,
        required_upgrade_id: null,
        notes: "Stores the Salvage Yard tow truck",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Salvage_Yard",
      gtabase: null,
    },
  },
  {
    id: "clubhouse",
    display_name: "Clubhouse",
    property_type: "business",
    location: "Various",
    counts_as_garage: true,
    upgrades: [
      {
        id: "clubhouse-garage",
        display_name: "Clubhouse Garage",
        tier: null,
        capacity: 10,
        required_upgrade_id: null,
        notes: "Motorcycle-only storage",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Clubhouses",
      gtabase: null,
    },
  },
];
