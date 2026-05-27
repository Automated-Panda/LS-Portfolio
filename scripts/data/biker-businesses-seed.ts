import type { Property } from "../schema";

/**
 * GTA Online Biker MC Businesses — 5 types × 4 purchasable locations = 20 total.
 * Each MC business runs through the Clubhouse's "The Open Road" laptop.
 * Businesses do NOT store personal vehicles (counts_as_garage: false).
 * Each gets the same three production upgrades: Equipment / Staff / Security.
 *
 * Sources:
 *   https://gta.fandom.com/wiki/The_Open_Road
 *   https://www.gtabase.com/grand-theft-auto-v/guides/property-types/mc-businesses
 */

type LocationSeed = {
  id: string;
  display_name: string;
  neighborhood: string;
  address: string;
  verify?: boolean;
};

function buildMcBusiness(
  loc: LocationSeed,
  subtype: string,
  subtype_display: string,
  fandom: string,
): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype,
    subtype_display,
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0,
    counts_as_garage: false,
    upgrades: [
      {
        id: `${loc.id}-equipment`,
        display_name: "Equipment Upgrade",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Increases production speed and product value.",
      },
      {
        id: `${loc.id}-staff`,
        display_name: "Staff Upgrade",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Increases production efficiency and quality.",
      },
      {
        id: `${loc.id}-security`,
        display_name: "Security Upgrade",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Reduces raid frequency.",
      },
    ],
    _sources: {
      fandom,
      gtabase:
        "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/mc-businesses",
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

// ---------------------------------------------------------------------------
// COCAINE LOCKUPS — 4 locations
// ---------------------------------------------------------------------------

const COKE_LOCATIONS: LocationSeed[] = [
  {
    id: "biker-business-coke-alamo-sea",
    display_name: "Alamo Sea Cocaine Lockup",
    neighborhood: "Alamo Sea",
    address: "Alamo Sea, Blaine County",
  },
  {
    id: "biker-business-coke-elysian-island",
    display_name: "Elysian Island Cocaine Lockup",
    neighborhood: "Elysian Island",
    address: "Elysian Island, Los Santos",
  },
  {
    id: "biker-business-coke-morningwood",
    display_name: "Morningwood Cocaine Lockup",
    neighborhood: "Morningwood",
    address: "Morningwood, Los Santos",
  },
  {
    id: "biker-business-coke-paleto-bay",
    display_name: "Paleto Bay Cocaine Lockup",
    neighborhood: "Paleto Bay",
    address: "Paleto Bay, Blaine County",
  },
];

export const COKE_BUSINESSES: Omit<Property, "image_path">[] =
  COKE_LOCATIONS.map((l) =>
    buildMcBusiness(
      l,
      "biker-business-coke",
      "Cocaine Lockup",
      "https://gta.fandom.com/wiki/Cocaine_Lockup",
    ),
  );

// ---------------------------------------------------------------------------
// METH LABS — 4 locations
// ---------------------------------------------------------------------------

const METH_LOCATIONS: LocationSeed[] = [
  {
    id: "biker-business-meth-el-burro-heights",
    display_name: "El Burro Heights Meth Lab",
    neighborhood: "El Burro Heights",
    address: "El Burro Heights, Los Santos",
  },
  {
    id: "biker-business-meth-grand-senora-desert",
    display_name: "Grand Senora Desert Meth Lab",
    neighborhood: "Grand Senora Desert",
    address: "Grand Senora Desert, Blaine County",
  },
  {
    id: "biker-business-meth-paleto-bay",
    display_name: "Paleto Bay Meth Lab",
    neighborhood: "Paleto Bay",
    address: "Paleto Bay, Blaine County",
  },
  {
    id: "biker-business-meth-terminal",
    display_name: "Terminal Meth Lab",
    neighborhood: "Terminal",
    address: "Terminal, Los Santos",
  },
];

export const METH_BUSINESSES: Omit<Property, "image_path">[] =
  METH_LOCATIONS.map((l) =>
    buildMcBusiness(
      l,
      "biker-business-meth",
      "Meth Lab",
      "https://gta.fandom.com/wiki/Methamphetamine_Lab",
    ),
  );

// ---------------------------------------------------------------------------
// WEED FARMS — 4 locations
// ---------------------------------------------------------------------------

const WEED_LOCATIONS: LocationSeed[] = [
  {
    id: "biker-business-weed-vinewood-downtown",
    display_name: "Downtown Vinewood Weed Farm",
    neighborhood: "Downtown Vinewood",
    address: "Downtown Vinewood, Los Santos",
  },
  {
    id: "biker-business-weed-elysian-island",
    display_name: "Elysian Island Weed Farm",
    neighborhood: "Elysian Island",
    address: "Elysian Island, Los Santos",
  },
  {
    id: "biker-business-weed-mount-chiliad",
    display_name: "Mount Chiliad Weed Farm",
    neighborhood: "Mount Chiliad",
    address: "Mount Chiliad, Blaine County",
  },
  {
    id: "biker-business-weed-san-chianski",
    display_name: "San Chianski Weed Farm",
    neighborhood: "San Chianski Mountain Range",
    address: "San Chianski Mountain Range, Blaine County",
  },
];

export const WEED_BUSINESSES: Omit<Property, "image_path">[] =
  WEED_LOCATIONS.map((l) =>
    buildMcBusiness(
      l,
      "biker-business-weed",
      "Weed Farm",
      "https://gta.fandom.com/wiki/Weed_Farm",
    ),
  );

// ---------------------------------------------------------------------------
// COUNTERFEIT CASH FACTORIES — 4 locations
// ---------------------------------------------------------------------------

const CASH_LOCATIONS: LocationSeed[] = [
  {
    id: "biker-business-cash-cypress-flats",
    display_name: "Cypress Flats Counterfeit Cash",
    neighborhood: "Cypress Flats",
    address: "Cypress Flats, Los Santos",
  },
  {
    id: "biker-business-cash-grand-senora-desert",
    display_name: "Grand Senora Desert Counterfeit Cash",
    neighborhood: "Grand Senora Desert",
    address: "Grand Senora Desert, Blaine County",
  },
  {
    id: "biker-business-cash-paleto-bay",
    display_name: "Paleto Bay Counterfeit Cash",
    neighborhood: "Paleto Bay",
    address: "Paleto Bay, Blaine County",
  },
  {
    id: "biker-business-cash-vespucci-canals",
    display_name: "Vespucci Canals Counterfeit Cash",
    neighborhood: "Vespucci Canals",
    address: "Vespucci Canals, Los Santos",
  },
];

export const CASH_BUSINESSES: Omit<Property, "image_path">[] =
  CASH_LOCATIONS.map((l) =>
    buildMcBusiness(
      l,
      "biker-business-cash",
      "Counterfeit Cash Factory",
      "https://gta.fandom.com/wiki/Counterfeit_Cash_Factory",
    ),
  );

// ---------------------------------------------------------------------------
// DOCUMENT FORGERY OFFICES — 4 locations
// ---------------------------------------------------------------------------

const FORGERY_LOCATIONS: LocationSeed[] = [
  {
    id: "biker-business-forgery-elysian-island",
    display_name: "Elysian Island Document Forgery",
    neighborhood: "Elysian Island",
    address: "Elysian Island, Los Santos",
  },
  {
    id: "biker-business-forgery-grapeseed",
    display_name: "Grapeseed Document Forgery",
    neighborhood: "Grapeseed",
    address: "Grapeseed, Blaine County",
  },
  {
    id: "biker-business-forgery-paleto-bay",
    display_name: "Paleto Bay Document Forgery",
    neighborhood: "Paleto Bay",
    address: "Paleto Bay, Blaine County",
  },
  {
    id: "biker-business-forgery-textile-city",
    display_name: "Textile City Document Forgery",
    neighborhood: "Textile City",
    address: "Textile City, Los Santos",
  },
];

export const FORGERY_BUSINESSES: Omit<Property, "image_path">[] =
  FORGERY_LOCATIONS.map((l) =>
    buildMcBusiness(
      l,
      "biker-business-forgery",
      "Document Forgery Office",
      "https://gta.fandom.com/wiki/Document_Forgery_Office",
    ),
  );
