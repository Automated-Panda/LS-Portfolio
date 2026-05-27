import type { Property } from "../schema";

/**
 * GTA Online Special Cargo Warehouses — distinct from Vehicle Warehouses.
 * Used for CEO Special Cargo (crate import/export) missions. Hold crates,
 * not cars, so capacity=0 and counts_as_garage=false. Crate counts per
 * size are baked into the subtype_display so users see them at a glance.
 *
 *   Small  — 16 crates · 6 instances
 *   Medium — 42 crates · 8 instances
 *   Large  — 111 crates · 8 instances
 *
 * Ownership: all sizes share the `cargo-warehouse` ownership_group, capped
 * at 5 total owned (in-game maximum, regardless of size mix). See
 * import-seed.ts CARGO_WAREHOUSE_POOL and migration 0011.
 *
 * Per-instance addresses are not in the canonical sources (gtabase lists
 * names + prices but not neighborhoods); flagging all as verify:true for
 * a future address audit pass.
 *
 * Sources:
 *   https://www.gtabase.com/grand-theft-auto-v/guides/property-types/warehouses
 *   https://gta.fandom.com/wiki/Warehouses
 */

type Size = "small" | "medium" | "large";

const SIZE_DISPLAY: Record<Size, string> = {
  small: "Small Warehouse",
  medium: "Medium Warehouse",
  large: "Large Warehouse",
};

type WarehouseSeed = {
  id: string;          // e.g. "cargo-warehouse-foreclosed-garage"
  slug: string;        // gtabase slug (used for image URL)
  display_name: string;
  size: Size;
  neighborhood?: string;
};

const SMALL_WAREHOUSES: WarehouseSeed[] = [
  { id: "cargo-warehouse-convenience-store-lockup", slug: "convenience-store-lockup", display_name: "Convenience Store Lockup", size: "small" },
  { id: "cargo-warehouse-celltowa-unit",            slug: "celltowa-unit",            display_name: "Celltowa Unit",            size: "small" },
  { id: "cargo-warehouse-white-widow-garage",       slug: "white-widow-garage",       display_name: "White Widow Garage",       size: "small" },
  { id: "cargo-warehouse-pacific-bait-storage",     slug: "pacific-bait-storage",     display_name: "Pacific Bait Storage",     size: "small" },
  { id: "cargo-warehouse-pier-400-utility-building", slug: "pier-400-utility-building", display_name: "Pier 400 Utility Building", size: "small" },
  { id: "cargo-warehouse-foreclosed-garage",        slug: "foreclosed-garage",        display_name: "Foreclosed Garage",        size: "small" },
];

const MEDIUM_WAREHOUSES: WarehouseSeed[] = [
  { id: "cargo-warehouse-gee-warehouse",            slug: "gee-warehouse",            display_name: "GEE Warehouse",            size: "medium", neighborhood: "El Burro Heights" },
  { id: "cargo-warehouse-derriere-lingerie-backlot", slug: "derriere-lingerie-backlot", display_name: "Derriere Lingerie Backlot", size: "medium" },
  { id: "cargo-warehouse-fridgit-annexe",           slug: "fridgit-annexe",           display_name: "Fridgit Annexe",           size: "medium" },
  { id: "cargo-warehouse-discount-retail-unit",     slug: "discount-retail-unit",     display_name: "Discount Retail Unit",     size: "medium", neighborhood: "Vinewood Downtown" },
  { id: "cargo-warehouse-disused-factory-outlet",   slug: "disused-factory-outlet",   display_name: "Disused Factory Outlet",   size: "medium" },
  { id: "cargo-warehouse-ls-marine-building-3",     slug: "ls-marine-building-3",     display_name: "LS Marine Building 3",     size: "medium", neighborhood: "Elysian Island" },
  { id: "cargo-warehouse-old-power-station",        slug: "old-power-station",        display_name: "Old Power Station",        size: "medium" },
  { id: "cargo-warehouse-railyard-warehouse",       slug: "railyard-warehouse",       display_name: "Railyard Warehouse",       size: "medium", neighborhood: "La Mesa" },
];

const LARGE_WAREHOUSES: WarehouseSeed[] = [
  { id: "cargo-warehouse-wholesale-furniture",      slug: "wholesale-furniture",      display_name: "Wholesale Furniture",      size: "large" },
  { id: "cargo-warehouse-west-vinewood-backlot",    slug: "west-vinewood-backlot",    display_name: "West Vinewood Backlot",    size: "large" },
  { id: "cargo-warehouse-xero-gas-factory",         slug: "xero-gas-factory",         display_name: "Xero Gas Factory",         size: "large" },
  { id: "cargo-warehouse-logistics-depot",          slug: "logistics-depot",          display_name: "Logistics Depot",          size: "large" },
  { id: "cargo-warehouse-bilgeco-warehouse",        slug: "bilgeco-warehouse",        display_name: "Bilgeco Warehouse",        size: "large" },
  { id: "cargo-warehouse-walker-sons-warehouse",    slug: "walker-sons-warehouse",    display_name: "Walker & Sons Warehouse",  size: "large", neighborhood: "Banning" },
  { id: "cargo-warehouse-cypress-warehouses",       slug: "cypress-warehouses",       display_name: "Cypress Warehouses",       size: "large" },
  { id: "cargo-warehouse-darnel-bros-warehouse",    slug: "darnel-bros-warehouse",    display_name: "Darnel Bros Warehouse",    size: "large" },
];

const ALL_WAREHOUSES = [
  ...SMALL_WAREHOUSES,
  ...MEDIUM_WAREHOUSES,
  ...LARGE_WAREHOUSES,
];

function buildCargoWarehouse(w: WarehouseSeed): Omit<Property, "image_path"> {
  return {
    id: w.id,
    display_name: w.display_name,
    property_type: "business",
    subtype: `cargo-warehouse-${w.size}`,
    subtype_display: SIZE_DISPLAY[w.size],
    location: w.neighborhood ? `${w.neighborhood}, Los Santos` : null,
    neighborhood: w.neighborhood ?? null,
    // Cargo Warehouses hold crates (Special Cargo), not vehicles.
    capacity: 0,
    counts_as_garage: false,
    upgrades: [
      {
        id: `${w.id}-interior-style`,
        display_name: "Interior Style",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Cosmetic — 3 options: Basic (included) / Worn / Branded.",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Warehouses",
      gtabase: `https://www.gtabase.com/grand-theft-auto-v/properties/gta-online/${w.slug}`,
    },
    // verify on rows where we don't yet have a confirmed neighborhood.
    ...(w.neighborhood ? {} : { verify: true }),
  };
}

export const CARGO_WAREHOUSES: Omit<Property, "image_path">[] =
  ALL_WAREHOUSES.map(buildCargoWarehouse);

/** Subtypes that should pool into the single `cargo-warehouse` ownership_group. */
export const CARGO_WAREHOUSE_SUBTYPES = new Set([
  "cargo-warehouse-small",
  "cargo-warehouse-medium",
  "cargo-warehouse-large",
]);

/** Map each warehouse seed id → its gtabase slug for the image fetcher. */
export const CARGO_WAREHOUSE_GTABASE_SLUG: Record<string, string> =
  Object.fromEntries(ALL_WAREHOUSES.map((w) => [w.id, w.slug]));
