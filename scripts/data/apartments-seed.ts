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

const MID_END_LOCATIONS: ApartmentSeed[] = [
  {
    id: "mid-end-apartment-3671-whispymound-dr",
    display_name: "3671 Whispymound Drive",
    neighborhood: "Vinewood Hills",
    address: "3671 Whispymound Drive",
  },
  {
    id: "mid-end-apartment-1237-prosperity-st-apt-5",
    display_name: "1237 Prosperity Street, Apt 5",
    neighborhood: "Little Seoul",
    address: "1237 Prosperity Street",
  },
  {
    id: "mid-end-apartment-0605-spanish-ave-apt-8",
    display_name: "0605 Spanish Avenue, Apt 8",
    neighborhood: "Little Seoul",
    address: "0605 Spanish Avenue",
    verify: true,
  },
  {
    id: "mid-end-apartment-apartment-7-harold-way",
    display_name: "Apt 7, Harold Way",
    neighborhood: "Burton",
    address: "Harold Way",
    verify: true,
  },
  {
    id: "mid-end-apartment-1402-south-mo-milton-dr",
    display_name: "1402 South Mo Milton Drive",
    neighborhood: "Rancho",
    address: "1402 South Mo Milton Drive",
    verify: true,
  },
  {
    id: "mid-end-apartment-1561-san-vitas-st-apt-2",
    display_name: "1561 San Vitas Street, Apt 2",
    neighborhood: "West Vinewood",
    address: "1561 San Vitas Street",
    verify: true,
  },
  {
    id: "mid-end-apartment-3912-amarillo-vista",
    display_name: "3912 Amarillo Vista",
    neighborhood: "Vinewood Hills",
    address: "3912 Amarillo Vista",
    verify: true,
  },
  {
    id: "mid-end-apartment-0012-bay-city-ave-apt-4",
    display_name: "0012 Bay City Avenue, Apt 4",
    neighborhood: "Del Perro",
    address: "0012 Bay City Avenue",
    verify: true,
  },
  {
    id: "mid-end-apartment-1623-south-shambles-st",
    display_name: "1623 South Shambles Street",
    neighborhood: "Strawberry",
    address: "1623 South Shambles Street",
    verify: true,
  },
  {
    id: "mid-end-apartment-0725-prosperity-st-apt-1",
    display_name: "0725 Prosperity Street, Apt 1",
    neighborhood: "Little Seoul",
    address: "0725 Prosperity Street",
    verify: true,
  },
  {
    id: "mid-end-apartment-3004-route-68-apt-2",
    display_name: "3004 Route 68, Apt 2",
    neighborhood: "Harmony",
    address: "3004 Route 68",
    verify: true,
  },
  {
    id: "mid-end-apartment-1104-las-lagunas-blvd-apt-1",
    display_name: "1104 Las Lagunas Boulevard, Apt 1",
    neighborhood: "East Los Santos",
    address: "1104 Las Lagunas Boulevard",
    verify: true,
  },
  {
    id: "mid-end-apartment-0017-integrity-way-apt-2",
    display_name: "0017 Integrity Way, Apt 2",
    neighborhood: "Downtown Vinewood",
    address: "0017 Integrity Way",
    verify: true,
  },
  {
    id: "mid-end-apartment-0136-east-mirror-dr",
    display_name: "0136 East Mirror Drive",
    neighborhood: "Mirror Park",
    address: "0136 East Mirror Drive",
    verify: true,
  },
  {
    id: "mid-end-apartment-2405-strawberry-ave",
    display_name: "2405 Strawberry Avenue",
    neighborhood: "Strawberry",
    address: "2405 Strawberry Avenue",
    verify: true,
  },
  {
    id: "mid-end-apartment-2054-north-conker-ave",
    display_name: "2054 North Conker Avenue",
    neighborhood: "Rockford Hills",
    address: "2054 North Conker Avenue",
    verify: true,
  },
  {
    id: "mid-end-apartment-1900-b-jamestown-st",
    display_name: "1900B Jamestown Street",
    neighborhood: "Strawberry",
    address: "1900B Jamestown Street",
    verify: true,
  },
  {
    id: "mid-end-apartment-3215-wetland-way",
    display_name: "3215 Wetland Way",
    neighborhood: "Paleto Bay",
    address: "3215 Wetland Way",
    verify: true,
  },
  {
    id: "mid-end-apartment-0606-spanish-ave-apt-3",
    display_name: "0606 Spanish Avenue, Apt 3",
    neighborhood: "Little Seoul",
    address: "0606 Spanish Avenue",
    verify: true,
  },
  {
    id: "mid-end-apartment-0197-integration-blvd-apt-2",
    display_name: "0197 Integration Boulevard, Apt 2",
    neighborhood: "East Los Santos",
    address: "0197 Integration Boulevard",
    verify: true,
  },
  {
    id: "mid-end-apartment-1561-san-vitas-st-apt-6",
    display_name: "1561 San Vitas Street, Apt 6",
    neighborhood: "West Vinewood",
    address: "1561 San Vitas Street",
    verify: true,
  },
  {
    id: "mid-end-apartment-4401-procopio-dr",
    display_name: "4401 Procopio Drive",
    neighborhood: "North Chumash",
    address: "4401 Procopio Drive",
    verify: true,
  },
  {
    id: "mid-end-apartment-2001-las-lagunas-blvd-apt-3",
    display_name: "2001 Las Lagunas Boulevard, Apt 3",
    neighborhood: "East Los Santos",
    address: "2001 Las Lagunas Boulevard",
    verify: true,
  },
  {
    id: "mid-end-apartment-1237-prosperity-st-apt-14",
    display_name: "1237 Prosperity Street, Apt 14",
    neighborhood: "Little Seoul",
    address: "1237 Prosperity Street",
    verify: true,
  },
  {
    id: "mid-end-apartment-0473-peaceful-st-apt-1",
    display_name: "0473 Peaceful Street, Apt 1",
    neighborhood: "Strawberry",
    address: "0473 Peaceful Street",
    verify: true,
  },
  {
    id: "mid-end-apartment-0019-bay-city-apt-7",
    display_name: "0019 Bay City Avenue, Apt 7",
    neighborhood: "Del Perro",
    address: "0019 Bay City Avenue",
    verify: true,
  },
  {
    id: "mid-end-apartment-0605-grove-st-apt-2",
    display_name: "0605 Grove Street, Apt 2",
    neighborhood: "Grove Street",
    address: "0605 Grove Street",
    verify: true,
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

const LOW_END_LOCATIONS: ApartmentSeed[] = [
  {
    id: "low-end-apartment-3671-whispymound-dr-apt-1",
    display_name: "3671 Whispymound Drive, Apt 1",
    neighborhood: "Vinewood Hills",
    address: "3671 Whispymound Drive",
    verify: true,
  },
  {
    id: "low-end-apartment-1605-las-lagunas-blvd",
    display_name: "1605 Las Lagunas Boulevard",
    neighborhood: "East Los Santos",
    address: "1605 Las Lagunas Boulevard",
    verify: true,
  },
  {
    id: "low-end-apartment-0605-grove-st",
    display_name: "0605 Grove Street",
    neighborhood: "Grove Street",
    address: "0605 Grove Street",
    verify: true,
  },
  {
    id: "low-end-apartment-1162-power-st-apt-1",
    display_name: "1162 Power Street, Apt 1",
    neighborhood: "Chamberlain Hills",
    address: "1162 Power Street",
    verify: true,
  },
  {
    id: "low-end-apartment-0115-innocence-blvd",
    display_name: "0115 Innocence Boulevard",
    neighborhood: "Strawberry",
    address: "0115 Innocence Boulevard",
    verify: true,
  },
  {
    id: "low-end-apartment-0921-south-mo-milton-dr",
    display_name: "0921 South Mo Milton Drive",
    neighborhood: "Rancho",
    address: "0921 South Mo Milton Drive",
    verify: true,
  },
  {
    id: "low-end-apartment-0112-sinner-st",
    display_name: "0112 Sinner Street",
    neighborhood: "South Los Santos",
    address: "0112 Sinner Street",
    verify: true,
  },
  {
    id: "low-end-apartment-1537-aguja-st-apt-6",
    display_name: "1537 Aguja Street, Apt 6",
    neighborhood: "Little Seoul",
    address: "1537 Aguja Street",
    verify: true,
  },
  {
    id: "low-end-apartment-0818-route-68",
    display_name: "0818 Route 68",
    neighborhood: "Harmony",
    address: "0818 Route 68",
    verify: true,
  },
  {
    id: "low-end-apartment-2210-jamestown-st-apt-3",
    display_name: "2210 Jamestown Street, Apt 3",
    neighborhood: "Strawberry",
    address: "2210 Jamestown Street",
    verify: true,
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
