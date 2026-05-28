"use server";

import { revalidatePath } from "next/cache";

import {
  capacityForStorageLocation,
  currentCarCountAt,
} from "@/lib/capacity";
import { createClient } from "@/lib/supabase/server";

type Result<T = {}> = ({ ok: true } & T) | { error: string };

export async function assignVehicleStorage(opts: {
  ownedVehicleId: string;
  ownedPropertyId: string | null;
  assignedUpgradeId: string | null;
  subSlot?: string | null;
}): Promise<Result | { capacityExceeded: { capacity: number; current: number } }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Unassign path
  if (opts.ownedPropertyId === null) {
    const { error } = await supabase
      .from("user_owned_vehicles")
      .update({ stored_in_property_id: null, assigned_upgrade_id: null, sub_slot: null })
      .eq("id", opts.ownedVehicleId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: true };
  }

  // Capacity check — exclude the vehicle itself so re-saving a car that's
  // already parked in a full location (e.g. just editing its tags) isn't
  // rejected for being "over capacity" against its own slot.
  const [capacity, current] = await Promise.all([
    capacityForStorageLocation(opts.ownedPropertyId, opts.assignedUpgradeId),
    currentCarCountAt(opts.ownedPropertyId, opts.assignedUpgradeId, opts.ownedVehicleId),
  ]);
  if (current >= capacity) {
    return { capacityExceeded: { capacity, current } };
  }

  // Sub-slot capacity check (when assigning to a specific labelled sub-slot)
  if (opts.subSlot && opts.assignedUpgradeId) {
    const { data: upgrade } = await supabase
      .from("property_upgrades")
      .select("sub_slots")
      .eq("id", opts.assignedUpgradeId)
      .maybeSingle();
    type SubSlot = { label: string; capacity: number };
    const slots = (upgrade?.sub_slots ?? null) as SubSlot[] | null;
    const slot = slots?.find((s) => s.label === opts.subSlot) ?? null;
    if (!slot) return { error: `Sub-slot ${opts.subSlot} not found on upgrade.` };

    const { count: subCount } = await supabase
      .from("user_owned_vehicles")
      .select("id", { count: "exact", head: true })
      .eq("stored_in_property_id", opts.ownedPropertyId)
      .eq("assigned_upgrade_id", opts.assignedUpgradeId)
      .eq("sub_slot", opts.subSlot)
      .neq("id", opts.ownedVehicleId); // exclude self when re-saving same slot

    if ((subCount ?? 0) >= slot.capacity) {
      return {
        capacityExceeded: { capacity: slot.capacity, current: subCount ?? 0 },
      };
    }
  }

  const { error } = await supabase
    .from("user_owned_vehicles")
    .update({
      stored_in_property_id: opts.ownedPropertyId,
      assigned_upgrade_id: opts.assignedUpgradeId,
      sub_slot: opts.subSlot ?? null,
    })
    .eq("id", opts.ownedVehicleId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function assignVehiclesToSubGarage(opts: {
  ownedPropertyId: string;
  assignedUpgradeId: string | null;
  vehicleIds: string[];
}): Promise<
  | { ok: true; createdInstanceIds: string[] }
  | { capacityExceeded: { capacity: number; wouldBeAfter: number } }
  | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const [capacity, current] = await Promise.all([
    capacityForStorageLocation(opts.ownedPropertyId, opts.assignedUpgradeId),
    currentCarCountAt(opts.ownedPropertyId, opts.assignedUpgradeId),
  ]);
  if (current + opts.vehicleIds.length > capacity) {
    return {
      capacityExceeded: { capacity, wouldBeAfter: current + opts.vehicleIds.length },
    };
  }

  const rows = opts.vehicleIds.map((vid) => ({
    user_id: user.id,
    vehicle_id: vid,
    stored_in_property_id: opts.ownedPropertyId,
    assigned_upgrade_id: opts.assignedUpgradeId,
  }));

  const { data, error } = await supabase
    .from("user_owned_vehicles")
    .insert(rows)
    .select("id");
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, createdInstanceIds: (data ?? []).map((r) => r.id) };
}

export async function updateVehicleInstance(opts: {
  ownedVehicleId: string;
  nickname?: string | null;
  notes?: string | null;
  customTags?: string[];
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const patch: Record<string, unknown> = {};
  if (opts.nickname !== undefined) patch.nickname = opts.nickname;
  if (opts.notes !== undefined) patch.notes = opts.notes;
  if (opts.customTags !== undefined) {
    // Trim only — preserve whatever casing the user typed. Dedup
    // case-insensitively per-vehicle so 'Drift' + 'drift' can't both
    // attach to the same car.
    const seen = new Set<string>();
    const normalized: string[] = [];
    for (const raw of opts.customTags) {
      const t = raw.trim();
      if (!t) continue;
      const key = t.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      normalized.push(t);
    }
    patch.custom_tags = normalized;
  }
  patch.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("user_owned_vehicles")
    .update(patch)
    .eq("id", opts.ownedVehicleId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeVehicleInstance(
  ownedVehicleId: string,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("user_owned_vehicles")
    .delete()
    .eq("id", ownedVehicleId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
