import type { Property } from "../schema";

/**
 * GTA Online Salvage Yards — 5 per-location instances.
 * Introduced in the San Andreas Mercenaries update.
 * Salvage Yards do not store personal vehicles; they house the tow truck
 * used for Chop Shop theft missions (counts_as_garage: false).
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Salvage_Yard
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
    id: "salvage-yard-murrieta-heights",
    display_name: "Murrieta Heights Salvage Yard",
    neighborhood: "Murrieta Heights",
    address: "Murrieta Heights, Los Santos",
  },
  {
    id: "salvage-yard-sandy-shores",
    display_name: "Sandy Shores Salvage Yard",
    neighborhood: "Sandy Shores",
    address: "Sandy Shores, Blaine County",
  },
  {
    id: "salvage-yard-la-puerta",
    display_name: "La Puerta Salvage Yard",
    neighborhood: "La Puerta",
    address: "La Puerta, Los Santos",
  },
  {
    id: "salvage-yard-strawberry",
    display_name: "Strawberry Salvage Yard",
    neighborhood: "Strawberry",
    address: "Strawberry, Los Santos",
  },
  {
    id: "salvage-yard-paleto-bay",
    display_name: "Paleto Bay Salvage Yard",
    neighborhood: "Paleto Bay",
    address: "Paleto Bay, Blaine County",
  },
];

function buildSalvageYard(loc: LocationSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype: "salvage-yard",
    subtype_display: "Salvage Yard",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0,
    counts_as_garage: false,
    upgrades: [
      {
        id: `${loc.id}-tow-truck`,
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
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const SALVAGE_YARDS: Omit<Property, "image_path">[] =
  LOCATIONS.map(buildSalvageYard);
