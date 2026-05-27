import type { Property } from "../schema";

/**
 * GTA Online Agencies — 4 purchasable locations.
 * Added with The Contract DLC. Each includes a garage for up to
 * 20 personal vehicles plus the planning room used by Contract missions.
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Agencies
 *   https://gtalens.com/map/property-agencies
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
    id: "agency-little-seoul",
    display_name: "Little Seoul Agency",
    neighborhood: "Little Seoul",
    address: "San Andreas Avenue, Little Seoul",
  },
  {
    id: "agency-vespucci-canals",
    display_name: "Vespucci Canals Agency",
    neighborhood: "Vespucci Canals",
    address: "San Andreas Avenue & Tongva Drive, Vespucci Canals",
  },
  {
    id: "agency-rockford-hills",
    display_name: "Rockford Hills Agency",
    neighborhood: "Rockford Hills",
    address: "Backlot City, Rockford Hills",
  },
  {
    id: "agency-hawick",
    display_name: "Hawick Agency",
    neighborhood: "Hawick",
    address: "Spanish Avenue, Hawick",
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
      {
        id: `${loc.id}-armory`,
        display_name: "Armory",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Unlocks in-house Ammu-Nation, exclusive weapons (EMP Launcher, Stun Gun), Gun Locker, weapon mod discounts ($720,000).",
      },
      {
        id: `${loc.id}-personal-quarters`,
        display_name: "Personal Quarters",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Sleeping accommodations ($275,000).",
      },
      {
        id: `${loc.id}-vehicle-workshop`,
        display_name: "Vehicle Workshop",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Vehicle customization bench + exclusive mods (Missile Lock-on Jammer, Remote Control) ($800,000).",
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
