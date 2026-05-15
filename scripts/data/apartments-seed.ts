import type { Property } from "../schema";

/**
 * GTA Online Residential Apartments — three tiers.
 *
 * High-End: 17 locations, each with a 10-car garage upgrade.
 * Mid-End:  30 locations, each with a 6-car garage upgrade.
 * Low-End:  10 locations, each with a 2-car garage upgrade.
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Apartments
 *   https://gta.fandom.com/wiki/Internet/iFruit
 *
 * Rows flagged `verify: true` where exact unit number or address is
 * uncertain — best-effort from Fandom / GTABase cross-reference.
 */

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

type ApartmentSeed = {
  id: string;
  display_name: string;
  neighborhood: string;
  address: string;
  verify?: boolean;
};

// ---------------------------------------------------------------------------
// HIGH-END APARTMENTS
// ---------------------------------------------------------------------------

// Canonical 17 = 7 apartment buildings + 10 stilt houses in Vinewood Hills.
// Per-LOCATION rows; buildings with multiple purchaseable apartments are
// collapsed into one row (e.g. Eclipse Towers Apt 3/31/40 → "Eclipse Towers").
// Source: gtabase.com / leo3418.github.io / sportskeeda.
const HIGH_END_LOCATIONS: ApartmentSeed[] = [
  // 7 apartment buildings
  {
    id: "high-end-apartment-eclipse-towers",
    display_name: "Eclipse Towers",
    neighborhood: "Pillbox Hill",
    address: "Eclipse Boulevard, Pillbox Hill",
  },
  {
    id: "high-end-apartment-3-alta-st",
    display_name: "3 Alta Street",
    neighborhood: "Downtown Vinewood",
    address: "3 Alta Street",
  },
  {
    id: "high-end-apartment-del-perro-heights",
    display_name: "Del Perro Heights",
    neighborhood: "Del Perro",
    address: "Del Perro Heights",
  },
  {
    id: "high-end-apartment-4-integrity-way",
    display_name: "4 Integrity Way",
    neighborhood: "Downtown Vinewood",
    address: "4 Integrity Way",
  },
  {
    id: "high-end-apartment-weazel-plaza",
    display_name: "Weazel Plaza",
    neighborhood: "Del Perro",
    address: "Weazel Plaza",
  },
  {
    id: "high-end-apartment-richards-majestic",
    display_name: "Richards Majestic",
    neighborhood: "Del Perro",
    address: "Richards Majestic",
  },
  {
    id: "high-end-apartment-tinsel-towers",
    display_name: "Tinsel Towers",
    neighborhood: "Downtown Vinewood",
    address: "Tinsel Towers",
  },
  // 10 stilt houses in Vinewood Hills
  {
    id: "high-end-apartment-2862-hillcrest-ave",
    display_name: "2862 Hillcrest Avenue",
    neighborhood: "Vinewood Hills",
    address: "2862 Hillcrest Avenue",
  },
  {
    id: "high-end-apartment-2866-hillcrest-ave",
    display_name: "2866 Hillcrest Avenue",
    neighborhood: "Vinewood Hills",
    address: "2866 Hillcrest Avenue",
  },
  {
    id: "high-end-apartment-2868-hillcrest-ave",
    display_name: "2868 Hillcrest Avenue",
    neighborhood: "Vinewood Hills",
    address: "2868 Hillcrest Avenue",
  },
  {
    id: "high-end-apartment-2874-hillcrest-ave",
    display_name: "2874 Hillcrest Avenue",
    neighborhood: "Vinewood Hills",
    address: "2874 Hillcrest Avenue",
  },
  {
    id: "high-end-apartment-2044-north-conker-ave",
    display_name: "2044 North Conker Avenue",
    neighborhood: "Vinewood Hills",
    address: "2044 North Conker Avenue",
  },
  {
    id: "high-end-apartment-2045-north-conker-ave",
    display_name: "2045 North Conker Avenue",
    neighborhood: "Vinewood Hills",
    address: "2045 North Conker Avenue",
  },
  {
    id: "high-end-apartment-2117-milton-rd",
    display_name: "2117 Milton Road",
    neighborhood: "Vinewood Hills",
    address: "2117 Milton Road",
  },
  {
    id: "high-end-apartment-2113-mad-wayne-thunder-dr",
    display_name: "2113 Mad Wayne Thunder Drive",
    neighborhood: "Vinewood Hills",
    address: "2113 Mad Wayne Thunder Drive",
  },
  {
    id: "high-end-apartment-3655-wild-oats-dr",
    display_name: "3655 Wild Oats Drive",
    neighborhood: "Vinewood Hills",
    address: "3655 Wild Oats Drive",
  },
  {
    id: "high-end-apartment-3677-whispymound-dr",
    display_name: "3677 Whispymound Drive",
    neighborhood: "Vinewood Hills",
    address: "3677 Whispymound Drive",
  },
];

