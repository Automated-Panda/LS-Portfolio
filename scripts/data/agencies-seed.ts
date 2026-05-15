import type { Property } from "../schema";

/**
 * GTA Online Agencies — 5 per-location instances.
 * The Agency is the hub for The Contract DLC missions.
 * Each includes a garage storing up to 20 personal vehicles.
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Agencies
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
    id: "agency-vespucci-canals",
    display_name: "Vespucci Canals Agency",
    neighborhood: "Vespucci Canals",
    address: "Vespucci Canals, Los Santos",
    verify: true,
  },
  {
    id: "agency-hawick",
    display_name: "Hawick Agency",
    neighborhood: "Hawick",
    address: "Hawick, Los Santos",
    verify: true,
  },
  {
    id: "agency-rockford-hills",
    display_name: "Rockford Hills Agency",
    neighborhood: "Rockford Hills",
    address: "Rockford Hills, Los Santos",
    verify: true,
  },
  {
    id: "agency-little-seoul",
    display_name: "Little Seoul Agency",
    neighborhood: "Little Seoul",
    address: "Little Seoul, Los Santos",
    verify: true,
  },
  {
    id: "agency-vinewood",
    display_name: "Vinewood Agency",
    neighborhood: "Vinewood",
    address: "Vinewood, Los Santos",
    verify: true,
  },
];

function buildAgency(loc: LocationSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype: "agency",
    subtype_display: "The Agency",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0,
    counts_as_garage: true,
    upgrades: [
      {
        id: `${loc.id}-garage`,
        display_name: "Agency Garage",
        tier: null,
        capacity: 20,
        required_upgrade_id: null,
        notes: null,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Agencies",
      gtabase: null,
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const AGENCIES: Omit<Property, "image_path">[] =
  LOCATIONS.map(buildAgency);
