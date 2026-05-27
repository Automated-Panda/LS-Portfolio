import type { Property } from "../schema";

/**
 * GTA Online Facilities — 9 per-location instances.
 * Underground Doomsday Heist bases across the map.
 * Each has a garage storing up to 7 special Doomsday-related vehicles.
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Facility
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
    id: "facility-land-act-reservoir",
    display_name: "Land Act Reservoir Facility",
    neighborhood: "Land Act Reservoir",
    address: "Land Act Reservoir, Los Santos County",
  },
  {
    id: "facility-lago-zancudo",
    display_name: "Lago Zancudo Facility",
    neighborhood: "Lago Zancudo",
    address: "Lago Zancudo, Blaine County",
  },
  {
    id: "facility-mount-gordo",
    display_name: "Mount Gordo Facility",
    neighborhood: "Mount Gordo",
    address: "Mount Gordo, Blaine County",
  },
  {
    id: "facility-paleto-bay",
    display_name: "Paleto Bay Facility",
    neighborhood: "Paleto Bay",
    address: "Paleto Bay, Blaine County",
  },
  {
    id: "facility-ron-alternates-wind-farm",
    display_name: "RON Alternates Wind Farm Facility",
    neighborhood: "RON Alternates Wind Farm",
    address: "RON Alternates Wind Farm, Blaine County",
  },
  {
    id: "facility-zancudo-river",
    display_name: "Zancudo River Facility",
    neighborhood: "Zancudo River",
    address: "Zancudo River, Blaine County",
  },
  {
    id: "facility-sandy-shores",
    display_name: "Sandy Shores Facility",
    neighborhood: "Sandy Shores",
    address: "Sandy Shores, Blaine County",
  },
  {
    id: "facility-route-68",
    display_name: "Route 68 Facility",
    neighborhood: "Route 68",
    address: "Route 68, Blaine County",
  },
  {
    id: "facility-grand-senora-desert",
    display_name: "Grand Senora Desert Facility",
    neighborhood: "Grand Senora Desert",
    address: "Grand Senora Desert, Blaine County",
  },
];

function buildFacility(loc: LocationSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype: "facility",
    subtype_display: "Facility",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0,
    counts_as_garage: true,
    upgrades: [
      {
        id: `${loc.id}-garage`,
        display_name: "Facility Garage",
        tier: null,
        capacity: 7,
        required_upgrade_id: null,
        notes:
          "7 personal vehicle slots + dedicated weaponized bays for Doomsday vehicles (Avenger, TM-02 Khanjali, RCV, etc.).",
      },
      {
        id: `${loc.id}-orbital-cannon`,
        display_name: "Orbital Cannon",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Single-use strike from low orbit ($900,000; per-shot fee).",
      },
      {
        id: `${loc.id}-security-room`,
        display_name: "Security Room",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Surveillance + Strike Team access + gun locker ($775,000).",
      },
      {
        id: `${loc.id}-lounge`,
        display_name: "Lounge",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Style upgrade — 3 tiers ($185k–$245k).",
      },
      {
        id: `${loc.id}-sleeping-quarters`,
        display_name: "Sleeping Quarters",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Style upgrade — 3 tiers ($150k–$290k).",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Facility",
      gtabase: null,
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const FACILITIES: Omit<Property, "image_path">[] =
  LOCATIONS.map(buildFacility);
