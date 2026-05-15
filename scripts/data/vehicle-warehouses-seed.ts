import type { Property } from "../schema";

/**
 * GTA Online Vehicle Warehouses — 5 per-location instances.
 * Used for CEO Special Cargo (Import/Export) missions.
 * Each warehouse stores up to 40 source vehicles.
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Vehicle_Warehouse
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
      gtabase: null,
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const VEHICLE_WAREHOUSES: Omit<Property, "image_path">[] =
  LOCATIONS.map(buildVehicleWarehouse);
