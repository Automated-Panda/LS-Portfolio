"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ToggleResult = {
  propertyId: string;
  owned: boolean;
  error?: string;
};

export async function togglePropertyOwnership(
  propertyId: string,
): Promise<ToggleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { propertyId, owned: false, error: "Not signed in." };
  }

  const { data: existing, error: selectErr } = await supabase
    .from("user_owned_properties")
    .select("id")
    .eq("user_id", user.id)
    .eq("property_id", propertyId);

  if (selectErr) {
    return { propertyId, owned: false, error: selectErr.message };
  }

  if (existing && existing.length > 0) {
    const { error } = await supabase
      .from("user_owned_properties")
      .delete()
      .eq("user_id", user.id)
      .eq("property_id", propertyId);

    if (error) return { propertyId, owned: true, error: error.message };
    revalidatePath("/", "layout");
    return { propertyId, owned: false };
  }

  const { error } = await supabase
    .from("user_owned_properties")
    .insert({ user_id: user.id, property_id: propertyId });

  if (error) return { propertyId, owned: false, error: error.message };
  revalidatePath("/", "layout");
  return { propertyId, owned: true };
}
