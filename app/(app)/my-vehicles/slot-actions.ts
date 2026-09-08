"use server";

import { revalidatePath } from "next/cache";

import { isBayUpgrade } from "@/lib/bays";
import { capacityForStorageLocation } from "@/lib/capacity";
import { isValidSlot, planAutoArrange } from "@/lib/slots";
import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/scope";
import type { SupabaseClient } from "@supabase/supabase-js";

type Result = { ok: true } | { error: string };

/** Is this storage area a numberable car garage (not a hangar/dock/weaponized
 *  bay), and what's its capacity? */
async function garageArea(
  supabase: SupabaseClient,
  ownedPropertyId: string,
  assignedUpgradeId: string | null,
): Promise<{ isGarage: boolean; capacity: number }> {
  const capacity = await capacityForStorageLocation(
    ownedPropertyId,
    assignedUpgradeId,
  );

  const { data: op } = await supabase
    .from("user_owned_properties")
    .select("properties!inner(counts_as_garage)")
    .eq("id", ownedPropertyId)
    .maybeSingle();
  const p = Array.isArray(op?.properties) ? op?.properties[0] : op?.properties;
  let isGarage = !!p?.counts_as_garage && capacity > 0;

  // A counts_as_garage property can still have non-garage sub-areas (a Facility's
  // weaponized bays). Those use sub_slot, not numbered slots — exclude them.
  if (isGarage && assignedUpgradeId) {
    const { data: up } = await supabase
      .from("property_upgrades")
      .select("sub_slots")
      .eq("id", assignedUpgradeId)
      .maybeSingle();
    if (isBayUpgrade((up?.sub_slots ?? null) as never)) isGarage = false;
  }

  return { isGarage, capacity };
}

/**
 * Place a vehicle in a specific numbered slot, or clear its slot (slotNumber
 * null). If the target slot is taken by another car, returns `{ occupied }` so
 * the caller can confirm a swap (call swapVehicleSlots).
 */
export async function setVehicleSlot(opts: {
  ownedVehicleId: string;
  slotNumber: number | null;
}): Promise<
  | { ok: true }
  | { occupied: { byInstanceId: string; byName: string; slot: number } }
  | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { characterId } = (await getScope())!;

  // Clearing (un-placing) is always allowed.
  if (opts.slotNumber === null) {
    const { error } = await supabase
      .from("user_owned_vehicles")
      .update({ slot_number: null })
      .eq("id", opts.ownedVehicleId)
      .eq("character_id", characterId);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: true };
  }

  const { data: v, error: vErr } = await supabase
    .from("user_owned_vehicles")
    .select("stored_in_property_id, assigned_upgrade_id")
    .eq("id", opts.ownedVehicleId)
    .eq("character_id", characterId)
    .maybeSingle();
  if (vErr) return { error: vErr.message };
  if (!v?.stored_in_property_id) {
    return { error: "Vehicle isn't stored in a garage." };
  }
  const propertyId = v.stored_in_property_id as string;
  const upgradeId = (v.assigned_upgrade_id ?? null) as string | null;

  const area = await garageArea(supabase, propertyId, upgradeId);
  if (!area.isGarage) {
    return { error: "Numbered slots are only available in car garages." };
  }
  if (!isValidSlot(opts.slotNumber, area.capacity)) {
    return { error: `Slot must be between 1 and ${area.capacity}.` };
  }

  // Anyone else already in this slot? Let the caller decide to swap.
  let q = supabase
    .from("user_owned_vehicles")
    .select("id, nickname, vehicles!inner(display_name)")
    .eq("character_id", characterId)
    .eq("stored_in_property_id", propertyId)
    .eq("slot_number", opts.slotNumber)
    .neq("id", opts.ownedVehicleId);
  q =
    upgradeId === null
      ? q.is("assigned_upgrade_id", null)
      : q.eq("assigned_upgrade_id", upgradeId);
  const { data: occ, error: occErr } = await q.maybeSingle();
  if (occErr) return { error: occErr.message };
  if (occ) {
    const veh = Array.isArray(occ.vehicles) ? occ.vehicles[0] : occ.vehicles;
    return {
      occupied: {
        byInstanceId: occ.id,
        byName: occ.nickname || veh?.display_name || "another vehicle",
        slot: opts.slotNumber,
      },
    };
  }

  const { error } = await supabase
    .from("user_owned_vehicles")
    .update({ slot_number: opts.slotNumber })
    .eq("id", opts.ownedVehicleId)
    .eq("character_id", characterId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Exchange the slot numbers of two cars in the same area (atomic, via RPC). Used
 * for "drag onto an occupied slot" and the stepper's confirmed swap. The
 * displaced car may end up unplaced if the mover had no slot.
 */
export async function swapVehicleSlots(opts: {
  aId: string;
  bId: string;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase.rpc("swap_vehicle_slots", {
    a: opts.aId,
    b: opts.bId,
  });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * One-click fill a garage area: number every car currently stored there 1..N by
 * the order they were added. Cars beyond capacity are left unplaced. Clears the
 * area's slots first so re-running is idempotent and never trips the unique index.
 */
export async function autoArrangeGarage(opts: {
  ownedPropertyId: string;
  assignedUpgradeId: string | null;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { characterId } = (await getScope())!;

  const area = await garageArea(
    supabase,
    opts.ownedPropertyId,
    opts.assignedUpgradeId,
  );
  if (!area.isGarage) {
    return { error: "Numbered slots are only available in car garages." };
  }

  // Cars currently in this area, oldest first.
  let sel = supabase
    .from("user_owned_vehicles")
    .select("id")
    .eq("character_id", characterId)
    .eq("stored_in_property_id", opts.ownedPropertyId)
    .order("created_at", { ascending: true });
  sel =
    opts.assignedUpgradeId === null
      ? sel.is("assigned_upgrade_id", null)
      : sel.eq("assigned_upgrade_id", opts.assignedUpgradeId);
  const { data: cars, error: carsErr } = await sel;
  if (carsErr) return { error: carsErr.message };

  const plan = planAutoArrange(cars ?? [], area.capacity);

  // Clear first (so reassigning numbers can't collide with existing ones), then
  // write the new numbers.
  let clr = supabase
    .from("user_owned_vehicles")
    .update({ slot_number: null })
    .eq("character_id", characterId)
    .eq("stored_in_property_id", opts.ownedPropertyId);
  clr =
    opts.assignedUpgradeId === null
      ? clr.is("assigned_upgrade_id", null)
      : clr.eq("assigned_upgrade_id", opts.assignedUpgradeId);
  const { error: clrErr } = await clr;
  if (clrErr) return { error: clrErr.message };

  for (const { id, slot } of plan) {
    if (slot === null) continue;
    const { error } = await supabase
      .from("user_owned_vehicles")
      .update({ slot_number: slot })
      .eq("id", id)
      .eq("character_id", characterId);
    if (error) return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}
