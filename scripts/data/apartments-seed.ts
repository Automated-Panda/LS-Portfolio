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
// HIGH-END APARTMENTS — TOWERS + UNITS + STILTS
// ---------------------------------------------------------------------------

// High-end has three structural pieces post-fanout:
//   1. 7 towers (Eclipse, 3 Alta, Del Perro Heights, 4 Integrity Way,
//      Weazel Plaza, Richards Majestic, Tinsel Towers) — each is a parent
//      row with parent_building=null, NON-OWNABLE, and aggregates multiple
//      unit rows beneath it.
//   2. 35 units (apartments + penthouse suites across the 7 towers) —
//      ownable, each with capacity 10, parent_building set to the tower id.
//   3. 10 stilt houses in Vinewood Hills — independent ownable units with
//      no parent_building (they aren't in any tower).
//
// Sources: gtabase.com per-unit pages + leo3418.github.io + gtalens.com map.

type Unit = {
  /** Slug appended to the tower id, e.g. "apt-3" → "{tower.id}-apt-3". */
  slug: string;
  /** Shown inside the units dialog, e.g. "Apartment 3" or "Penthouse Suite 1". */
  label: string;
  verify?: boolean;
};

type Tower = {
  id: string;
  display_name: string;
  neighborhood: string;
  address: string;
  units: Unit[];
};

const HIGH_END_TOWERS: Tower[] = [
  {
    id: "high-end-apartment-eclipse-towers",
    display_name: "Eclipse Towers",
    neighborhood: "Rockford Hills",
    address: "South Mo Milton Drive, Rockford Hills",
    units: [
      { slug: "apt-3", label: "Apartment 3" },
      { slug: "apt-5", label: "Apartment 5" },
      { slug: "apt-9", label: "Apartment 9" },
      { slug: "apt-31", label: "Apartment 31" },
      { slug: "apt-40", label: "Apartment 40" },
      { slug: "penthouse-suite-1", label: "Penthouse Suite 1" },
      { slug: "penthouse-suite-2", label: "Penthouse Suite 2" },
      { slug: "penthouse-suite-3", label: "Penthouse Suite 3" },
    ],
  },
  {
    id: "high-end-apartment-3-alta-st",
    display_name: "3 Alta Street",
    neighborhood: "Pillbox Hill",
    address: "3 Alta Street, Pillbox Hill",
    units: [
      { slug: "apt-10", label: "Apartment 10" },
      { slug: "apt-57", label: "Apartment 57" },
    ],
  },
  {
    id: "high-end-apartment-del-perro-heights",
    display_name: "Del Perro Heights",
    neighborhood: "Del Perro",
    address: "Marathon Avenue & Prosperity Street, Del Perro",
    units: [
      { slug: "apt-4", label: "Apartment 4" },
      { slug: "apt-7", label: "Apartment 7" },
      { slug: "apt-20", label: "Apartment 20" },
    ],
  },
  {
    id: "high-end-apartment-4-integrity-way",
    display_name: "4 Integrity Way",
    neighborhood: "Pillbox Hill",
    address: "Integrity Way, Pillbox Hill",
    units: [
      { slug: "apt-28", label: "Apartment 28" },
      { slug: "apt-30", label: "Apartment 30" },
      { slug: "apt-35", label: "Apartment 35" },
    ],
  },
  {
    id: "high-end-apartment-weazel-plaza",
    display_name: "Weazel Plaza",
    neighborhood: "Rockford Hills",
    address: "Movie Star Way & Heritage Way, Rockford Hills",
    units: [
      { slug: "apt-26", label: "Apartment 26" },
      { slug: "apt-70", label: "Apartment 70" },
      { slug: "apt-101", label: "Apartment 101" },
    ],
  },
  {
    id: "high-end-apartment-richards-majestic",
    display_name: "Richards Majestic",
    neighborhood: "Rockford Hills",
    address: "Movie Star Way & Heritage Way, Rockford Hills",
    units: [
      { slug: "apt-2", label: "Apartment 2" },
      { slug: "apt-4", label: "Apartment 4" },
      { slug: "apt-51", label: "Apartment 51" },
    ],
  },
  {
    id: "high-end-apartment-tinsel-towers",
    display_name: "Tinsel Towers",
    neighborhood: "Rockford Hills",
    address: "Tinsel Towers Avenue, Rockford Hills",
    units: [
      { slug: "apt-29", label: "Apartment 29" },
      { slug: "apt-42", label: "Apartment 42" },
      { slug: "apt-45", label: "Apartment 45" },
    ],
  },
];

// 10 stilt houses in Vinewood Hills — each is its own ownable property,
// no tower grouping.
const STILT_HOUSES: ApartmentSeed[] = [
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

// Tower aggregator row — non-ownable, no capacity, no upgrades. The browse
// UI special-cases this kind of row (any property with child units) to open
// a units dialog instead of toggling ownership.
function buildHighEndTower(tower: Tower): Omit<Property, "image_path"> {
  return {
    id: tower.id,
    display_name: tower.display_name,
    property_type: "residence",
    subtype: "high-end-apartment",
    subtype_display: "High-End Apartment",
    location: tower.address,
    neighborhood: tower.neighborhood,
    capacity: 0,
    parent_building: null,
    counts_as_garage: true,
    upgrades: [],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Apartments",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/apartments",
    },
  };
}

// Unit row — ownable, 10-car garage built in (capacity on the property, no
// upgrade tier). parent_building points at the tower id.
function buildHighEndUnit(tower: Tower, unit: Unit): Omit<Property, "image_path"> {
  return {
    id: `${tower.id}-${unit.slug}`,
    display_name: `${tower.display_name}, ${unit.label}`,
    property_type: "residence",
    subtype: "high-end-apartment",
    subtype_display: "High-End Apartment",
    location: tower.address,
    neighborhood: tower.neighborhood,
    capacity: 10,
    parent_building: tower.id,
    counts_as_garage: true,
    upgrades: [],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Apartments",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/apartments",
    },
    ...(unit.verify ? { verify: true } : {}),
  };
}

// Stilt house — independent, 10-car garage built in, no tower grouping.
function buildStiltHouse(loc: ApartmentSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "residence",
    subtype: "high-end-apartment",
    subtype_display: "High-End Apartment",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 10,
    parent_building: null,
    counts_as_garage: true,
    upgrades: [],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Apartments",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/apartments",
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const HIGH_END_APARTMENTS: Omit<Property, "image_path">[] = [
  ...HIGH_END_TOWERS.flatMap((t) => [
    buildHighEndTower(t),
    ...t.units.map((u) => buildHighEndUnit(t, u)),
  ]),
  ...STILT_HOUSES.map(buildStiltHouse),
];

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
    capacity: 6,
    parent_building: null,
    counts_as_garage: true,
    upgrades: [],
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
    capacity: 2,
    parent_building: null,
    counts_as_garage: true,
    upgrades: [],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Apartments",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/apartments",
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const LOW_END_APARTMENTS: Omit<Property, "image_path">[] =
  LOW_END_LOCATIONS.map(buildLowEnd);
