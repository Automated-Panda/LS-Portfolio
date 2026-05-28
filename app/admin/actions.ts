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
