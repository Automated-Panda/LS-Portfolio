"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AvailabilityStatus, VehicleVendor } from "@/lib/vehicles";

type Result = { ok: true } | { error: string };

const AVAILABILITY = new Set<AvailabilityStatus>([
  "available",
  "discontinued",
  "unobtainable",
  "blacklisted",
  "seasonal",
]);
const VENDORS = new Set<VehicleVendor>([
  "southern_san_andreas",
  "legendary_motorsport",
  "elitas_travel",
  "warstock",
  "dock_tease",
  "pedal_metal",
  "bennys",
]);

export type VehiclePatch = {
  display_name?: string;
  price?: number | null;
  availability?: AvailabilityStatus;
  vendors?: VehicleVendor[];
};

export async function updateVehicleAdmin(
  id: string,
  patch: VehiclePatch,
): Promise<Result> {
  await requireAdmin();

  const update: Record<string, unknown> = {};
  if (patch.display_name !== undefined) {
    const name = patch.display_name.trim();
    if (!name) return { error: "Name can't be empty." };
    update.display_name = name;
  }
  if (patch.price !== undefined) {
    if (
      patch.price !== null &&
      (!Number.isFinite(patch.price) || patch.price < 0)
    ) {
      return { error: "Price must be a number ≥ 0 (or empty)." };
    }
    update.price = patch.price;
  }
  if (patch.availability !== undefined) {
    if (!AVAILABILITY.has(patch.availability)) {
      return { error: "Invalid availability." };
    }
    update.availability = patch.availability;
  }
  if (patch.vendors !== undefined) {
    if (!patch.vendors.every((v) => VENDORS.has(v))) {
      return { error: "Invalid vendor." };
    }
    update.vendors = patch.vendors;
  }

  if (Object.keys(update).length === 0) return { ok: true };

  const supabase = createAdminClient();
  const { error } = await supabase.from("vehicles").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/vehicles");
  revalidatePath("/", "layout"); // keep public pages in sync
  return { ok: true };
}

export type PropertyPatch = {
  display_name?: string;
  price?: number | null;
  capacity?: number;
  counts_as_garage?: boolean;
  subtype_display?: string;
  neighborhood?: string | null;
};

export async function updatePropertyAdmin(
  id: string,
  patch: PropertyPatch,
): Promise<Result> {
  await requireAdmin();

  const update: Record<string, unknown> = {};
  if (patch.display_name !== undefined) {
    const name = patch.display_name.trim();
    if (!name) return { error: "Name can't be empty." };
    update.display_name = name;
  }
  if (patch.price !== undefined) {
    if (
      patch.price !== null &&
      (!Number.isFinite(patch.price) || patch.price < 0)
    ) {
      return { error: "Price must be a number ≥ 0 (or empty)." };
    }
    update.price = patch.price;
  }
  if (patch.capacity !== undefined) {
    if (!Number.isInteger(patch.capacity) || patch.capacity < 0) {
      return { error: "Capacity must be a whole number ≥ 0." };
    }
    update.capacity = patch.capacity;
  }
  if (patch.counts_as_garage !== undefined) {
    update.counts_as_garage = patch.counts_as_garage;
  }
  if (patch.subtype_display !== undefined) {
    const v = patch.subtype_display.trim();
    if (!v) return { error: "Subtype label can't be empty." };
    update.subtype_display = v;
  }
  if (patch.neighborhood !== undefined) {
    const v = patch.neighborhood?.trim();
    update.neighborhood = v ? v : null;
  }

  if (Object.keys(update).length === 0) return { ok: true };

  const supabase = createAdminClient();
  const { error } = await supabase.from("properties").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/properties");
  revalidatePath("/", "layout");
  return { ok: true };
}

export type UpgradePatch = {
  display_name?: string;
  capacity?: number;
  price?: number | null;
};

export async function updateUpgradeAdmin(
  id: string,
  patch: UpgradePatch,
): Promise<Result> {
  await requireAdmin();

  const update: Record<string, unknown> = {};
  if (patch.display_name !== undefined) {
    const name = patch.display_name.trim();
    if (!name) return { error: "Name can't be empty." };
    update.display_name = name;
  }
  if (patch.capacity !== undefined) {
    if (!Number.isInteger(patch.capacity) || patch.capacity < 0) {
      return { error: "Capacity must be a whole number ≥ 0." };
    }
    update.capacity = patch.capacity;
  }
  if (patch.price !== undefined) {
    if (
      patch.price !== null &&
      (!Number.isFinite(patch.price) || patch.price < 0)
    ) {
      return { error: "Price must be a number ≥ 0 (or empty)." };
    }
    update.price = patch.price;
  }

  if (Object.keys(update).length === 0) return { ok: true };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("property_upgrades")
    .update(update)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/upgrades");
  revalidatePath("/", "layout");
  return { ok: true };
}
