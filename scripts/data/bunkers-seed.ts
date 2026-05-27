import type { Property } from "../schema";

/**
 * GTA Online Bunkers — 11 per-location instances.
 * Bunkers are Gunrunning business bases in Blaine County.
 * They do not directly store personal vehicles (counts_as_garage: false).
 * Upgrades cover Personnel Equipment, Security, and the Gun Locker cosmetic.
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Bunker
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
    id: "bunker-chumash",
    display_name: "Chumash Bunker",
    neighborhood: "Chumash",
    address: "Chumash, Blaine County",
  },
  {
    id: "bunker-paleto-forest",
    display_name: "Paleto Forest Bunker",
    neighborhood: "Paleto Forest",
    address: "Paleto Forest, Blaine County",
  },
  {
    id: "bunker-raton-canyon",
    display_name: "Raton Canyon Bunker",
    neighborhood: "Raton Canyon",
    address: "Raton Canyon, Blaine County",
  },
  {
    id: "bunker-lago-zancudo",
    display_name: "Lago Zancudo Bunker",
    neighborhood: "Lago Zancudo",
    address: "Lago Zancudo, Blaine County",
  },
  {
    id: "bunker-smoke-tree-road",
    display_name: "Smoke Tree Road Bunker",
    neighborhood: "Smoke Tree Road",
    address: "Smoke Tree Road, Blaine County",
  },
  {
    id: "bunker-thomson-scrapyard",
    display_name: "Thomson Scrapyard Bunker",
    neighborhood: "Thomson Scrapyard",
    address: "Thomson Scrapyard, Blaine County",
  },
  {
    id: "bunker-grapeseed",
    display_name: "Grapeseed Bunker",
    neighborhood: "Grapeseed",
    address: "Grapeseed, Blaine County",
  },
  {
    id: "bunker-route-68",
    display_name: "Route 68 Bunker",
    neighborhood: "Route 68",
    address: "Route 68, Blaine County",
  },
  {
    id: "bunker-farmhouse",
    display_name: "Farmhouse Bunker",
    neighborhood: "Grand Senora Desert",
    address: "Grand Senora Desert, Blaine County",
  },
  {
    id: "bunker-grand-senora-desert",
    display_name: "Grand Senora Desert Bunker",
    neighborhood: "Grand Senora Desert",
    address: "Grand Senora Desert, Blaine County",
  },
  {
    id: "bunker-grand-senora-oilfields",
    display_name: "Grand Senora Oilfields Bunker",
    neighborhood: "Grand Senora Oilfields",
    address: "Grand Senora Oilfields, Blaine County",
  },
];

function buildBunker(loc: LocationSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype: "bunker",
    subtype_display: "Bunker",
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
        notes: "Speeds manufacturing/research, improves stock value ($1,155,000).",
      },
      {
        id: `${loc.id}-staff`,
        display_name: "Staff Upgrade",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Accelerates manufacturing/research, boosts inventory value ($598,500).",
      },
      {
        id: `${loc.id}-security`,
        display_name: "Security Upgrade",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Reduces chance of stock theft ($351,000).",
      },
      {
        id: `${loc.id}-personal-quarters`,
        display_name: "Personal Quarters",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Bunk + shower; respawn point ($265,000).",
      },
      {
        id: `${loc.id}-gun-locker`,
        display_name: "Gun Locker",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Weapon loadout storage ($175,000).",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Bunker",
      gtabase: null,
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const BUNKERS: Omit<Property, "image_path">[] =
  LOCATIONS.map(buildBunker);
