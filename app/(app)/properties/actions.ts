"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getOwnershipGroupStatus } from "@/lib/queries/ownership";

export type ToggleResult =
  | { ok: true; ownedPropertyId: string }
  | { ok: false; removed: true }
  | {
      needsTradeIn: {
        group: string;
        currentlyOwned: Array<{ id: string; display_name: string; car_count: number }>;
        newProperty: { id: string; display_name: string; capacity: number };
      };
    }
  | { error: string };

export async function togglePropertyOwnership(
  propertyId: string,
): Promise<ToggleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Already owned → un-own (no car relocation here; this path is for the
  // /properties browse "Owned" toggle on a property that's the sole owned in
  // its group. Cars get cleared via ON DELETE SET NULL).
  const { data: existing } = await supabase
    .from("user_owned_properties")
    .select("id")
    .eq("user_id", user.id)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("user_owned_properties")
      .delete()
      .eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: false, removed: true };
  }

  // Look up the new property's ownership_group + capacity.
  const { data: prop, error: propErr } = await supabase
    .from("properties")
    .select("display_name, capacity, ownership_group")
    .eq("id", propertyId)
    .single();
  if (propErr || !prop) return { error: propErr?.message ?? "Property not found." };

  const status = await getOwnershipGroupStatus(user.id, prop.ownership_group);

  if (status.atLimit) {
    // Fetch current owned in this group with car counts.
    const { data: rows, error: rowErr } = await supabase
      .from("user_owned_properties")
      .select(`
        id,
        properties!inner ( display_name, ownership_group ),
        user_owned_vehicles!stored_in_property_id ( id )
      `)
      .eq("user_id", user.id)
      .eq("properties.ownership_group", prop.ownership_group);
    if (rowErr) return { error: rowErr.message };

    type Row = NonNullable<typeof rows>[number];
    const currentlyOwned = (rows ?? []).map((r: Row) => {
      const p = Array.isArray(r.properties) ? r.properties[0] : r.properties;
      return {
        id: r.id,
        display_name: p?.display_name ?? "",
        car_count: (r.user_owned_vehicles ?? []).length,
      };
    });

    return {
      needsTradeIn: {
        group: prop.ownership_group,
        currentlyOwned,
        newProperty: {
          id: propertyId,
          display_name: prop.display_name,
          capacity: prop.capacity,
        },
      },
    };
  }

  // Under limit → insert directly.
  const { data, error } = await supabase
    .from("user_owned_properties")
    .insert({ user_id: user.id, property_id: propertyId })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, ownedPropertyId: data.id };
}

export type TradeInArgs = {
  newPropertyId: string;
  tradeInOwnedPropertyId: string;
  carDestinations: Array<{
    ownedVehicleId: string;
    action: "move" | "unassign";
  }>;
};

export async function tradeInProperty(
  args: TradeInArgs,
): Promise<{ ok: true; newOwnedPropertyId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // 1. Insert new owned property row.
  const { data: newRow, error: newErr } = await supabase
    .from("user_owned_properties")
    .insert({ user_id: user.id, property_id: args.newPropertyId })
    .select("id")
    .single();
  if (newErr) return { error: newErr.message };

  // 2. Move-or-unassign each car.
  for (const dest of args.carDestinations) {
    const patch =
      dest.action === "move"
        ? { stored_in_property_id: newRow.id, assigned_upgrade_id: null }
        : { stored_in_property_id: null, assigned_upgrade_id: null };
    const { error } = await supabase
      .from("user_owned_vehicles")
      .update(patch)
      .eq("id", dest.ownedVehicleId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  }

  // 3. Delete the traded-in owned property (cars are already moved).
  const { error: delErr } = await supabase
    .from("user_owned_properties")
    .delete()
    .eq("id", args.tradeInOwnedPropertyId)
    .eq("user_id", user.id);
  if (delErr) return { error: delErr.message };

  revalidatePath("/", "layout");
  return { ok: true, newOwnedPropertyId: newRow.id };
}

export type UnownArgs = {
  ownedPropertyId: string;
  carDestinations: Array<{
    ownedVehicleId: string;
    destinationPropertyId: string | null; // null = unassign
  }>;
};

export async function unownProperty(
  args: UnownArgs,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  for (const dest of args.carDestinations) {
    const patch =
      dest.destinationPropertyId === null
        ? { stored_in_property_id: null, assigned_upgrade_id: null }
        : { stored_in_property_id: dest.destinationPropertyId, assigned_upgrade_id: null };
    const { error } = await supabase
      .from("user_owned_vehicles")
      .update(patch)
      .eq("id", dest.ownedVehicleId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  }

  const { error: delErr } = await supabase
    .from("user_owned_properties")
    .delete()
    .eq("id", args.ownedPropertyId)
    .eq("user_id", user.id);
  if (delErr) return { error: delErr.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
