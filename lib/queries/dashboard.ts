import { createClient } from "@/lib/supabase/server";

/**
 * Catalog coverage for the dashboard widget. Properties + Businesses are
 * scored against the in-game ownership cap (not the catalogue total) so the
 * % reflects "how close you are to maxing out what you can actually own".
 *
 * For each `ownership_group`:
 *   - `cap` = property_ownership_limits.max_owned IF set,
 *             else the count of OWNABLE catalogue rows in the group
 *             (excludes tower aggregator rows that have child units).
 *   - `owned` = distinct property_id rows the user owns in that group,
 *             clamped to `cap` so a misconfigured row can't push past 100%.
 *   - `ownableTotal` = total ownable catalogue rows in the group.
 *
 * The widget renders three "scope" totals (sum across groups) for the
 * collapsed view, and the `groups` list for the expanded view.
 */
export type CatalogRow = {
  ownedUnique: number;
  total: number;
  percent: number;
};

export type CatalogGroupDetail = {
  slug: string;
  label: string;
  isBusiness: boolean;
  cap: number;
  owned: number;
  ownableTotal: number;
  /** Catalogue rows in this group the user doesn't yet own (id + name).
   * Bounded — we don't need all 80+ apartments here; surface a useful chunk. */
  unowned: Array<{ id: string; display_name: string }>;
};

export type CatalogCoverage = {
  vehicles: CatalogRow;
  properties: CatalogRow;
  businesses: CatalogRow;
  groups: CatalogGroupDetail[];
};

// Human labels for known ownership_group slugs. Fallback for unknown slugs
// is a title-cased version of the slug, which is fine but less polished.
const GROUP_LABELS: Record<string, string> = {
  residential: "Apartments & standalone garages",
  "eclipse-blvd-garages": "Eclipse Blvd Garages",
  "vinewood-car-club": "Vinewood Car Club",
  "casino-penthouse": "Casino Penthouse",
  mansion: "Mansions",
  agency: "Agency",
  arcade: "Arcade",
  "arena-workshop": "Arena Workshop",
  "auto-shop": "Auto Shop",
  "bail-office": "Bail Office",
  "biker-business-cash": "Counterfeit Cash Factory",
  "biker-business-coke": "Cocaine Lockup",
  "biker-business-forgery": "Document Forgery Office",
  "biker-business-meth": "Meth Lab",
  "biker-business-weed": "Weed Farm",
  bunker: "Bunker",
  "cargo-warehouse": "Cargo Warehouses",
  "ceo-office": "CEO Office",
  facility: "Facility",
  "garment-factory": "Garment Factory",
  "hands-on-car-wash": "Hands On Car Wash",
  hangar: "Hangar",
  "higgins-helitours": "Higgins Helitours",
  "mc-clubhouse": "MC Clubhouse",
  "mckenzie-hangar": "McKenzie Field Hangar",
  nightclub: "Nightclub",
  "salvage-yard": "Salvage Yard",
  "smoke-on-the-water": "Smoke On The Water",
  "vehicle-warehouse": "Vehicle Warehouse",
  yacht: "Super Yacht",
};

function labelFor(slug: string): string {
  return GROUP_LABELS[slug] ?? slug
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

const BUSINESS_TYPE = "business";
const UNOWNED_LIMIT = 12;

export async function getCatalogCoverage(characterId: string): Promise<CatalogCoverage> {
  const supabase = await createClient();

  const [vehicleTotal, vehicleOwned, propRows, ownedRows, capRows] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }),
    supabase
      .from("user_owned_vehicles")
      .select("vehicle_id")
      .eq("character_id", characterId),
    supabase
      .from("properties")
      .select("id, display_name, ownership_group, property_type, parent_building"),
    supabase
      .from("user_owned_properties")
      .select("property_id")
      .eq("character_id", characterId),
    supabase
      .from("property_ownership_limits")
      .select("ownership_group, max_owned"),
  ]);

  if (vehicleTotal.error) throw vehicleTotal.error;
  if (vehicleOwned.error) throw vehicleOwned.error;
  if (propRows.error) throw propRows.error;
  if (ownedRows.error) throw ownedRows.error;
  if (capRows.error) throw capRows.error;

  // Vehicles — unique catalogue ids owned / catalogue total. No cap concept
  // (multi-instance allowed; fleet cap is per-account).
  const vTotal = vehicleTotal.count ?? 0;
  const vUnique = new Set(
    (vehicleOwned.data ?? []).map((r) => r.vehicle_id),
  ).size;
  const vehicles: CatalogRow = {
    ownedUnique: vUnique,
    total: vTotal,
    percent: vTotal === 0 ? 0 : Math.round((vUnique / vTotal) * 100),
  };

  // Tower rows have at least one child pointing at them via parent_building.
  // The tower itself isn't ownable — only its units are.
  const props = propRows.data ?? [];
  const towerIds = new Set<string>();
  for (const p of props) {
    if (p.parent_building) towerIds.add(p.parent_building);
  }
  const ownable = props.filter((p) => !towerIds.has(p.id));

  const capMap = new Map<string, number>();
  for (const c of capRows.data ?? []) {
    if (c.max_owned !== null) capMap.set(c.ownership_group, c.max_owned);
  }

  const ownedSet = new Set((ownedRows.data ?? []).map((r) => r.property_id));

  // Bucket ownable rows by ownership_group.
  type Bucket = {
    rows: Array<{ id: string; display_name: string }>;
    isBusiness: boolean;
  };
  const buckets = new Map<string, Bucket>();
  for (const p of ownable) {
    let b = buckets.get(p.ownership_group);
    if (!b) {
      b = { rows: [], isBusiness: p.property_type === BUSINESS_TYPE };
      buckets.set(p.ownership_group, b);
    }
    // If any row in the group is a business, the whole group is a business
    // bucket (matches the SQL bool_or logic).
    if (p.property_type === BUSINESS_TYPE) b.isBusiness = true;
    b.rows.push({ id: p.id, display_name: p.display_name });
  }

  const groups: CatalogGroupDetail[] = [];
  for (const [slug, bucket] of buckets) {
    const ownableTotal = bucket.rows.length;
    const cap = capMap.get(slug) ?? ownableTotal;
    const ownedRaw = bucket.rows.filter((r) => ownedSet.has(r.id)).length;
    const owned = Math.min(ownedRaw, cap);
    const unowned = bucket.rows
      .filter((r) => !ownedSet.has(r.id))
      .sort((a, b) => a.display_name.localeCompare(b.display_name))
      .slice(0, UNOWNED_LIMIT);
    groups.push({
      slug,
      label: labelFor(slug),
      isBusiness: bucket.isBusiness,
      cap,
      owned,
      ownableTotal,
      unowned,
    });
  }
  groups.sort((a, b) => a.label.localeCompare(b.label));

  const sumScope = (pred: (g: CatalogGroupDetail) => boolean): CatalogRow => {
    let total = 0;
    let owned = 0;
    for (const g of groups) {
      if (!pred(g)) continue;
      total += g.cap;
      owned += g.owned;
    }
    return {
      ownedUnique: owned,
      total,
      percent: total === 0 ? 0 : Math.round((owned / total) * 100),
    };
  };

  return {
    vehicles,
    properties: sumScope((g) => !g.isBusiness),
    businesses: sumScope((g) => g.isBusiness),
    groups,
  };
}