function buildHighEnd(loc: ApartmentSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "residence",
    subtype: "high-end-apartment",
    subtype_display: "High-End Apartment",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0,
    counts_as_garage: true,
    upgrades: [
      {
        id: `${loc.id}-garage`,
        display_name: "10-Car Garage",
        tier: null,
        capacity: 10,
        required_upgrade_id: null,
        notes: null,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Apartments",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/apartments",
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const HIGH_END_APARTMENTS: Omit<Property, "image_path">[] =
  HIGH_END_LOCATIONS.map(buildHighEnd);

// ---------------------------------------------------------------------------
// MID-END APARTMENTS
// ---------------------------------------------------------------------------

// Canonical 13 mid-end ("medium") apartments per gtalens.com map.
const MID_END_LOCATIONS: ApartmentSeed[] = [
  {
    id: "mid-end-apartment-1162-power-st-apt-3",
    display_name: "1162 Power Street, Apt 3",
    neighborhood: "Downtown",
    address: "1162 Power Street",
  },
  {
    id: "mid-end-apartment-0605-spanish-ave-apt-1",
    display_name: "0605 Spanish Avenue, Apt 1",
    neighborhood: "Pillbox Hill",
    address: "0605 Spanish Avenue",
  },
  {
    id: "mid-end-apartment-0604-las-lagunas-blvd-apt-4",
    display_name: "0604 Las Lagunas Boulevard, Apt 4",
    neighborhood: "La Puerta",
    address: "0604 Las Lagunas Boulevard",
  },
  {
    id: "mid-end-apartment-0184-milton-rd-apt-13",
    display_name: "0184 Milton Road, Apt 13",
    neighborhood: "Del Perro",
    address: "0184 Milton Road",
  },
  {
    id: "mid-end-apartment-the-royale-apt-19",
    display_name: "The Royale, Apt 19",
    neighborhood: "Downtown",
    address: "The Royale",
  },
  {
    id: "mid-end-apartment-0504-s-mo-milton-dr",
    display_name: "0504 South Mo Milton Drive",
    neighborhood: "Del Perro",
    address: "0504 South Mo Milton Drive",
  },
  {
    id: "mid-end-apartment-0115-bay-city-ave-apt-45",
    display_name: "0115 Bay City Avenue, Apt 45",
    neighborhood: "Pillbox Hill",
    address: "0115 Bay City Avenue",
  },
  {
    id: "mid-end-apartment-0325-south-rockford-dr",
    display_name: "0325 South Rockford Drive",
    neighborhood: "Pillbox Hill",
    address: "0325 South Rockford Drive",
  },
  {
    id: "mid-end-apartment-dream-tower-apt-15",
    display_name: "Dream Tower, Apt 15",
    neighborhood: "Downtown",
    address: "Dream Tower",
  },
  {
    id: "mid-end-apartment-4-hangman-ave",
    display_name: "4 Hangman Avenue",
    neighborhood: "Pillbox Hill",
    address: "4 Hangman Avenue",
  },
  {
    id: "mid-end-apartment-12-sustancia-rd",
    display_name: "12 Sustancia Road",
    neighborhood: "Pillbox Hill",
    address: "12 Sustancia Road",
  },
  {
    id: "mid-end-apartment-4584-procopio-dr",
    display_name: "4584 Procopio Drive",
    neighborhood: "Del Perro",
    address: "4584 Procopio Drive",
  },
  {
    id: "mid-end-apartment-4401-procopio-dr",
    display_name: "4401 Procopio Drive",
    neighborhood: "Del Perro",
    address: "4401 Procopio Drive",
  },
];

function buildMidEnd(loc: ApartmentSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "residence",
    subtype: "mid-end-apartment",
    subtype_display: "Mid-End Apartment",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0,
    counts_as_garage: true,
    upgrades: [
      {
        id: `${loc.id}-garage`,
        display_name: "6-Car Garage",
        tier: null,
        capacity: 6,
        required_upgrade_id: null,
        notes: null,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Apartments",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/apartments",
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const MID_END_APARTMENTS: Omit<Property, "image_path">[] =
  MID_END_LOCATIONS.map(buildMidEnd);

// ---------------------------------------------------------------------------
// LOW-END APARTMENTS
// ---------------------------------------------------------------------------

// Canonical 10 low-end ("small") apartments per gtalens.com map.
const LOW_END_LOCATIONS: ApartmentSeed[] = [
  {
    id: "low-end-apartment-2143-las-lagunas-blvd-apt-9",
    display_name: "2143 Las Lagunas Boulevard, Apt 9",
    neighborhood: "La Puerta",
    address: "2143 Las Lagunas Boulevard",
  },
  {
    id: "low-end-apartment-1561-san-vitas-st-apt-2",
    display_name: "1561 San Vitas Street, Apt 2",
    neighborhood: "La Puerta",
    address: "1561 San Vitas Street",
  },
  {
    id: "low-end-apartment-0112-s-rockford-dr-apt-13",
    display_name: "0112 South Rockford Drive, Apt 13",
    neighborhood: "Pillbox Hill",
    address: "0112 South Rockford Drive",
  },
  {
    id: "low-end-apartment-2057-vespucci-blvd-apt-1",
    display_name: "2057 Vespucci Boulevard, Apt 1",
    neighborhood: "Del Perro",
    address: "2057 Vespucci Boulevard",
  },
  {
    id: "low-end-apartment-0069-cougar-ave-apt-19",
    display_name: "0069 Cougar Avenue, Apt 19",
    neighborhood: "Downtown",
    address: "0069 Cougar Avenue",
  },
  {
    id: "low-end-apartment-1237-prosperity-st-apt-21",
    display_name: "1237 Prosperity Street, Apt 21",
    neighborhood: "La Puerta",
    address: "1237 Prosperity Street",
  },
  {
    id: "low-end-apartment-1115-blvd-del-perro-apt-18",
    display_name: "1115 Boulevard Del Perro, Apt 18",
    neighborhood: "Del Perro",
    address: "1115 Boulevard Del Perro",
  },
  {
    id: "low-end-apartment-0232-paleto-blvd",
    display_name: "0232 Paleto Boulevard",
    neighborhood: "Paleto Bay",
    address: "0232 Paleto Boulevard",
  },
  {
    id: "low-end-apartment-140-zancudo-ave",
    display_name: "140 Zancudo Avenue",
    neighborhood: "Fort Zancudo",
    address: "140 Zancudo Avenue",
  },
  {
    id: "low-end-apartment-1893-grapeseed-ave",
    display_name: "1893 Grapeseed Avenue",
    neighborhood: "Grapeseed",
    address: "1893 Grapeseed Avenue",
  },
];

function buildLowEnd(loc: ApartmentSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "residence",
    subtype: "low-end-apartment",
    subtype_display: "Low-End Apartment",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0,
    counts_as_garage: true,
    upgrades: [
      {
        id: `${loc.id}-garage`,
        display_name: "2-Car Garage",
        tier: null,
        capacity: 2,
        required_upgrade_id: null,
        notes: null,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Apartments",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/apartments",
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const LOW_END_APARTMENTS: Omit<Property, "image_path">[] =
  LOW_END_LOCATIONS.map(buildLowEnd);
