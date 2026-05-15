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
    upgrades: [
      {
        id: "casino-penthouse-garage",
        display_name: "Penthouse Garage",
        tier: null,
        capacity: 10,
        required_upgrade_id: null,
        notes: null,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Master_Penthouse",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/casino-penthouse",
    },
  },
];
