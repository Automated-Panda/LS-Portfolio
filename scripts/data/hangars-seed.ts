import type { Property } from "../schema";

/**
 * GTA Online Hangars — 5 purchasable instances.
 * 3 at Los Santos International Airport (LSIA), 2 at Fort Zancudo.
 * Hangars store aircraft and provide the Hangar Business (Air Freight Cargo).
 * They do NOT store ground vehicles (counts_as_garage: false).
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Hangar
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
    id: "hangar-lsia-1",
    display_name: "LSIA Hangar 1",
    neighborhood: "LSIA",
    address: "Los Santos International Airport",
    verify: true,
  },
  {
    id: "hangar-lsia-3499",
    display_name: "LSIA Hangar 3499",
    neighborhood: "LSIA",
    address: "Los Santos International Airport, Hangar 3499",
    verify: true,
  },
  {
    id: "hangar-lsia-3497",
    display_name: "LSIA Hangar 3497",
    neighborhood: "LSIA",
    address: "Los Santos International Airport, Hangar 3497",
    verify: true,
  },
  {
    id: "hangar-fort-zancudo-a17",
    display_name: "Fort Zancudo Hangar A17",
    neighborhood: "Fort Zancudo",
    address: "Fort Zancudo, Blaine County",
    verify: true,
  },
  {
    id: "hangar-fort-zancudo-a2",
    display_name: "Fort Zancudo Hangar A2",
    neighborhood: "Fort Zancudo",
    address: "Fort Zancudo, Blaine County",
    verify: true,
  },
];

function buildHangar(loc: LocationSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype: "hangar",
    subtype_display: "Hangar",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0,
    counts_as_garage: false,
    upgrades: [
      {
        id: `${loc.id}-storage`,
        display_name: "Hangar Storage",
        tier: null,
        capacity: 20,
        required_upgrade_id: null,
        notes: "Stores planes and helicopters; not garage vehicles",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Hangar",
      gtabase: null,
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const HANGARS_SEED: Omit<Property, "image_path">[] =
  LOCATIONS.map(buildHangar);
