import type { Property } from "../schema";

/**
 * Aviation-themed SP (story mode) businesses.
 *
 * ⚠️  BOTH properties are GTA V single-player only.
 *     Neither is purchasable in GTA Online.
 *     They are included because GT Vault tracks all GTA V assets,
 *     including story-mode businesses owned by Franklin, Michael, or Trevor.
 *
 * McKenzie Field Hangar (GTA Online)
 *   Grapeseed airstrip property, added to GTA Online on 4 March 2025
 *   (Oscar Guzman Flies Again). A standalone aircraft-storage business with
 *   20 personal aircraft slots and built-in living quarters; no paid upgrades.
 *   Ownable independently of (and alongside) a regular Hangar.
 *   Sources:
 *     https://gta.fandom.com/wiki/McKenzie_Field_Hangar_(GTA_Online)
 *     https://rockstarintel.com/gta-online-mckenzie-field-hangar-price-details/
 *
 * Higgins Helitours
 *   LSIA helipad / helicopter tour business. Any protagonist can purchase.
 *   Revenue comes from passive helicopter-tour income after purchase.
 *   Stores the two tour helicopters on-site (helipad, not enclosed hangar).
 *   Sources:
 *     https://gta.fandom.com/wiki/Higgins_Helitours
 */

// ---------------------------------------------------------------------------
// McKenzie Field Hangar
// ---------------------------------------------------------------------------

const MCKENZIE_ID = "mckenzie-field-hangar";

export const MCKENZIE_HANGAR_SEED: Omit<Property, "image_path">[] = [
  {
    id: MCKENZIE_ID,
    display_name: "McKenzie Field Hangar",
    property_type: "business",
    subtype: "mckenzie-hangar",
    subtype_display: "McKenzie Hangar",
    // Grapeseed airstrip, east of the town of Grapeseed near the Alamo Sea.
    location: "McKenzie Field, Grapeseed",
    neighborhood: "Grapeseed",
    // GTA Online purchase price via Maze Bank Foreclosures ($1,000,000 for GTA+).
    price: 1475000,
    capacity: 0,
    // Stores personal aircraft, like a regular Hangar (counts_as_garage is
    // false: aircraft, not cars — matches the `hangar` subtype rows).
    counts_as_garage: false,
    upgrades: [
      {
        id: `${MCKENZIE_ID}-hangar-storage`,
        display_name: "Hangar Storage",
        tier: null,
        // 20 personal aircraft slots, included with purchase.
        capacity: 20,
        required_upgrade_id: null,
        notes:
          "Stores personal aircraft (20 total). Included with purchase; " +
          "no separate upgrade cost. Ownable alongside a regular Hangar.",
        price: 0,
        included_on_purchase: true,
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/McKenzie_Field_Hangar_(GTA_Online)",
      gtabase: null,
    },
  },
];

// ---------------------------------------------------------------------------
// Higgins Helitours
// ---------------------------------------------------------------------------

const HELITOURS_ID = "higgins-helitours";

export const HIGGINS_HELITOURS_SEED: Omit<Property, "image_path">[] = [
  {
    id: HELITOURS_ID,
    display_name: "Higgins Helitours",
    property_type: "business",
    subtype: "higgins-helitours",
    subtype_display: "Higgins Helitours",
    // Located at the south-east edge of Los Santos International Airport.
    location: "LSIA, La Puerta, Los Santos",
    neighborhood: "La Puerta",
    // Purchase price: GTA$1,620,000 (story mode Eyefind listing).
    price: 1620000,
    capacity: 0,
    // Two Mavericks sit on the external helipad. The property has no enclosed
    // hangar structure, so counts_as_garage is false — aircraft are exposed
    // on a helipad, not stored.
    counts_as_garage: false,
    upgrades: [
      {
        id: `${HELITOURS_ID}-helipad`,
        display_name: "Helipad",
        tier: null,
        // The two tour Mavericks are business assets, not player storage —
        // you cannot park your own aircraft here, so capacity is 0.
        capacity: 0,
        required_upgrade_id: null,
        notes:
          "Open helipad with two tour Mavericks. Included with purchase. " +
          "Generates passive income from tour operations. Not personal storage.",
        price: 0,
        included_on_purchase: true,
      },
    ],
    // SP-only — no GTA Online equivalent.
    verify: true,
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Higgins_Helitours",
      gtabase: null,
    },
  },
];
