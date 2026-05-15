import type { Property } from "../schema";

/**
 * GTA Online Stand-Alone Garages and Eclipse Boulevard Garages.
 *
 * Stand-Alone Garages: 27 canonical addresses across San Andreas, each with
 * a fixed size (2, 6, or 10 cars). Capacity lives in the single upgrade
 * rather than on the property itself. Per-location addresses + sizes
 * sourced from gtalens.com's interactive apartments & garages map.
 *
 * Eclipse Boulevard Garages: 1 combined entry — the Vinewood 50-car
 * multi-floor complex sold as a single purchase.
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Garage_(GTA_Online)
 *   https://www.gtabase.com/grand-theft-auto-v/guides/property-types/garages
 *   https://gtalens.com/map/apartments-and-garages
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

// Canonical 27 stand-alone garages per gtalens.com:
// 6× 10-car, 8× 6-car, 13× 2-car.
const STANDALONE_LOCATIONS: GarageSeed[] = [
  // ---- 10-car garages (6) ----
  {
    id: "stand-alone-garage-0120-murrieta-heights",
    display_name: "0120 Murrieta Heights",
    neighborhood: "Murrieta Heights",
    address: "0120 Murrieta Heights",
    car_count: 10,
  },
  {
    id: "stand-alone-garage-unit-2-popular-st",
    display_name: "Unit 2 Popular St",
    neighborhood: "La Mesa",
    address: "Unit 2 Popular Street",
    car_count: 10,
  },
  {
    id: "stand-alone-garage-331-supply-st",
    display_name: "331 Supply St",
    neighborhood: "Cypress Flats",
    address: "331 Supply Street",
    car_count: 10,
  },
  {
    id: "stand-alone-garage-1623-south-shambles-st",
    display_name: "1623 South Shambles St",
    neighborhood: "Strawberry",
    address: "1623 South Shambles Street",
    car_count: 10,
  },
  {
    id: "stand-alone-garage-1337-exceptionalists-way",
    display_name: "1337 Exceptionalists Way",
    neighborhood: "Banning",
    address: "1337 Exceptionalists Way",
    car_count: 10,
  },
  {
    id: "stand-alone-garage-unit-76-greenwich-parkway",
    display_name: "Unit 76 Greenwich Parkway",
    neighborhood: "Banning",
    address: "Unit 76 Greenwich Parkway",
    car_count: 10,
  },
  // ---- 6-car garages (8) ----
  {
    id: "stand-alone-garage-unit-14-popular-st",
    display_name: "Unit 14 Popular St",
    neighborhood: "La Mesa",
    address: "Unit 14 Popular Street",
    car_count: 6,
  },
  {
    id: "stand-alone-garage-unit-1-olympic-fwy",
    display_name: "Unit 1 Olympic Fwy",
    neighborhood: "La Puerta",
    address: "Unit 1 Olympic Freeway",
    car_count: 6,
  },
  {
    id: "stand-alone-garage-0552-roy-lowenstein-blvd",
    display_name: "0552 Roy Lowenstein Blvd",
    neighborhood: "Chamberlain Hills",
    address: "0552 Roy Lowenstein Boulevard",
    car_count: 6,
  },
  {
    id: "stand-alone-garage-0432-davis-ave",
    display_name: "0432 Davis Ave",
    neighborhood: "Davis",
    address: "0432 Davis Avenue",
    car_count: 6,
  },
  {
    id: "stand-alone-garage-870-route-68-approach",
    display_name: "870 Route 68 Approach",
    neighborhood: "Route 68",
    address: "870 Route 68 Approach",
    car_count: 6,
  },
  {
    id: "stand-alone-garage-8754-route-68",
    display_name: "8754 Route 68",
    neighborhood: "Route 68",
    address: "8754 Route 68",
    car_count: 6,
  },
  {
    id: "stand-alone-garage-1905-davis-ave",
    display_name: "1905 Davis Ave",
    neighborhood: "Davis",
    address: "1905 Davis Avenue",
    car_count: 6,
  },
  {
    id: "stand-alone-garage-4531-dry-dock-st",
    display_name: "4531 Dry Dock St",
    neighborhood: "Elysian Island",
    address: "4531 Dry Dock Street",
    car_count: 6,
  },
  // ---- 2-car garages (13) ----
  {
    id: "stand-alone-garage-0754-roy-lowenstein-blvd",
    display_name: "0754 Roy Lowenstein Blvd",
    neighborhood: "Chamberlain Hills",
    address: "0754 Roy Lowenstein Boulevard",
    car_count: 2,
  },
  {
    id: "stand-alone-garage-12-little-bighorn-ave",
    display_name: "12 Little Bighorn Ave",
    neighborhood: "Davis",
    address: "12 Little Bighorn Avenue",
    car_count: 2,
  },
  {
    id: "stand-alone-garage-unit-124-popular-st",
    display_name: "Unit 124 Popular St",
    neighborhood: "La Mesa",
    address: "Unit 124 Popular Street",
    car_count: 2,
  },
  {
    id: "stand-alone-garage-142-paleto-blvd",
    display_name: "142 Paleto Blvd",
    neighborhood: "Paleto Bay",
    address: "142 Paleto Boulevard",
    car_count: 2,
  },
  {
    id: "stand-alone-garage-1-strawberry-ave",
    display_name: "1 Strawberry Ave",
    neighborhood: "Strawberry",
    address: "1 Strawberry Avenue",
    car_count: 2,
  },
  {
    id: "stand-alone-garage-1932-grapeseed-ave",
    display_name: "1932 Grapeseed Ave",
    neighborhood: "Grapeseed",
    address: "1932 Grapeseed Avenue",
    car_count: 2,
  },
  {
    id: "stand-alone-garage-1920-senora-way",
    display_name: "1920 Senora Way",
    neighborhood: "Sandy Shores",
    address: "1920 Senora Way",
    car_count: 2,
  },
  {
    id: "stand-alone-garage-2000-great-ocean-hwy",
    display_name: "2000 Great Ocean Highway",
    neighborhood: "Banham Canyon",
    address: "2000 Great Ocean Highway",
    car_count: 2,
  },
  {
    id: "stand-alone-garage-197-route-68",
    display_name: "197 Route 68",
    neighborhood: "Route 68",
    address: "197 Route 68",
    car_count: 2,
  },
  {
    id: "stand-alone-garage-1200-route-68",
    display_name: "1200 Route 68",
    neighborhood: "Route 68",
    address: "1200 Route 68",
    car_count: 2,
  },
  {
    id: "stand-alone-garage-innocence-blvd",
    display_name: "Garage Innocence Blvd",
    neighborhood: "Strawberry",
    address: "Innocence Boulevard",
    car_count: 2,
  },
  {
    id: "stand-alone-garage-634-blvd-del-perro",
    display_name: "634 Blvd Del Perro",
    neighborhood: "Del Perro",
    address: "634 Boulevard Del Perro",
    car_count: 2,
  },
  {
    id: "stand-alone-garage-0897-mirror-park-blvd",
    display_name: "0897 Mirror Park Blvd",
    neighborhood: "Mirror Park",
    address: "0897 Mirror Park Boulevard",
    car_count: 2,
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
