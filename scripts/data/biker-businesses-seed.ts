import type { Property } from "../schema";

/**
 * GTA Online Biker Businesses — 5 business types, ~6 locations each.
 * All instances share the same 3-upgrade pattern (Equipment, Staff, Security).
 * None store ground vehicles (counts_as_garage: false).
 *
 * Location data sourced from Fandom wikis; all flagged verify:true as
 * exact street names / neighborhoods are difficult to confirm without
 * live page access.
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Cocaine_Lockup
 *   https://gta.fandom.com/wiki/Methamphetamine_Lab
 *   https://gta.fandom.com/wiki/Weed_Farm
 *   https://gta.fandom.com/wiki/Counterfeit_Cash_Factory
 *   https://gta.fandom.com/wiki/Document_Forgery_Office
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type BikerBizSeed = {
  id: string;
  display_name: string;
  neighborhood: string;
  address: string;
  verify?: boolean;
};

type SubtypeMeta = {
  subtype: string;
  subtype_display: string;
  fandom_url: string;
};

function buildBikerBusiness(
  loc: BikerBizSeed,
  meta: SubtypeMeta
): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype: meta.subtype,
    subtype_display: meta.subtype_display,
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
        notes: "Increases production speed",
      },
      {
        id: `${loc.id}-staff`,
        display_name: "Staff Upgrade",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Increases production quality",
      },
      {
        id: `${loc.id}-security`,
        display_name: "Security Upgrade",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Reduces raid frequency",
      },
    ],
    _sources: {
      fandom: meta.fandom_url,
      gtabase: null,
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

// ---------------------------------------------------------------------------
// Cocaine Lockup
// ---------------------------------------------------------------------------

const COKE_META: SubtypeMeta = {
  subtype: "biker-business-coke",
  subtype_display: "Cocaine Lockup",
  fandom_url: "https://gta.fandom.com/wiki/Cocaine_Lockup",
};

const COKE_LOCATIONS: BikerBizSeed[] = [
  {
    id: "biker-business-coke-alamo-sea",
    display_name: "Alamo Sea Cocaine Lockup",
    neighborhood: "Alamo Sea",
    address: "Alamo Sea, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-coke-grand-senora",
    display_name: "Grand Senora Desert Cocaine Lockup",
    neighborhood: "Grand Senora Desert",
    address: "Grand Senora Desert, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-coke-paleto-bay",
    display_name: "Paleto Bay Cocaine Lockup",
    neighborhood: "Paleto Bay",
    address: "Paleto Bay, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-coke-san-chianski",
    display_name: "San Chianski Mountain Range Cocaine Lockup",
    neighborhood: "San Chianski Mountain Range",
    address: "San Chianski Mountain Range, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-coke-elysian-island",
    display_name: "Elysian Island Cocaine Lockup",
    neighborhood: "Elysian Island",
    address: "Elysian Island, Los Santos",
    verify: true,
  },
  {
    id: "biker-business-coke-terminal",
    display_name: "Terminal Cocaine Lockup",
    neighborhood: "Terminal",
    address: "Terminal, Los Santos",
    verify: true,
  },
];

export const COKE_BUSINESSES: Omit<Property, "image_path">[] =
  COKE_LOCATIONS.map((loc) => buildBikerBusiness(loc, COKE_META));

// ---------------------------------------------------------------------------
// Methamphetamine Lab
// ---------------------------------------------------------------------------

const METH_META: SubtypeMeta = {
  subtype: "biker-business-meth",
  subtype_display: "Meth Lab",
  fandom_url: "https://gta.fandom.com/wiki/Methamphetamine_Lab",
};

const METH_LOCATIONS: BikerBizSeed[] = [
  {
    id: "biker-business-meth-alamo-sea",
    display_name: "Alamo Sea Meth Lab",
    neighborhood: "Alamo Sea",
    address: "Alamo Sea, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-meth-grapeseed",
    display_name: "Grapeseed Meth Lab",
    neighborhood: "Grapeseed",
    address: "Grapeseed, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-meth-paleto-bay",
    display_name: "Paleto Bay Meth Lab",
    neighborhood: "Paleto Bay",
    address: "Paleto Bay, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-meth-route-68",
    display_name: "Route 68 Meth Lab",
    neighborhood: "Route 68",
    address: "Route 68, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-meth-cypress-flats",
    display_name: "Cypress Flats Meth Lab",
    neighborhood: "Cypress Flats",
    address: "Cypress Flats, Los Santos",
    verify: true,
  },
  {
    id: "biker-business-meth-elysian-island",
    display_name: "Elysian Island Meth Lab",
    neighborhood: "Elysian Island",
    address: "Elysian Island, Los Santos",
    verify: true,
  },
];

export const METH_BUSINESSES: Omit<Property, "image_path">[] =
  METH_LOCATIONS.map((loc) => buildBikerBusiness(loc, METH_META));

// ---------------------------------------------------------------------------
// Weed Farm
// ---------------------------------------------------------------------------

const WEED_META: SubtypeMeta = {
  subtype: "biker-business-weed",
  subtype_display: "Weed Farm",
  fandom_url: "https://gta.fandom.com/wiki/Weed_Farm",
};

const WEED_LOCATIONS: BikerBizSeed[] = [
  {
    id: "biker-business-weed-alamo-sea",
    display_name: "Alamo Sea Weed Farm",
    neighborhood: "Alamo Sea",
    address: "Alamo Sea, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-weed-grapeseed",
    display_name: "Grapeseed Weed Farm",
    neighborhood: "Grapeseed",
    address: "Grapeseed, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-weed-grand-senora",
    display_name: "Grand Senora Desert Weed Farm",
    neighborhood: "Grand Senora Desert",
    address: "Grand Senora Desert, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-weed-paleto-bay",
    display_name: "Paleto Bay Weed Farm",
    neighborhood: "Paleto Bay",
    address: "Paleto Bay, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-weed-sandy-shores",
    display_name: "Sandy Shores Weed Farm",
    neighborhood: "Sandy Shores",
    address: "Sandy Shores, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-weed-cypress-flats",
    display_name: "Cypress Flats Weed Farm",
    neighborhood: "Cypress Flats",
    address: "Cypress Flats, Los Santos",
    verify: true,
  },
];

export const WEED_BUSINESSES: Omit<Property, "image_path">[] =
  WEED_LOCATIONS.map((loc) => buildBikerBusiness(loc, WEED_META));

// ---------------------------------------------------------------------------
// Counterfeit Cash Factory
// ---------------------------------------------------------------------------

const CASH_META: SubtypeMeta = {
  subtype: "biker-business-cash",
  subtype_display: "Counterfeit Cash Factory",
  fandom_url: "https://gta.fandom.com/wiki/Counterfeit_Cash_Factory",
};

const CASH_LOCATIONS: BikerBizSeed[] = [
  {
    id: "biker-business-cash-alamo-sea",
    display_name: "Alamo Sea Counterfeit Cash Factory",
    neighborhood: "Alamo Sea",
    address: "Alamo Sea, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-cash-grand-senora",
    display_name: "Grand Senora Desert Counterfeit Cash Factory",
    neighborhood: "Grand Senora Desert",
    address: "Grand Senora Desert, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-cash-paleto-bay",
    display_name: "Paleto Bay Counterfeit Cash Factory",
    neighborhood: "Paleto Bay",
    address: "Paleto Bay, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-cash-route-68",
    display_name: "Route 68 Counterfeit Cash Factory",
    neighborhood: "Route 68",
    address: "Route 68, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-cash-la-mesa",
    display_name: "La Mesa Counterfeit Cash Factory",
    neighborhood: "La Mesa",
    address: "La Mesa, Los Santos",
    verify: true,
  },
  {
    id: "biker-business-cash-elysian-island",
    display_name: "Elysian Island Counterfeit Cash Factory",
    neighborhood: "Elysian Island",
    address: "Elysian Island, Los Santos",
    verify: true,
  },
];

export const CASH_BUSINESSES: Omit<Property, "image_path">[] =
  CASH_LOCATIONS.map((loc) => buildBikerBusiness(loc, CASH_META));

// ---------------------------------------------------------------------------
// Document Forgery Office
// ---------------------------------------------------------------------------

const FORGERY_META: SubtypeMeta = {
  subtype: "biker-business-forgery",
  subtype_display: "Document Forgery Office",
  fandom_url: "https://gta.fandom.com/wiki/Document_Forgery_Office",
};

const FORGERY_LOCATIONS: BikerBizSeed[] = [
  {
    id: "biker-business-forgery-alamo-sea",
    display_name: "Alamo Sea Document Forgery Office",
    neighborhood: "Alamo Sea",
    address: "Alamo Sea, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-forgery-grapeseed",
    display_name: "Grapeseed Document Forgery Office",
    neighborhood: "Grapeseed",
    address: "Grapeseed, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-forgery-grand-senora",
    display_name: "Grand Senora Desert Document Forgery Office",
    neighborhood: "Grand Senora Desert",
    address: "Grand Senora Desert, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-forgery-sandy-shores",
    display_name: "Sandy Shores Document Forgery Office",
    neighborhood: "Sandy Shores",
    address: "Sandy Shores, Blaine County",
    verify: true,
  },
  {
    id: "biker-business-forgery-cypress-flats",
    display_name: "Cypress Flats Document Forgery Office",
    neighborhood: "Cypress Flats",
    address: "Cypress Flats, Los Santos",
    verify: true,
  },
  {
    id: "biker-business-forgery-la-mesa",
    display_name: "La Mesa Document Forgery Office",
    neighborhood: "La Mesa",
    address: "La Mesa, Los Santos",
    verify: true,
  },
];

export const FORGERY_BUSINESSES: Omit<Property, "image_path">[] =
  FORGERY_LOCATIONS.map((loc) => buildBikerBusiness(loc, FORGERY_META));
