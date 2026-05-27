// lib/queries/my-vehicles.ts
import { createClient } from "@/lib/supabase/server";
import { formatClass } from "@/lib/vehicles";

export type OwnedVehicleInstance = {
  id: string;                            // user_owned_vehicles.id (uuid)
  vehicle_id: string;
  display_name: string;
  class: string;
  manufacturer_display: string;
  image_path: string | null;
  price: number | null;                  // GTA Online purchase price in $, null if unsourced
  nickname: string | null;
  notes: string | null;
  custom_tags: string[];
  tag_ids: string[];                     // system tags from vehicle_tag_links
  storage: {
    owned_property_id: string;
    property_display_name: string;
    property_subtype_display: string;
    assigned_upgrade_id: string | null;
    upgrade_display_name: string | null;
  } | null;
};

export async function getOwnedVehicleInstances(
  userId: string,
): Promise<OwnedVehicleInstance[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_owned_vehicles")
    .select(`
      id, vehicle_id, nickname, notes, custom_tags,
      stored_in_property_id, assigned_upgrade_id,
      vehicles!inner (
        display_name, class, image_path, manufacturer_id, price,
        manufacturers ( display ),
        vehicle_tag_links ( tag_id )
      ),
      user_owned_properties!stored_in_property_id (
        properties!inner ( display_name, subtype_display )
      ),
      property_upgrades!assigned_upgrade_id ( display_name )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  type Row = NonNullable<typeof data>[number];

  return (data ?? []).map((row: Row) => {
    const v = Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles;
    const mfr = Array.isArray(v?.manufacturers)
      ? v?.manufacturers[0]
      : v?.manufacturers;
    const op = Array.isArray(row.user_owned_properties)
      ? row.user_owned_properties[0]
      : row.user_owned_properties;
    const opP = op
      ? Array.isArray(op.properties)
        ? op.properties[0]
        : op.properties
      : null;
    const up = Array.isArray(row.property_upgrades)
      ? row.property_upgrades[0]
      : row.property_upgrades;

    return {
      id: row.id,
      vehicle_id: row.vehicle_id,
      display_name: v?.display_name ?? "",
      class: formatClass(v?.class ?? ""),
      manufacturer_display: mfr?.display ?? "",
      image_path: v?.image_path ?? null,
      price: (v?.price ?? null) as number | null,
      nickname: row.nickname,
      notes: row.notes,
      custom_tags: row.custom_tags ?? [],
      tag_ids: (v?.vehicle_tag_links ?? []).map(
        (l: { tag_id: string }) => l.tag_id,
      ),
      storage: row.stored_in_property_id
        ? {
            owned_property_id: row.stored_in_property_id,
            property_display_name: opP?.display_name ?? "",
            property_subtype_display: opP?.subtype_display ?? "",
            assigned_upgrade_id: row.assigned_upgrade_id,
            upgrade_display_name: up?.display_name ?? null,
          }
        : null,
    };
  });
}
