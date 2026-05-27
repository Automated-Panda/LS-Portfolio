"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

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

export type InstanceForPicker = {
  id: string;
  nickname: string | null;
  created_at: string;
  storage_label: string | null; // "Mansion · Driveway" if assigned, else null
};

/**
 * Returns the current user's owned instances of a given vehicle, ordered
 * oldest-first. Used by the `-` picker on /vehicles cards.
 */
export async function getOwnedInstancesForVehicle(
  vehicleId: string,
): Promise<InstanceForPicker[] | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error } = await supabase
    .from("user_owned_vehicles")
    .select(
      `id, nickname, created_at,
       user_owned_properties!stored_in_property_id (
         properties!inner ( display_name )
       ),
       property_upgrades!assigned_upgrade_id ( display_name )`,
    )
    .eq("user_id", user.id)
    .eq("vehicle_id", vehicleId)
    .order("created_at", { ascending: true });

  if (error) return { error: error.message };

  type Row = NonNullable<typeof data>[number];
  return (data ?? []).map((row: Row) => {
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
    const storageLabel = opP
      ? up
        ? `${opP.display_name} · ${up.display_name}`
        : opP.display_name
      : null;

    return {
      id: row.id,
      nickname: row.nickname,
      created_at: row.created_at,
      storage_label: storageLabel,
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
