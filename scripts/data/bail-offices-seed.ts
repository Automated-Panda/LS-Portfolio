import type { Property } from "../schema";

/**
 * GTA Online Bail Offices — 5 per-location instances.
 * Introduced in the Bottom Dollar Bounties update (1.69, June 25 2024).
 * Each office includes 3 vehicle storage slots and serves as the base for
 * bounty-hunting / bail enforcement missions with Maude Eccles.
 *
 * Sources:
 *   https://www.gtabase.com/gta-online/property-types/bottom-dollar-bail-enforcement
 *   https://www.gtabase.com/gta-online/properties/downtown-vinewood-bail-office
 *   https://www.gtabase.com/gta-online/properties/mission-row-bail-office
 *   https://www.gtabase.com/gta-online/properties/del-perro-bail-office
 *   https://www.gtabase.com/gta-online/properties/davis-bail-office
 *   https://www.gtabase.com/gta-online/properties/paleto-bay-bail-office
 */

type LocationSeed = {
  id: string;
  display_name: string;
  neighborhood: string;
  address: string;
  price: number;
};

const LOCATIONS: LocationSeed[] = [
  {
    id: "bail-office-downtown-vinewood",
    display_name: "Downtown Vinewood Bail Office",
    neighborhood: "Downtown Vinewood",
    address: "Downtown Vinewood, Los Santos",
    price: 2_620_000,
  },
  {
    id: "bail-office-mission-row",
    display_name: "Mission Row Bail Office",
    neighborhood: "Mission Row",
    address: "Mission Row, Los Santos",
    price: 2_390_000,
  },
  {
    id: "bail-office-del-perro",
    display_name: "Del Perro Bail Office",
    neighborhood: "Del Perro",
    address: "Del Perro, Los Santos",
    price: 2_350_000,
  },
  {
    id: "bail-office-davis",
    display_name: "Davis Bail Office",
    neighborhood: "Davis",
    address: "Davis, Los Santos",
    price: 2_000_000,
  },
  {
    id: "bail-office-paleto-bay",
    display_name: "Paleto Bay Bail Office",
    neighborhood: "Paleto Bay",
    address: "Paleto Bay, Blaine County",
    price: 1_650_000,
  },
];

function buildBailOffice(loc: LocationSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype: "bail-office",
    subtype_display: "Bail Office",
    location: loc.address,
    neighborhood: loc.neighborhood,
    price: loc.price,
    capacity: 3,
    counts_as_garage: true,
    upgrades: [
      // ── Style ──────────────────────────────────────────────────────────────
      {
        id: `${loc.id}-style-penal-vintage`,
        display_name: "Style: Penal Vintage",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Default interior style (free).",
        price: 0,
      },
      {
        id: `${loc.id}-style-criminal-patterns`,
        display_name: "Style: Criminal Patterns",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Alternate interior style ($125,000).",
        price: 125_000,
      },
      {
        id: `${loc.id}-style-courtroom-teak`,
        display_name: "Style: Courtroom Teak",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Alternate interior style ($145,000).",
        price: 145_000,
      },
      // ── Staff ──────────────────────────────────────────────────────────────
      {
        id: `${loc.id}-enforcement-agent-1`,
        display_name: "Enforcement Agent (1 Agent)",
        tier: 1,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Hire one enforcement agent to assist with bounty targets ($750,000).",
        price: 750_000,
      },
      {
        id: `${loc.id}-enforcement-agent-2`,
        display_name: "Enforcement Agents (2 Agents)",
        tier: 2,
        capacity: 0,
        required_upgrade_id: `${loc.id}-enforcement-agent-1`,
        notes: "Upgrade to two agents; requires 1 Agent already hired ($1,500,000 total).",
        price: 1_500_000,
      },
      // ── Amenities ──────────────────────────────────────────────────────────
      {
        id: `${loc.id}-personal-quarters`,
        display_name: "Personal Quarters",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Sleeping accommodations; adds wardrobe and respawn point ($295,000).",
        price: 295_000,
      },
      {
        id: `${loc.id}-gun-locker`,
        display_name: "Gun Locker",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Allows loadout customisation and weapon hiding ($175,000).",
        price: 175_000,
      },
      {
        id: `${loc.id}-armor-plating`,
        display_name: "Armor Plating",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Reinforces the office against attack ($125,000).",
        price: 125_000,
      },
    ],
    _sources: {
      fandom: null,
      gtabase:
        "https://www.gtabase.com/gta-online/property-types/bottom-dollar-bail-enforcement",
    },
  };
}

export const BAIL_OFFICES_SEED: Omit<Property, "image_path">[] =
  LOCATIONS.map(buildBailOffice);
