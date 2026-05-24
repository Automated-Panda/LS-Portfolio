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
