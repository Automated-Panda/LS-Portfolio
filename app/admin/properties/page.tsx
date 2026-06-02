import { createAdminClient } from "@/lib/supabase/admin";

import {
  AdminPropertiesTable,
  type AdminPropertyRow,
} from "./admin-properties-table";

export default async function AdminPropertiesPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, display_name, property_type, subtype, subtype_display, neighborhood, capacity, counts_as_garage, price, image_path, status",
    )
    .order("display_name", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as AdminPropertyRow[];
  return <AdminPropertiesTable rows={rows} />;
}
