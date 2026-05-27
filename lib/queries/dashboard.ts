import { createClient } from "@/lib/supabase/server";

/**
 * Cap-based coverage rows for the dashboard Catalog widget.
 *
 * `total` is the maximum number of properties (or businesses) the user could
 * possibly own across all ownership groups — NOT the count of catalogue rows.
 * For each `ownership_group`:
 *   - if `property_ownership_limits.max_owned` is set → use that cap
 *   - else → fall back to the count of ownable catalogue rows in the group
 *     (excluding tower aggregator rows that have at least one child unit).
 *
 * `ownedUnique` is the user's distinct property_id count in that scope, capped
 * per-group so a buggy double-owned row doesn't push the bar above 100%.
 */
export type CatalogRow = {
  ownedUnique: number;
  total: number;
  percent: number;
};

export type CatalogCoverage = {
  vehicles: CatalogRow;
  properties: CatalogRow;
  businesses: CatalogRow;
};

type GroupRow = {
  ownership_group: string;
  is_business: boolean;
  cap: number;
  owned_in_group: number;
};

export async function getCatalogCoverage(userId: string): Promise<CatalogCoverage> {
  const supabase = await createClient();

  const [vehicleTotal, vehicleOwned, groupRows] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }),
    supabase
      .from("user_owned_vehicles")
      .select("vehicle_id")
      .eq("user_id", userId),
    supabase.rpc("dashboard_catalog_group_rows", { p_user_id: userId }),
  ]);

  if (vehicleTotal.error) throw vehicleTotal.error;
  if (vehicleOwned.error) throw vehicleOwned.error;
  if (groupRows.error) throw groupRows.error;

  // Vehicles row — unique catalogue ids owned / catalogue total. No cap concept
  // for vehicles (multi-instance allowed; fleet cap is per-account).
  const vTotal = vehicleTotal.count ?? 0;
  const vUnique = new Set(
    (vehicleOwned.data ?? []).map((r) => r.vehicle_id),
  ).size;
  const vehicles: CatalogRow = {
    ownedUnique: vUnique,
    total: vTotal,
    percent: vTotal === 0 ? 0 : Math.round((vUnique / vTotal) * 100),
  };

  const properties = sumRows(
    (groupRows.data ?? []) as GroupRow[],
    (g) => !g.is_business,
  );
  const businesses = sumRows(
    (groupRows.data ?? []) as GroupRow[],
    (g) => g.is_business,
  );

  return { vehicles, properties, businesses };
}

function sumRows(rows: GroupRow[], pred: (r: GroupRow) => boolean): CatalogRow {
  let total = 0;
  let owned = 0;
  for (const r of rows) {
    if (!pred(r)) continue;
    total += r.cap;
    // Per-group cap on owned so a misconfigured row can never push past 100%.
    owned += Math.min(r.owned_in_group, r.cap);
  }
  return {
    ownedUnique: owned,
    total,
    percent: total === 0 ? 0 : Math.round((owned / total) * 100),
  };
}
