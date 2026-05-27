import type { Property } from "../schema";

/**
 * GTA Online Galaxy Super Yacht — single purchasable property with 3 model variants.
 * Yachts are moored off the Pacific Ocean coast and cannot be driven.
 * They do NOT store ground vehicles (counts_as_garage: false).
 * The three variants (Aquarius, Orion, Pisces) are cosmetic model tiers.
 *
 * Sources:
 *   https://gta.fandom.com/wiki/Galaxy_Super_Yacht
 */

const YACHT_ID = "yacht-galaxy-super-yacht";

export const YACHTS_SEED: Omit<Property, "image_path">[] = [
  {
    id: YACHT_ID,
    display_name: "Galaxy Super Yacht",
    property_type: "business",
    subtype: "yacht",
    subtype_display: "Super Yacht",
    location: "Pacific Ocean (mobile)",
    neighborhood: null,
    capacity: 0,
    counts_as_garage: false,
    upgrades: [
      {
        id: `${YACHT_ID}-orion`,
        display_name: "Orion Model",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Entry-level ($6,000,000).",
      },
      {
        id: `${YACHT_ID}-pisces`,
        display_name: "Pisces Model",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Mid-tier ($7,000,000).",
      },
      {
        id: `${YACHT_ID}-aquarius`,
        display_name: "Aquarius Model",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Top-tier, premium ($8,000,000); includes hot tubs.",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Galaxy_Super_Yacht",
      gtabase: null,
    },
  },
];
