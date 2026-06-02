import { createAdminClient } from "@/lib/supabase/admin";
import type { AvailabilityStatus, VehicleVendor } from "@/lib/vehicles";

import { AdminVehiclesTable, type AdminVehicleRow } from "./admin-vehicles-table";

export default async function AdminVehiclesPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select(
      "id, display_name, class, manufacturer_id, price, availability, vendors, image_path, status, manufacturers(display)",
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
      image_path: r.image_path,
      status: r.status ?? "published",
    };
  });

  return <AdminVehiclesTable rows={rows} />;
}
