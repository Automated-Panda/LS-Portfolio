import type { Property } from "../schema";

/**
 * GTA Online Nightclubs — 10 per-location instances.
 * Each instance carries the same 6-upgrade pattern (3 garage levels +
 * equipment + security + dry-ice). Garage Level 3 has +11 capacity to
 * include the MTL Pounder Custom slot.
 *
 * Some street addresses are best-effort and flagged `verify: true` for
 * a follow-up pass against the Fandom location pages.
 */

type LocationSeed = {
  id: string;
  display_name: string;
  neighborhood: string;
  address: string;
  verify?: boolean;
};

const LOCATIONS: LocationSeed[] = [
  { id: "nightclub-la-mesa",            display_name: "La Mesa Nightclub",            neighborhood: "La Mesa",            address: "1618 Popular St" },
  { id: "nightclub-mission-row",        display_name: "Mission Row Nightclub",        neighborhood: "Mission Row",        address: "South Mo Milton Drive" },
  { id: "nightclub-del-perro",          display_name: "Del Perro Nightclub",          neighborhood: "Del Perro",          address: "Bay City Avenue" },
  { id: "nightclub-downtown-vinewood",  display_name: "Downtown Vinewood Nightclub",  neighborhood: "Downtown Vinewood",  address: "Vinewood Boulevard" },
  { id: "nightclub-strawberry",         display_name: "Strawberry Nightclub",         neighborhood: "Strawberry",         address: "Strawberry Avenue" },
  { id: "nightclub-vespucci-canals",    display_name: "Vespucci Canals Nightclub",    neighborhood: "Vespucci Canals",    address: "Cougar Avenue" },
  { id: "nightclub-west-vinewood",      display_name: "West Vinewood Nightclub",      neighborhood: "West Vinewood",      address: "Eclipse Boulevard" },
  { id: "nightclub-elysian-island",     display_name: "Elysian Island Nightclub",     neighborhood: "Elysian Island",     address: "Norton Place" },
  { id: "nightclub-cypress-flats",      display_name: "Cypress Flats Nightclub",      neighborhood: "Cypress Flats",      address: "Carson Avenue" },
  { id: "nightclub-la-puerta",          display_name: "La Puerta Nightclub",          neighborhood: "La Puerta",          address: "Adam's Apple Boulevard" },
];

function buildNightclub(loc: LocationSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype: "nightclub",
    subtype_display: "Nightclub",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0, // capacity comes from the garage upgrades
    counts_as_garage: true,
    upgrades: [
      {
        id: `${loc.id}-garage-1`,
        display_name: "Storage Garage Level 1",
        tier: 1,
        capacity: 10,
        required_upgrade_id: null,
        notes: null,
      },
      {
        id: `${loc.id}-garage-2`,
        display_name: "Storage Garage Level 2",
        tier: 2,
        capacity: 10,
        required_upgrade_id: `${loc.id}-garage-1`,
        notes: null,
      },
      {
        id: `${loc.id}-garage-3`,
        display_name: "Storage Garage Level 3",
        tier: 3,
        capacity: 11,
        required_upgrade_id: `${loc.id}-garage-2`,
        notes: "Includes the MTL Pounder Custom slot",
      },
      {
        id: `${loc.id}-equipment`,
        display_name: "Equipment Upgrade",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Increases nightclub income generation",
      },
      {
        id: `${loc.id}-security`,
        display_name: "Security Upgrade",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Reduces raid frequency",
      },
      {
        id: `${loc.id}-dry-ice`,
        display_name: "Dry Ice Machine",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Cosmetic / perk",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Nightclubs",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/nightclubs",
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const NIGHTCLUBS_SEED: Omit<Property, "image_path">[] =
  LOCATIONS.map(buildNightclub);
