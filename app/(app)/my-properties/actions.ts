"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ToggleUpgradeResult =
  | { ok: true; installed: boolean }
  | { error: string };

export type SetAllUpgradesResult =
  | { ok: true; changed: number }
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

/**
 * Bulk-install or bulk-uninstall every upgrade for an owned property.
 * Prerequisites are ignored when bulk-installing (we insert them all in one
 * go, so the order doesn't matter — the constraint is satisfied by the time
 * any read happens). Bulk uninstall removes all rows for the property; no
 * dependency check since everything's being torn down together.
 */
export async function setAllUpgradesInstalled(
  ownedPropertyId: string,
  installed: boolean,
): Promise<SetAllUpgradesResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Verify ownership + get the underlying property_id so we know the upgrade catalog.
  const { data: ownership } = await supabase
    .from("user_owned_properties")
    .select("id, property_id")
    .eq("id", ownedPropertyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!ownership) return { error: "Property not owned." };

  if (!installed) {
    // Uninstall everything for this property.
    const { error, count } = await supabase
      .from("user_owned_property_upgrades")
      .delete({ count: "exact" })
      .eq("user_owned_property_id", ownedPropertyId);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: true, changed: count ?? 0 };
  }

  // Install every upgrade catalogued for this property. Upsert on the
  // composite unique key so already-installed rows are no-ops.
  const { data: catalog, error: catErr } = await supabase
    .from("property_upgrades")
    .select("id")
    .eq("property_id", ownership.property_id);
  if (catErr) return { error: catErr.message };

  const rows = (catalog ?? []).map((u) => ({
    user_owned_property_id: ownedPropertyId,
    property_upgrade_id: u.id,
  }));
  if (rows.length === 0) return { ok: true, changed: 0 };

  const { error } = await supabase
    .from("user_owned_property_upgrades")
    .upsert(rows, {
      onConflict: "user_owned_property_id,property_upgrade_id",
      ignoreDuplicates: true,
    });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, changed: rows.length };
}
