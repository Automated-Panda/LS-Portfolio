import { createClient } from "@/lib/supabase/server";

import {
  AdminPropertiesTable,
  type AdminPropertyRow,
} from "./admin-properties-table";

export default async function AdminPropertiesPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, display_name, property_type, subtype, subtype_display, neighborhood, capacity, counts_as_garage, price",
    )
    .order("display_name", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as AdminPropertyRow[];
  return <AdminPropertiesTable rows={rows} />;
}
