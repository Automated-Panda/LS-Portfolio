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
    verify: true,
  },
  {
    id: "facility-lago-zancudo",
    display_name: "Lago Zancudo Facility",
    neighborhood: "Lago Zancudo",
    address: "Lago Zancudo, Blaine County",
    verify: true,
  },
  {
    id: "facility-mount-gordo",
    display_name: "Mount Gordo Facility",
    neighborhood: "Mount Gordo",
    address: "Mount Gordo, Blaine County",
    verify: true,
  },
  {
    id: "facility-paleto-forest",
    display_name: "Paleto Forest Facility",
    neighborhood: "Paleto Forest",
    address: "Paleto Forest, Blaine County",
    verify: true,
  },
  {
    id: "facility-ron-alternates-wind-farm",
    display_name: "RON Alternates Wind Farm Facility",
    neighborhood: "RON Alternates Wind Farm",
    address: "RON Alternates Wind Farm, Blaine County",
    verify: true,
  },
  {
    id: "facility-tataviam-mountains",
    display_name: "Tataviam Mountains Facility",
    neighborhood: "Tataviam Mountains",
    address: "Tataviam Mountains, Los Santos County",
    verify: true,
  },
  {
    id: "facility-sandy-shores",
    display_name: "Sandy Shores Facility",
    neighborhood: "Sandy Shores",
    address: "Sandy Shores, Blaine County",
    verify: true,
  },
  {
    id: "facility-route-68",
    display_name: "Route 68 Facility",
    neighborhood: "Route 68",
    address: "Route 68, Blaine County",
    verify: true,
  },
  {
    id: "facility-elysian-island",
    display_name: "Elysian Island Facility",
    neighborhood: "Elysian Island",
    address: "Elysian Island, Los Santos",
    verify: true,
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
          "Stores Avenger, MOC, TM-02 Khanjali, RCV, and other Doomsday vehicles",
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
