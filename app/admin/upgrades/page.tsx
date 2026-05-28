import { createClient } from "@/lib/supabase/server";

import { AdminUpgradesTable, type AdminUpgradeRow } from "./admin-upgrades-table";

export default async function AdminUpgradesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("property_upgrades")
    .select(
      "id, property_id, display_name, capacity, price, sort_order, properties(display_name)",
    )
    .order("property_id", { ascending: true })
    .order("sort_order", { ascending: true });
  if (error) throw error;

  type Row = NonNullable<typeof data>[number];
  const rows: AdminUpgradeRow[] = (data ?? []).map((r: Row) => {
    const p = Array.isArray(r.properties) ? r.properties[0] : r.properties;
    return {
      id: r.id,
      property_id: r.property_id,
      property_display_name: p?.display_name ?? r.property_id,
      display_name: r.display_name,
      capacity: r.capacity,
      price: r.price,
    };
  });
  // Stable sort by property name keeps each property's upgrades in sort_order.
  rows.sort((a, b) =>
    a.property_display_name.localeCompare(b.property_display_name),
  );

  return <AdminUpgradesTable rows={rows} />;
}
