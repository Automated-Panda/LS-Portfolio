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
      .update({ stored_in_property_id: null, assigned_upgrade_id: null })
      .eq("id", opts.ownedVehicleId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: true };
  }

  // Capacity check
  const [capacity, current] = await Promise.all([
    capacityForStorageLocation(opts.ownedPropertyId, opts.assignedUpgradeId),
    currentCarCountAt(opts.ownedPropertyId, opts.assignedUpgradeId),
  ]);
  if (current >= capacity) {
    return { capacityExceeded: { capacity, current } };
  }

  const { error } = await supabase
    .from("user_owned_vehicles")
    .update({
      stored_in_property_id: opts.ownedPropertyId,
      assigned_upgrade_id: opts.assignedUpgradeId,
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
    patch.custom_tags = Array.from(
      new Set(opts.customTags.map((t) => t.trim().toLowerCase()).filter(Boolean)),
    );
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
