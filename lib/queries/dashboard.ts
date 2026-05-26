import { createClient } from "@/lib/supabase/server";

export type CatalogTotals = {
  vehicles: number;
  properties: number;
};

/**
 * Counts of every vehicle and property row in the catalog. Used by the
 * dashboard Catalog widget to compute "owned unique types / catalog total".
 * No user filter, no joins — just two head-only counts.
 */
export async function getCatalogTotals(): Promise<CatalogTotals> {
  const supabase = await createClient();
  const [v, p] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }),
    supabase.from("properties").select("id", { count: "exact", head: true }),
  ]);
  if (v.error) throw v.error;
  if (p.error) throw p.error;
  return { vehicles: v.count ?? 0, properties: p.count ?? 0 };
}
