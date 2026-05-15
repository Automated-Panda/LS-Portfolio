import type { Property } from "../schema";

/**
 * GTA Online Stand-Alone Garages and Eclipse Boulevard Garages.
 *
 * Stand-Alone Garages: ~22 purchaseable locations across San Andreas.
 * Each garage has a fixed size (2, 6, or 10 cars); capacity lives in
 * the single upgrade rather than on the property itself.
 *
 * Eclipse Boulevard Garages: 1 combined entry — the Vinewood 50-car
 * multi-floor complex sold as a single purchase.
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Garage_(GTA_Online)
 *   https://www.gtabase.com/grand-theft-auto-v/guides/property-types/garages
 *
 * Rows flagged `verify: true` where exact address or capacity is uncertain.
 */

// ---------------------------------------------------------------------------
// Shared type
// ---------------------------------------------------------------------------

type GarageSeed = {
  id: string;
  display_name: string;
  neighborhood: string;
  address: string;
  car_count: 2 | 6 | 10;
  verify?: boolean;
};

// ---------------------------------------------------------------------------
// STAND-ALONE GARAGES
// ---------------------------------------------------------------------------

const STANDALONE_LOCATIONS: GarageSeed[] = [
  {
    id: "stand-alone-garage-1115-innocence-blvd",
    display_name: "1115 Innocence Boulevard",
    neighborhood: "Strawberry",
    address: "1115 Innocence Boulevard",
    car_count: 2,
  },
  {
    id: "stand-alone-garage-0772-roy-lowenstein-blvd",
    display_name: "0772 Roy Lowenstein Boulevard",
    neighborhood: "Chamberlain Hills",
    address: "0772 Roy Lowenstein Boulevard",
    car_count: 2,
  },
  {
    id: "stand-alone-garage-0700-la-puerta-ave",
    display_name: "0700 La Puerta Avenue",
    neighborhood: "La Puerta",
    address: "0700 La Puerta Avenue",
    car_count: 2,
  },
  {
    id: "stand-alone-garage-0102-elgin-ave",
    display_name: "0102 Elgin Avenue",
    neighborhood: "Vinewood",
    address: "0102 Elgin Avenue",
    car_count: 2,
    verify: true,
  },
  {
    id: "stand-alone-garage-1337-exceptionalists-way",
    display_name: "1337 Exceptionalists Way",
    neighborhood: "LSIA",
    address: "1337 Exceptionalists Way",
    car_count: 2,
    verify: true,
  },
  {
    id: "stand-alone-garage-1920-senora-way",
    display_name: "1920 Senora Way",
    neighborhood: "Sandy Shores",
    address: "1920 Senora Way",
    car_count: 2,
    verify: true,
  },
  {
    id: "stand-alone-garage-0437-north-main-st",
    display_name: "0437 North Main Street",
    neighborhood: "Paleto Bay",
    address: "0437 North Main Street",
    car_count: 2,
    verify: true,
  },
  {
    id: "stand-alone-garage-0506-innocence-blvd",
    display_name: "0506 Innocence Boulevard",
    neighborhood: "Strawberry",
    address: "0506 Innocence Boulevard",
    car_count: 6,
  },
  {
    id: "stand-alone-garage-1235-south-shambles-st",
    display_name: "1235 South Shambles Street",
    neighborhood: "Strawberry",
    address: "1235 South Shambles Street",
    car_count: 6,
    verify: true,
  },
  {
    id: "stand-alone-garage-1600-la-mesa-blvd",
    display_name: "1600 La Mesa Boulevard",
    neighborhood: "La Mesa",
    address: "1600 La Mesa Boulevard",
    car_count: 6,
    verify: true,
  },
  {
    id: "stand-alone-garage-0612-popular-st",
    display_name: "0612 Popular Street",
    neighborhood: "La Mesa",
    address: "0612 Popular Street",
    car_count: 6,
  },
  {
    id: "stand-alone-garage-0632-popular-st",
    display_name: "0632 Popular Street",
    neighborhood: "La Mesa",
    address: "0632 Popular Street",
    car_count: 6,
    verify: true,
  },
  {
    id: "stand-alone-garage-0516-grove-st",
    display_name: "0516 Grove Street",
    neighborhood: "Grove Street",
    address: "0516 Grove Street",
    car_count: 6,
    verify: true,
  },
  {
    id: "stand-alone-garage-1231-south-mo-milton-dr",
    display_name: "1231 South Mo Milton Drive",
    neighborhood: "Rancho",
    address: "1231 South Mo Milton Drive",
    car_count: 6,
    verify: true,
  },
  {
    id: "stand-alone-garage-0494-lake-vinewood-dr",
    display_name: "0494 Lake Vinewood Drive",
    neighborhood: "Vinewood Hills",
    address: "0494 Lake Vinewood Drive",
    car_count: 10,
    verify: true,
  },
  {
    id: "stand-alone-garage-0725-amarillo-vista",
    display_name: "0725 Amarillo Vista",
    neighborhood: "Vinewood Hills",
    address: "0725 Amarillo Vista",
    car_count: 10,
    verify: true,
  },
  {
    id: "stand-alone-garage-0231-south-rockford-dr",
    display_name: "0231 South Rockford Drive",
    neighborhood: "Rockford Hills",
    address: "0231 South Rockford Drive",
    car_count: 10,
    verify: true,
  },
  {
    id: "stand-alone-garage-1235-las-lagunas-blvd",
    display_name: "1235 Las Lagunas Boulevard",
    neighborhood: "East Los Santos",
    address: "1235 Las Lagunas Boulevard",
    car_count: 10,
    verify: true,
  },
  {
    id: "stand-alone-garage-2332-adam-apple-blvd",
    display_name: "2332 Adam's Apple Boulevard",
    neighborhood: "La Puerta",
    address: "2332 Adam's Apple Boulevard",
    car_count: 10,
    verify: true,
  },
  {
    id: "stand-alone-garage-0112-east-bay-city-ave",
    display_name: "0112 East Bay City Avenue",
    neighborhood: "Del Perro",
    address: "0112 East Bay City Avenue",
    car_count: 10,
    verify: true,
  },
  {
    id: "stand-alone-garage-1561-san-vitas-st",
    display_name: "1561 San Vitas Street",
    neighborhood: "West Vinewood",
    address: "1561 San Vitas Street",
    car_count: 10,
    verify: true,
  },
  {
    id: "stand-alone-garage-0391-palomino-ave",
    display_name: "0391 Palomino Avenue",
    neighborhood: "Mirror Park",
    address: "0391 Palomino Avenue",
    car_count: 10,
    verify: true,
  },
];

