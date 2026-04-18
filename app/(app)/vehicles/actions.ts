"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ToggleResult = {
  vehicleId: string;
  owned: boolean;
  error?: string;
};

export async function toggleVehicleOwnership(
  vehicleId: string,
): Promise<ToggleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { vehicleId, owned: false, error: "Not signed in." };
  }

  const { data: existing, error: selectErr } = await supabase
    .from("user_owned_vehicles")
    .select("id")
    .eq("user_id", user.id)
    .eq("vehicle_id", vehicleId);

  if (selectErr) {
    return { vehicleId, owned: false, error: selectErr.message };
  }

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from("user_owned_vehicles")
      .delete()
      .eq("user_id", user.id)
      .eq("vehicle_id", vehicleId);

    if (error) return { vehicleId, owned: true, error: error.message };
    revalidatePath("/", "layout");
    return { vehicleId, owned: false };
  }

  const { error } = await supabase
    .from("user_owned_vehicles")
    .insert({ user_id: user.id, vehicle_id: vehicleId });

  if (error) return { vehicleId, owned: false, error: error.message };
  revalidatePath("/", "layout");
  return { vehicleId, owned: true };
}
