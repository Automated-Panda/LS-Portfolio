"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ToggleUpgradeResult =
  | { ok: true; installed: boolean }
  | { error: string };

export async function toggleUpgradeInstalled(
  ownedPropertyId: string,
  upgradeId: string,
): Promise<ToggleUpgradeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Verify the user owns this property (RLS would also catch this).
  const { data: ownership, error: ownErr } = await supabase
    .from("user_owned_properties")
    .select("id")
    .eq("id", ownedPropertyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (ownErr || !ownership) return { error: "Property not owned." };

  // Existing installation?
  const { data: existing } = await supabase
    .from("user_owned_property_upgrades")
    .select("id")
    .eq("user_owned_property_id", ownedPropertyId)
    .eq("property_upgrade_id", upgradeId)
    .maybeSingle();

  if (existing) {
    // Uninstall — but only if no dependent upgrades are installed.
    const { data: dependents } = await supabase
      .from("property_upgrades")
      .select("id, user_owned_property_upgrades!inner(id)")
      .eq("required_upgrade_id", upgradeId)
      .eq("user_owned_property_upgrades.user_owned_property_id", ownedPropertyId);
    if ((dependents ?? []).length > 0) {
      return {
        error: "Uninstall the dependent upgrades first.",
      };
    }
    const { error } = await supabase
      .from("user_owned_property_upgrades")
      .delete()
      .eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: true, installed: false };
  }

  // Install — verify prereq.
  const { data: upgrade } = await supabase
    .from("property_upgrades")
    .select("required_upgrade_id")
    .eq("id", upgradeId)
    .maybeSingle();
  if (upgrade?.required_upgrade_id) {
    const { data: hasParent } = await supabase
      .from("user_owned_property_upgrades")
      .select("id")
      .eq("user_owned_property_id", ownedPropertyId)
      .eq("property_upgrade_id", upgrade.required_upgrade_id)
      .maybeSingle();
    if (!hasParent) {
      return { error: "Install the required upgrade first." };
    }
  }

  const { error } = await supabase
    .from("user_owned_property_upgrades")
    .insert({
      user_owned_property_id: ownedPropertyId,
      property_upgrade_id: upgradeId,
    });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, installed: true };
}
