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
 */
export async function getMarketingStats(): Promise<MarketingStats> {
  const supabase = await createClient();

  const [vehiclesRes, propsRes] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }),
    supabase.from("properties").select("property_type"),
  ]);

  const vehicles = vehiclesRes.count ?? 0;

  let properties = 0;
  let businesses = 0;
  for (const row of propsRes.data ?? []) {
    if (row.property_type === "business") businesses += 1;
    else properties += 1;
  }

  return { vehicles, properties, businesses };
}
