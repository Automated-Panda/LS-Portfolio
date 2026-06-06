// lib/capacity.ts
import { createClient } from "@/lib/supabase/server";
import { applyHangarBoost, getHangarBoostContext } from "@/lib/hangar-boost";
import { ARENA_LARGE_BAY_UPGRADE_ID, arenaLargeBayCapacity } from "@/lib/arena-bay";

/**
 * Returns the maximum number of vehicles that can be stored at the given
 * location. assignedUpgradeId === null means storage is the bare property
 * (e.g. apartment, standalone garage). Otherwise capacity is the upgrade's
 * own capacity column.
 */
export async function capacityForStorageLocation(
  ownedPropertyId: string,
  assignedUpgradeId: string | null,
): Promise<number> {
  const supabase = await createClient();

  if (assignedUpgradeId === null) {
    const { data, error } = await supabase
      .from("user_owned_properties")
      .select("user_id, properties!inner(capacity, ownership_group)")
      .eq("id", ownedPropertyId)
      .maybeSingle();

    if (error) throw error;
    const p = Array.isArray(data?.properties)
      ? data?.properties[0]
      : data?.properties;
    const baseCapacity = p?.capacity ?? 0;
    if (p?.ownership_group !== "hangar" || !data?.user_id) return baseCapacity;
    const boost = await getHangarBoostContext(data.user_id);
    return applyHangarBoost({
      ownershipGroup: p.ownership_group,
      assignedUpgradeId: null,
      baseCapacity,
      ownsMckenzie: boost.ownsMckenzie,
      gtaPlus: boost.gtaPlus,
    });
  }

  // The Arena's Large Vehicle Bay capacity tracks installed floors, not the
  // static seed value (see lib/arena-bay.ts).
  if (assignedUpgradeId === ARENA_LARGE_BAY_UPGRADE_ID) {
    const { data, error } = await supabase
      .from("user_owned_property_upgrades")
      .select("property_upgrade_id")
      .eq("user_owned_property_id", ownedPropertyId);
    if (error) throw error;
    return arenaLargeBayCapacity(
      (data ?? []).map((r) => r.property_upgrade_id as string),
    );
  }

  const { data, error } = await supabase
    .from("property_upgrades")
    .select("capacity")
    .eq("id", assignedUpgradeId)
    .maybeSingle();

  if (error) throw error;
  return data?.capacity ?? 0;
}

/**
 * Returns current car count at a storage location (for unassigned-check before
 * assignVehicleStorage).
 */
export async function currentCarCountAt(
  ownedPropertyId: string,
  assignedUpgradeId: string | null,
  /** When set, this vehicle is excluded from the count — so re-saving a
   * vehicle that's already in a (full) location doesn't count against itself. */
  excludeVehicleId?: string,
): Promise<number> {
  const supabase = await createClient();

  let q = supabase
    .from("user_owned_vehicles")
    .select("id", { count: "exact", head: true })
    .eq("stored_in_property_id", ownedPropertyId);

  if (excludeVehicleId) q = q.neq("id", excludeVehicleId);

  const { count, error } =
    assignedUpgradeId === null
      ? await q.is("assigned_upgrade_id", null)
      : await q.eq("assigned_upgrade_id", assignedUpgradeId);

  if (error) throw error;
  return count ?? 0;
}