function buildStandaloneGarage(loc: GarageSeed): Omit<Property, "image_path"> {
  const label = `${loc.car_count}-Car Garage`;
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "garage",
    subtype: "stand-alone-garage",
    subtype_display: "Stand-Alone Garage",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0,
    counts_as_garage: true,
    upgrades: [
      {
        id: `${loc.id}-spaces`,
        display_name: label,
        tier: null,
        capacity: loc.car_count,
        required_upgrade_id: null,
        notes: null,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Garage_(GTA_Online)",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/garages",
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const STANDALONE_GARAGES: Omit<Property, "image_path">[] =
  STANDALONE_LOCATIONS.map(buildStandaloneGarage);

// ---------------------------------------------------------------------------
// ECLIPSE BOULEVARD GARAGES
// ---------------------------------------------------------------------------

export const ECLIPSE_BLVD_GARAGES: Omit<Property, "image_path">[] = [
  {
    id: "eclipse-blvd-garages-all",
    display_name: "Eclipse Boulevard Garages",
    property_type: "garage",
    subtype: "eclipse-blvd-garages",
    subtype_display: "Eclipse Boulevard Garages",
    location: "Eclipse Boulevard",
    neighborhood: "West Vinewood",
    capacity: 0,
    counts_as_garage: true,
    upgrades: [
      {
        id: "eclipse-blvd-garages-all-spaces",
        display_name: "50-Car Garage",
        tier: null,
        capacity: 50,
        required_upgrade_id: null,
        notes: "Available as single purchase with all floors",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Garage_(GTA_Online)",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/garages",
    },
  },
];
