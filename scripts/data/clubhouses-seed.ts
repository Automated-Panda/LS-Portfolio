import type { Property } from "../schema";

/**
 * GTA Online MC Clubhouses — 12 purchasable locations (Bikers DLC).
 * Six 1-Story and six 2-Story variants. Each includes a Clubhouse Garage
 * upgrade for motorcycle-only storage (10 bikes).
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Clubhouses
 *   https://www.gtabase.com/grand-theft-auto-v/guides/property-types/mc-clubhouses
 */

type LocationSeed = {
  id: string;
  display_name: string;
  neighborhood: string;
  address: string;
  stories: 1 | 2;
  verify?: boolean;
};

const LOCATIONS: LocationSeed[] = [
  // 1-Story Clubhouses
  {
    id: "mc-clubhouse-great-chaparral",
    display_name: "Great Chaparral Clubhouse",
    neighborhood: "Great Chaparral",
    address: "Route 68, Great Chaparral",
    stories: 1,
  },
  {
    id: "mc-clubhouse-sandy-shores",
    display_name: "Sandy Shores Clubhouse",
    neighborhood: "Sandy Shores",
    address: "Algonquin Boulevard, Sandy Shores",
    stories: 1,
  },
  {
    id: "mc-clubhouse-paleto-bay-1story",
    display_name: "Paleto Bay Clubhouse (1-Story)",
    neighborhood: "Paleto Bay",
    address: "Paleto Bay, Blaine County",
    stories: 1,
  },
  {
    id: "mc-clubhouse-del-perro-beach",
    display_name: "Del Perro Beach Clubhouse",
    neighborhood: "Del Perro Beach",
    address: "Del Perro Beach, Los Santos",
    stories: 1,
  },
  {
    id: "mc-clubhouse-rancho",
    display_name: "Rancho Clubhouse",
    neighborhood: "Rancho",
    address: "Rancho, Los Santos",
    stories: 1,
  },
  {
    id: "mc-clubhouse-pillbox-hill",
    display_name: "Pillbox Hill Clubhouse",
    neighborhood: "Pillbox Hill",
    address: "Pillbox Hill, Los Santos",
    stories: 1,
  },
  // 2-Story Clubhouses
  {
    id: "mc-clubhouse-grapeseed",
    display_name: "Grapeseed Clubhouse",
    neighborhood: "Grapeseed",
    address: "East Joshua Road, Grapeseed",
    stories: 2,
  },
  {
    id: "mc-clubhouse-paleto-bay-2story",
    display_name: "Paleto Bay Clubhouse (2-Story)",
    neighborhood: "Paleto Bay",
    address: "Paleto Boulevard, Paleto Bay",
    stories: 2,
  },
  {
    id: "mc-clubhouse-vespucci-beach",
    display_name: "Vespucci Beach Clubhouse",
    neighborhood: "Vespucci Beach",
    address: "Vespucci Beach, Los Santos",
    stories: 2,
  },
  {
    id: "mc-clubhouse-la-mesa",
    display_name: "La Mesa Clubhouse",
    neighborhood: "La Mesa",
    address: "La Mesa, Los Santos",
    stories: 2,
  },
  {
    id: "mc-clubhouse-downtown-vinewood",
    display_name: "Downtown Vinewood Clubhouse",
    neighborhood: "Downtown Vinewood",
    address: "Downtown Vinewood, Los Santos",
    stories: 2,
  },
  {
    id: "mc-clubhouse-hawick",
    display_name: "Hawick Clubhouse",
    neighborhood: "Hawick",
    address: "Hawick Avenue, Hawick",
    stories: 2,
  },
];

function buildClubhouse(loc: LocationSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype: "mc-clubhouse",
    subtype_display: "MC Clubhouse",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0,
    counts_as_garage: true,
    upgrades: [
      {
        // The 10-bike Clubhouse Garage ships with every clubhouse (both
        // 1-Story and 2-Story). It's not a separately-paid upgrade — the
        // Custom Bike Shop is the only garage-related paid add-on.
        id: `${loc.id}-garage`,
        display_name: "Clubhouse Garage",
        tier: null,
        capacity: 10,
        required_upgrade_id: null,
        notes: `${loc.stories}-Story Clubhouse. 10 personal bike slots + 7 member bike slots (1 per MC member, up to 7). Included with the clubhouse purchase.`,
        price: 0,
        included_on_purchase: true,
      },
      {
        id: `${loc.id}-gun-locker`,
        display_name: "Gun Locker",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Weapon loadout storage ($320,000).",
      },
      {
        id: `${loc.id}-custom-bike-shop`,
        display_name: "Custom Bike Shop",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Full motorcycle customization + customer bike service ($530,000).",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Clubhouses",
      gtabase:
        "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/mc-clubhouses",
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const MC_CLUBHOUSES: Omit<Property, "image_path">[] =
  LOCATIONS.map(buildClubhouse);
