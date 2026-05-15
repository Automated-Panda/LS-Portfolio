import type { Property } from "../schema";

/**
 * GTA Online CEO Executive Offices — 4 purchasable locations.
 * The office building itself does not store cars (counts_as_garage: false).
 * Vehicle storage comes from the chained Office Garage upgrade
 * (3 levels × 20 = 60 max when fully upgraded).
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Executive_Offices
 *   https://www.gtabase.com/grand-theft-auto-v/guides/property-types/offices
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
    id: "ceo-office-maze-bank-west",
    display_name: "Maze Bank West",
    neighborhood: "Del Perro",
    address: "Del Perro, Los Santos",
  },
  {
    id: "ceo-office-arcadius-business-center",
    display_name: "Arcadius Business Center",
    neighborhood: "Pillbox Hill",
    address: "Pillbox Hill, Los Santos",
  },
  {
    id: "ceo-office-lombank-west",
    display_name: "Lombank West",
    neighborhood: "Del Perro",
    address: "Del Perro, Los Santos",
  },
  {
    id: "ceo-office-maze-bank-tower",
    display_name: "Maze Bank Tower",
    neighborhood: "Pillbox Hill",
    address: "Pillbox Hill, Los Santos",
  },
];

function buildOffice(loc: LocationSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype: "ceo-office",
    subtype_display: "CEO Office",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0,
    counts_as_garage: false,
    upgrades: [
      {
        id: `${loc.id}-garage-1`,
        display_name: "Office Garage Level 1",
        tier: 1,
        capacity: 20,
        required_upgrade_id: null,
        notes: null,
      },
      {
        id: `${loc.id}-garage-2`,
        display_name: "Office Garage Level 2",
        tier: 2,
        capacity: 20,
        required_upgrade_id: `${loc.id}-garage-1`,
        notes: null,
      },
      {
        id: `${loc.id}-garage-3`,
        display_name: "Office Garage Level 3",
        tier: 3,
        capacity: 20,
        required_upgrade_id: `${loc.id}-garage-2`,
        notes: "Fully upgraded Office Garage holds 60 vehicles total",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Executive_Offices",
      gtabase:
        "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/offices",
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const CEO_OFFICES: Omit<Property, "image_path">[] =
  LOCATIONS.map(buildOffice);
