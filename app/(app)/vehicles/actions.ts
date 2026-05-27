"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import { formatClass } from "@/lib/vehicles";

export type AddInstanceResult = {
  vehicleId: string;
  createdInstanceId?: string;
  error?: string;
};

export async function addVehicleInstance(
  vehicleId: string,
): Promise<AddInstanceResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { vehicleId, error: "Not signed in." };
  }

  const { data, error } = await supabase
    .from("user_owned_vehicles")
    .insert({ user_id: user.id, vehicle_id: vehicleId })
    .select("id")
    .single();

  if (error) return { vehicleId, error: error.message };

  revalidatePath("/", "layout");
  return { vehicleId, createdInstanceId: data.id };
}

/**
 * Returns the user's owned instances of a vehicle as full OwnedVehicleInstance
 * records — same shape as /my-vehicles uses — so the /vehicles popover can
 * pass them straight into InstanceDrawer for inline management (nickname,
 * custom tags, notes, storage). Scoped to the signed-in user's vehicle_id
 * and ordered oldest-first.
 */
export async function getOwnedInstancesForVehicle(
  vehicleId: string,
): Promise<OwnedVehicleInstance[] | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("user_owned_vehicles")
    .select(`
      id, vehicle_id, nickname, notes, custom_tags,
      stored_in_property_id, assigned_upgrade_id, sub_slot,
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
    .eq("user_id", user.id)
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };

  type Row = NonNullable<typeof data>[number];
  return (data ?? []).map((row: Row): OwnedVehicleInstance => {
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
            sub_slot: row.sub_slot ?? null,
          }
        : null,
    };
  });
}

/** Remove a specific user_owned_vehicles row by id. Used by the `-` picker. */
export async function removeOwnedInstance(
  instanceId: string,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("user_owned_vehicles")
    .delete()
    .eq("id", instanceId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
