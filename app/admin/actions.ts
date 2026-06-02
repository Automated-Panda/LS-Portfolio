"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateImageFile, storageKey, publicImageUrl, type ImageEntity } from "@/lib/admin/image-upload";
import type { AvailabilityStatus, VehicleVendor } from "@/lib/vehicles";
import { logAdminActivity } from "@/lib/admin/activity";
import { diffFields } from "@/lib/admin/activity-format";
import { isValidCatalogStatus } from "@/lib/catalog/status";

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
  const { data: before } = await supabase
    .from("vehicles")
    .select("display_name, price, availability, vendors")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("vehicles").update(update).eq("id", id);
  if (error) return { error: error.message };

  await logAdminActivity({
    action: "vehicle.update",
    targetId: id,
    targetLabel: ((before as Record<string, unknown> | null)?.display_name as string) ?? id,
    changes: diffFields((before ?? {}) as Record<string, unknown>, update, Object.keys(update)),
  });

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
  const { data: before } = await supabase
    .from("properties")
    .select("display_name, price, capacity, counts_as_garage, subtype_display, neighborhood")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("properties").update(update).eq("id", id);
  if (error) return { error: error.message };

  await logAdminActivity({
    action: "property.update",
    targetId: id,
    targetLabel: ((before as Record<string, unknown> | null)?.display_name as string) ?? id,
    changes: diffFields((before ?? {}) as Record<string, unknown>, update, Object.keys(update)),
  });

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
  const { data: before } = await supabase
    .from("property_upgrades")
    .select("display_name, capacity, price")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase
    .from("property_upgrades")
    .update(update)
    .eq("id", id);
  if (error) return { error: error.message };

  await logAdminActivity({
    action: "upgrade.update",
    targetId: id,
    targetLabel: ((before as Record<string, unknown> | null)?.display_name as string) ?? id,
    changes: diffFields((before ?? {}) as Record<string, unknown>, update, Object.keys(update)),
  });

  revalidatePath("/admin/upgrades");
  revalidatePath("/", "layout");
  return { ok: true };
}

const IMAGE_ENTITIES = new Set<ImageEntity>(["vehicles", "properties"]);

export type ImageResult = { ok: true; url: string | null } | { error: string };

/** Upload/replace a catalog item's image. Stores an absolute Storage URL in image_path. */
export async function uploadCatalogImage(
  entity: string,
  id: string,
  formData: FormData,
): Promise<ImageResult> {
  await requireAdmin();
  if (!IMAGE_ENTITIES.has(entity as ImageEntity)) return { error: "Invalid entity." };

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No file provided." };

  const v = validateImageFile({ type: file.type, size: file.size });
  if (!v.ok) return { error: v.error };

  const key = storageKey(entity as ImageEntity, id);
  const bytes = new Uint8Array(await file.arrayBuffer());

  const supabase = createAdminClient();
  const { error: upErr } = await supabase.storage
    .from("catalog-images")
    .upload(key, bytes, { upsert: true, contentType: file.type });
  if (upErr) return { error: upErr.message };

  const url = `${publicImageUrl(key)}?t=${Date.now()}`;
  const { error } = await supabase.from(entity).update({ image_path: url }).eq("id", id);
  if (error) return { error: error.message };

  const { data: row } = await supabase.from(entity).select("display_name").eq("id", id).maybeSingle();
  await logAdminActivity({
    action: "image.upload",
    targetId: id,
    targetLabel: ((row as Record<string, unknown> | null)?.display_name as string) ?? `${entity} ${id}`,
    changes: {},
  });

  revalidatePath(`/admin/${entity}`);
  revalidatePath("/", "layout");
  return { ok: true, url };
}

/** Clear a catalog item's image. */
export async function removeCatalogImage(entity: string, id: string): Promise<ImageResult> {
  await requireAdmin();
  if (!IMAGE_ENTITIES.has(entity as ImageEntity)) return { error: "Invalid entity." };

  const supabase = createAdminClient();
  const { data: row } = await supabase.from(entity).select("display_name").eq("id", id).maybeSingle();
  const { error } = await supabase.from(entity).update({ image_path: null }).eq("id", id);
  if (error) return { error: error.message };

  await logAdminActivity({
    action: "image.remove",
    targetId: id,
    targetLabel: ((row as Record<string, unknown> | null)?.display_name as string) ?? `${entity} ${id}`,
    changes: {},
  });

  revalidatePath(`/admin/${entity}`);
  revalidatePath("/", "layout");
  return { ok: true, url: null };
}

/** Set a catalog item's visibility status (draft/published/archived). */
export async function setCatalogStatus(
  entity: string,
  id: string,
  status: string,
): Promise<Result> {
  await requireAdmin();
  if (!IMAGE_ENTITIES.has(entity as ImageEntity)) return { error: "Invalid entity." };
  if (!isValidCatalogStatus(status)) return { error: "Invalid status." };

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from(entity)
    .select("display_name, status")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from(entity).update({ status }).eq("id", id);
  if (error) return { error: error.message };

  const b = (before ?? {}) as { display_name?: string; status?: string };
  await logAdminActivity({
    action: entity === "vehicles" ? "vehicle.update" : "property.update",
    targetId: id,
    targetLabel: b.display_name ?? id,
    changes: diffFields({ status: b.status ?? null }, { status }, ["status"]),
  });

  revalidatePath(`/admin/${entity}`);
  revalidatePath("/", "layout");
  return { ok: true };
}
