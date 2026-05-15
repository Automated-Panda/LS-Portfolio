import type { Property } from "../schema";

/**
 * GTA Online MC Clubhouses — 12 per-location instances.
 * The Clubhouse Garage upgrade adds motorcycle-only storage (10 bikes).
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Clubhouses
 */

type LocationSeed = {
  id: string;
  display_name: string;
  neighborhood: string;
  address: string;
  verify?: boolean;
};

const LOCATIONS: LocationSeed[] = [
  {
    id: "mc-clubhouse-great-chaparral",
    display_name: "Great Chaparral Clubhouse",
    neighborhood: "Great Chaparral",
    address: "Great Chaparral, Blaine County",
    verify: true,
  },
  {
    id: "mc-clubhouse-grapeseed",
    display_name: "Grapeseed Clubhouse",
    neighborhood: "Grapeseed",
    address: "Grapeseed, Blaine County",
    verify: true,
  },
  {
    id: "mc-clubhouse-paleto-bay",
    display_name: "Paleto Bay Clubhouse",
    neighborhood: "Paleto Bay",
    address: "Paleto Bay, Blaine County",
    verify: true,
  },
  {
    id: "mc-clubhouse-sandy-shores",
    display_name: "Sandy Shores Clubhouse",
    neighborhood: "Sandy Shores",
    address: "Sandy Shores, Blaine County",
    verify: true,
  },
  {
    id: "mc-clubhouse-route-68",
    display_name: "Route 68 Clubhouse",
    neighborhood: "Route 68",
    address: "Route 68, Blaine County",
    verify: true,
  },
  {
    id: "mc-clubhouse-elysian-island",
    display_name: "Elysian Island Clubhouse",
    neighborhood: "Elysian Island",
    address: "Elysian Island, Los Santos",
    verify: true,
  },
  {
    id: "mc-clubhouse-la-mesa",
    display_name: "La Mesa Clubhouse",
    neighborhood: "La Mesa",
    address: "La Mesa, Los Santos",
    verify: true,
  },
  {
    id: "mc-clubhouse-cypress-flats",
    display_name: "Cypress Flats Clubhouse",
    neighborhood: "Cypress Flats",
    address: "Cypress Flats, Los Santos",
    verify: true,
  },
  {
    id: "mc-clubhouse-strawberry",
    display_name: "Strawberry Clubhouse",
    neighborhood: "Strawberry",
    address: "Strawberry, Los Santos",
    verify: true,
  },
  {
    id: "mc-clubhouse-rockford-hills",
    display_name: "Rockford Hills Clubhouse",
    neighborhood: "Rockford Hills",
    address: "Rockford Hills, Los Santos",
    verify: true,
  },
  {
    id: "mc-clubhouse-vespucci-canals",
    display_name: "Vespucci Canals Clubhouse",
    neighborhood: "Vespucci Canals",
    address: "Vespucci Canals, Los Santos",
    verify: true,
  },
  {
    id: "mc-clubhouse-mission-row",
    display_name: "Mission Row Clubhouse",
    neighborhood: "Mission Row",
    address: "Mission Row, Los Santos",
    verify: true,
  },
];

function buildClubhouse(loc: LocationSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype: "mc-clubhouse",
    subtype_display: "MC Clubhouse",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0,
    counts_as_garage: true,
    upgrades: [
      {
        id: `${loc.id}-garage`,
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
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const MC_CLUBHOUSES: Omit<Property, "image_path">[] =
  LOCATIONS.map(buildClubhouse);
