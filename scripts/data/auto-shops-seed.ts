import type { Property } from "../schema";

/**
 * GTA Online Auto Shops — 5 per-location instances.
 * Introduced in the Los Santos Tuners update.
 * Each can be upgraded with a customer car garage storing up to 10 vehicles.
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Auto_Shop
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
    id: "auto-shop-mission-row",
    display_name: "Mission Row Auto Shop",
    neighborhood: "Mission Row",
    address: "Mission Row, Los Santos",
  },
  {
    id: "auto-shop-la-mesa",
    display_name: "La Mesa Auto Shop",
    neighborhood: "La Mesa",
    address: "La Mesa, Los Santos",
  },
  {
    id: "auto-shop-strawberry",
    display_name: "Strawberry Auto Shop",
    neighborhood: "Strawberry",
    address: "Strawberry, Los Santos",
  },
  {
    id: "auto-shop-rancho",
    display_name: "Rancho Auto Shop",
    neighborhood: "Rancho",
    address: "Rancho, Los Santos",
  },
  {
    id: "auto-shop-burton",
    display_name: "Burton Auto Shop",
    neighborhood: "Burton",
    address: "Burton, Los Santos",
  },
];

function buildAutoShop(loc: LocationSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype: "auto-shop",
    subtype_display: "Auto Shop",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0,
    counts_as_garage: true,
    upgrades: [
      {
        id: `${loc.id}-garage`,
        display_name: "Auto Shop Garage",
        tier: null,
        capacity: 10,
        required_upgrade_id: null,
        notes: "Included with purchase; 10 customer car slots.",
      },
      {
        id: `${loc.id}-extra-car-lift`,
        display_name: "Additional Car Lift",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Extra service bay; increases job throughput ($650,000).",
      },
      {
        id: `${loc.id}-staff-1`,
        display_name: "Staff Member 1",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Speeds up vehicle mods + adds passive income ($385,000).",
      },
      {
        id: `${loc.id}-staff-2`,
        display_name: "Staff Member 2",
        tier: null,
        capacity: 0,
        required_upgrade_id: `${loc.id}-staff-1`,
        notes: "Second employee; requires Staff Member 1 ($385,000).",
      },
      {
        id: `${loc.id}-personal-quarters`,
        display_name: "Personal Quarters",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Wardrobe, gun locker, respawn point ($340,000).",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Auto_Shop",
      gtabase: null,
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const AUTO_SHOPS: Omit<Property, "image_path">[] =
  LOCATIONS.map(buildAutoShop);
