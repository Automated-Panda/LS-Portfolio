import type { Property } from "../schema";

/**
 * Aviation-themed SP (story mode) businesses.
 *
 * ⚠️  BOTH properties are GTA V single-player only.
 *     Neither is purchasable in GTA Online.
 *     They are included because GT Vault tracks all GTA V assets,
 *     including story-mode businesses owned by Franklin, Michael, or Trevor.
 *
 * McKenzie Field Hangar
 *   Trevor Philips Enterprises acquisition. Dirt-strip airfield in Grapeseed
 *   used for arms/drug air-freight missions (Tinkle / Makoute / Chem contracts).
 *   Stores small fixed-wing aircraft. Introduced in base GTA V (2013).
 *   Sources:
 *     https://gta.fandom.com/wiki/McKenzie_Field_Hangar
 *     https://gta.fandom.com/wiki/Trevor_Philips_Enterprises
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
    // Purchase price: GTA$150,000 (paid to Oscar Guzman via Trevor's phone).
    price: 150000,
    capacity: 0,
    // Stores small fixed-wing aircraft (crop-dusters, Velums, etc.) in the
    // open-sided corrugated hangar at the airstrip.
    counts_as_garage: true,
    upgrades: [
      {
        id: `${MCKENZIE_ID}-hangar-storage`,
        display_name: "Hangar Storage",
        tier: null,
        // Accommodates a handful of small planes; exact slot count unconfirmed.
        capacity: 4,
        required_upgrade_id: null,
        notes:
          "Open-sided dirt-strip hangar. Stores small fixed-wing aircraft " +
          "(crop-dusters, Velums). Included with purchase; no separate upgrade cost.",
        price: 0,
        included_on_purchase: true,
      },
    ],
    // SP-only — no GTA Online equivalent.
    verify: true,
    _sources: {
      fandom: "https://gta.fandom.com/wiki/McKenzie_Field_Hangar",
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
