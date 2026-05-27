"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { formatClass } from "@/lib/vehicles";

type Result = { ok: true; removed: number } | { error: string };

/**
 * Coarse vehicle bucket. Matches `assetCategoryOf()` in lib/vehicles.ts:
 *   "land" = cars + bikes + cycles + everything else
 *   "air"  = planes + helicopters
 *   "sea"  = boats + submarines
 */
type VehicleCategory = "land" | "air" | "sea";

function classToCategory(rawClass: string): VehicleCategory {
  const c = formatClass(rawClass);
  if (c === "Plane" || c === "Helicopter") return "air";
  if (c === "Boat" || c === "Submarine" || c === "Blimp") return "sea";
  return "land";
}

export async function removeAllVehiclesByCategory(
  category: VehicleCategory,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Fetch all instances with their vehicle class, filter by category in JS,
  // then delete in one DELETE...IN() statement.
  const { data: rows, error: selErr } = await supabase
    .from("user_owned_vehicles")
    .select("id, vehicles!inner(class)")
    .eq("user_id", user.id);
  if (selErr) return { error: selErr.message };

  type Row = {
    id: string;
    vehicles: { class: string } | { class: string }[] | null;
  };

  const ids = (rows ?? [])
    .filter((r: Row) => {
      const v = Array.isArray(r.vehicles) ? r.vehicles[0] : r.vehicles;
      return v ? classToCategory(v.class) === category : false;
    })
    .map((r) => r.id);

  if (ids.length === 0) return { ok: true, removed: 0 };

  const { error: delErr } = await supabase
    .from("user_owned_vehicles")
    .delete()
    .in("id", ids);
  if (delErr) return { error: delErr.message };

  revalidatePath("/", "layout");
  return { ok: true, removed: ids.length };
}

export async function removeAllPropertiesByGroup(
  ownershipGroup: string,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Find owned properties whose property_id belongs to a group matching the
  // filter, then delete those user_owned_properties rows. Cascades handle
  // user_owned_property_upgrades. user_owned_vehicles.stored_in_property_id
  // is ON DELETE SET NULL so vehicles get unassigned, not deleted.
  const { data: rows, error: selErr } = await supabase
    .from("user_owned_properties")
    .select("id, properties!inner(ownership_group)")
    .eq("user_id", user.id);
  if (selErr) return { error: selErr.message };

  type Row = {
    id: string;
    properties:
      | { ownership_group: string }
      | { ownership_group: string }[]
      | null;
  };

  const ids = (rows ?? [])
    .filter((r: Row) => {
      const p = Array.isArray(r.properties) ? r.properties[0] : r.properties;
      return p?.ownership_group === ownershipGroup;
    })
    .map((r) => r.id);

  if (ids.length === 0) return { ok: true, removed: 0 };

  const { error: delErr } = await supabase
    .from("user_owned_properties")
    .delete()
    .in("id", ids);
  if (delErr) return { error: delErr.message };

  revalidatePath("/", "layout");
  return { ok: true, removed: ids.length };
}

/**
 * Wipe every owned vehicle, property, and organizer plan for the current
 * user. Profile row + auth user are untouched.
 */
export async function resetAllOwnership(): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Count first so we can report what was wiped.
  const [{ count: vCount }, { count: pCount }, { count: planCount }] =
    await Promise.all([
      supabase
        .from("user_owned_vehicles")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("user_owned_properties")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("organizer_plans")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

  const total = (vCount ?? 0) + (pCount ?? 0) + (planCount ?? 0);
  if (total === 0) return { ok: true, removed: 0 };

  // Delete in dependency order. Vehicles first (so storage refs disappear
  // before properties go), then properties, then plans.
  const [vDel, pDel, plDel] = await Promise.all([
    supabase.from("user_owned_vehicles").delete().eq("user_id", user.id),
    supabase.from("user_owned_properties").delete().eq("user_id", user.id),
    supabase.from("organizer_plans").delete().eq("user_id", user.id),
  ]);

  if (vDel.error) return { error: vDel.error.message };
  if (pDel.error) return { error: pDel.error.message };
  if (plDel.error) return { error: plDel.error.message };

  revalidatePath("/", "layout");
  return { ok: true, removed: total };
}
