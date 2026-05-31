// lib/marketing/stats.ts
import { createClient } from "@/lib/supabase/server";

export type MarketingStats = {
  vehicles: number;
  properties: number; // non-business ownable
  businesses: number; // business-type ownable
};

/**
 * Live catalogue counts for the marketing stat bar. Counts catalogue rows
 * (what GT Vault can track), not user-owned rows. Businesses are split out by
 * property_type to match the rest of the app.
 *
 * Mirrors the dashboard's coverage query (lib/queries/dashboard.ts): apartment
 * "tower" rows are aggregator shells (their units carry parent_building) and
 * aren't themselves ownable, so they're excluded — otherwise the property
 * count would disagree with what the app reports.
 */
export async function getMarketingStats(): Promise<MarketingStats> {
  const supabase = await createClient();

  const [vehiclesRes, propsRes] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }),
    supabase.from("properties").select("id, property_type, parent_building"),
  ]);

  const vehicles = vehiclesRes.count ?? 0;

  const rows = propsRes.data ?? [];
  // Any row referenced as a parent is a non-ownable tower shell.
  const towerIds = new Set(
    rows.map((r) => r.parent_building).filter((id): id is string => Boolean(id)),
  );

  let properties = 0;
  let businesses = 0;
  for (const row of rows) {
    if (towerIds.has(row.id)) continue; // skip aggregator shells
    if (row.property_type === "business") businesses += 1;
    else properties += 1;
  }

  return { vehicles, properties, businesses };
}
