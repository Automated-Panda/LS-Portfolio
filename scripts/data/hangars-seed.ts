import type { Property } from "../schema";

/**
 * GTA Online Hangars — 5 purchasable instances.
 * 2 at Los Santos International Airport, 3 at Fort Zancudo.
 * Hangars store aircraft (not ground vehicles, counts_as_garage: false)
 * and unlock the Air Freight Cargo business.
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Hangar
 *   https://gtalens.com/map/property-hangars
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
    id: "hangar-lsia-a17",
    display_name: "LSIA Hangar A17",
    neighborhood: "Los Santos International Airport",
    address: "Los Santos International Airport, Hangar A17",
  },
  {
    id: "hangar-lsia-1",
    display_name: "LSIA Hangar 1",
    neighborhood: "Los Santos International Airport",
    address: "Los Santos International Airport, Hangar 1",
  },
  {
    id: "hangar-fort-zancudo-3497",
    display_name: "Fort Zancudo Hangar 3497",
    neighborhood: "Fort Zancudo",
    address: "Fort Zancudo, Hangar 3497",
  },
  {
    id: "hangar-fort-zancudo-3499",
    display_name: "Fort Zancudo Hangar 3499",
    neighborhood: "Fort Zancudo",
    address: "Fort Zancudo, Hangar 3499",
  },
  {
    id: "hangar-fort-zancudo-a2",
    display_name: "Fort Zancudo Hangar A2",
    neighborhood: "Fort Zancudo",
    address: "Fort Zancudo, Hangar A2",
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
