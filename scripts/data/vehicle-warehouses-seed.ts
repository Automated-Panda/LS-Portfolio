import type { Property } from "../schema";

/**
 * GTA Online Vehicle Warehouses — per-location instances.
 * Used for CEO Special Cargo (Import/Export) missions.
 * Each warehouse stores up to 40 source vehicles.
 *
 * NOTE 2026-05-27: gtabase actually lists 9 warehouses in the current game
 * (Murrieta Heights, La Mesa, La Puerta, Davis, Cypress Flats, LSIA,
 * LSIA 2, El Burro Heights, Elysian Island). We currently seed 6 (the
 * original 5 + LSIA). The other 3 are flagged as a follow-up in notes.md.
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Vehicle_Warehouse
 *   https://www.gtabase.com/grand-theft-auto-v/guides/property-types/vehicle-warehouses
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
    id: "vehicle-warehouse-murrieta-heights",
    display_name: "Murrieta Heights Vehicle Warehouse",
    neighborhood: "Murrieta Heights",
    address: "Murrieta Heights, Los Santos",
  },
  {
    id: "vehicle-warehouse-la-mesa",
    display_name: "La Mesa Vehicle Warehouse",
    neighborhood: "La Mesa",
    address: "La Mesa, Los Santos",
  },
  {
    id: "vehicle-warehouse-la-puerta",
    display_name: "La Puerta Vehicle Warehouse",
    neighborhood: "La Puerta",
    address: "La Puerta, Los Santos",
  },
  {
    id: "vehicle-warehouse-davis",
    display_name: "Davis Vehicle Warehouse",
    neighborhood: "Davis",
    address: "Davis, Los Santos",
  },
  {
    id: "vehicle-warehouse-cypress-flats",
    display_name: "Cypress Flats Vehicle Warehouse",
    neighborhood: "Cypress Flats",
    address: "Cypress Flats, Los Santos",
  },
  {
    id: "vehicle-warehouse-lsia",
    display_name: "LSIA Vehicle Warehouse",
    neighborhood: "Los Santos International Airport",
    address: "Los Santos International Airport, South Los Santos",
  },
];

function buildVehicleWarehouse(loc: LocationSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype: "vehicle-warehouse",
    subtype_display: "Vehicle Warehouse",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0,
    counts_as_garage: true,
    upgrades: [
      {
        id: `${loc.id}-storage`,
        display_name: "Vehicle Warehouse Storage",
        tier: null,
        capacity: 40,
        required_upgrade_id: null,
        notes:
          "Stores up to 40 source vehicles for CEO Special Cargo missions",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Vehicle_Warehouse",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/properties/gta-online/lsia-vehicle-warehouse",
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const VEHICLE_WAREHOUSES: Omit<Property, "image_path">[] =
  LOCATIONS.map(buildVehicleWarehouse);
