import { createClient } from "@/lib/supabase/server";
import type { AvailabilityStatus, VehicleVendor } from "@/lib/vehicles";

import { AdminVehiclesTable, type AdminVehicleRow } from "./admin-vehicles-table";

export default async function AdminVehiclesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select(
      "id, display_name, class, manufacturer_id, price, availability, vendors, manufacturers(display)",
    )
    .order("display_name", { ascending: true });
  if (error) throw error;

  type Row = NonNullable<typeof data>[number];
  const rows: AdminVehicleRow[] = (data ?? []).map((r: Row) => {
    const m = Array.isArray(r.manufacturers) ? r.manufacturers[0] : r.manufacturers;
    return {
      id: r.id,
      display_name: r.display_name,
      class: r.class,
      manufacturer_display: m?.display ?? "",
      price: r.price,
      availability: (r.availability ?? "available") as AvailabilityStatus,
      vendors: (r.vendors ?? []) as VehicleVendor[],
    };
  });

  return <AdminVehiclesTable rows={rows} />;
}
