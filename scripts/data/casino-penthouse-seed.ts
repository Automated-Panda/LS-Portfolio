import type { Property } from "../schema";

/**
 * GTA Online Casino Penthouse — Diamond Casino & Resort.
 * Single purchaseable unit; the garage is an add-on upgrade.
 *
 * Source: https://gta.fandom.com/wiki/Master_Penthouse
 */

export const CASINO_PENTHOUSE_SEED: Omit<Property, "image_path">[] = [
  {
    id: "casino-penthouse",
    display_name: "Master Penthouse",
    property_type: "residence",
    subtype: "casino-penthouse",
    subtype_display: "Casino Penthouse",
    location: "Diamond Casino & Resort, Vinewood Park Drive",
    neighborhood: "East Vinewood",
    capacity: 0,
    counts_as_garage: true,
    // Full floor-plan upgrades. The Lounge is the gating upgrade — every
    // other room (Spa, Bar, Cinema, Office, Extra Bedroom, Private Gaming)
    // requires it. Garage Access is independent and operates separately.
    upgrades: [
      {
        id: "casino-penthouse-garage",
        display_name: "Garage Access (10-car)",
        tier: null,
        capacity: 10,
        required_upgrade_id: null,
        notes: null,
        price: 900000,
      },
      {
        id: "casino-penthouse-lounge",
        display_name: "Lounge",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Gates the rest of the floor-plan upgrades (Spa, Bar, Cinema, Office, Extra Bedroom, Private Gaming).",
        price: 400000,
      },
      {
        id: "casino-penthouse-spa",
        display_name: "Spa",
        tier: null,
        capacity: 0,
        required_upgrade_id: "casino-penthouse-lounge",
        notes: null,
        price: 600000,
      },
      {
        id: "casino-penthouse-bar",
        display_name: "Bar & Party Area",
        tier: null,
        capacity: 0,
        required_upgrade_id: "casino-penthouse-lounge",
        notes: null,
        price: 700000,
      },
      {
        id: "casino-penthouse-cinema",
        display_name: "Media Room",
        tier: null,
        capacity: 0,
        required_upgrade_id: "casino-penthouse-lounge",
        notes: "Cinema for games + films.",
        price: 500000,
      },
      {
        id: "casino-penthouse-office",
        display_name: "Office",
        tier: null,
        capacity: 0,
        required_upgrade_id: "casino-penthouse-lounge",
        notes: "Includes gun locker and a hidden safe.",
        price: 200000,
      },
      {
        id: "casino-penthouse-extra-bedroom",
        display_name: "Extra Bedroom",
        tier: null,
        capacity: 0,
        required_upgrade_id: "casino-penthouse-lounge",
        notes: null,
        price: 200000,
      },
      {
        id: "casino-penthouse-private-gaming",
        display_name: "Private Gaming Table",
        tier: null,
        capacity: 0,
        required_upgrade_id: "casino-penthouse-lounge",
        notes: null,
        price: 1065000,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Master_Penthouse",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/master-penthouse-the-diamond",
    },
  },
];
