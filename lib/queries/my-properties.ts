// lib/queries/my-properties.ts
import { createClient } from "@/lib/supabase/server";
import { applyHangarBoost, getHangarBoostContext } from "@/lib/hangar-boost";
import { ARENA_LARGE_BAY_UPGRADE_ID, arenaLargeBayCapacity } from "@/lib/arena-bay";

export type OwnedPropertyDetail = {
  id: string;                 // user_owned_properties.id (uuid)
  property_id: string;        // properties.id (text)
  display_name: string;
  property_type: "residence" | "garage" | "business" | "special";
  subtype: string;
  subtype_display: string;
  neighborhood: string | null;
  image_path: string | null;
  base_capacity: number;
  counts_as_garage: boolean;  // false for hangars/yachts/etc. — filters out of vehicle storage pickers
  ownership_group: string;
  price: number | null;       // base property purchase price in $, null if unsourced
  total_upgrades: number;
  installed_upgrades: number;
  total_cars: number;         // sum across base + all sub-garages
  upgrades: Array<{
    id: string;
    display_name: string;
    capacity: number;
    required_upgrade_id: string | null;
    sort_order: number;
    is_installed: boolean;
    cars_here: number;        // only meaningful for storage-capacity upgrades
    price: number | null;     // upgrade purchase price in $, null if unsourced
    /** When set, this upgrade is subdivided into addressable sub-slots (e.g. CEO Office floor → A/B/C, mansion → garage/driveway/podium). Sum of capacities matches the upgrade's capacity. */
    sub_slots: Array<{
      label: string;
      capacity: number;
      required_upgrade_id?: string | null;
      /** When set, this bay only fits one specific vehicle (e.g. a Facility's
       *  Khanjali bay), or a set of vehicles (e.g. the Arena's Cerberus family).
       *  See lib/bays.ts. */
      vehicle_id?: string | null;
      vehicle_ids?: string[] | null;
      cars_here: number;
    }> | null;
    /** Mutex group label: upgrades sharing this label on the same property are mutually exclusive (e.g. yacht models). */
    mutex_group: string | null;
    /** When true, the mutex group this upgrade belongs to offers a "None" opt-out choice. */
    mutex_allow_none: boolean;
    /** True when the upgrade unlocks automatically on purchase (e.g. Mansion Garage). Hidden from the Upgrades tab checklist but shown in Storage when it has capacity. */
    included_on_purchase: boolean;
  }>;
};

export type OwnedScope = "all" | "properties" | "businesses";

/**
 * Property types in each owned-view scope. Matches the same split used by
 * the browse routes (`/properties` vs `/businesses`).
 */
const SCOPE_TYPES: Record<OwnedScope, Array<"residence" | "garage" | "business" | "special"> | null> = {
  all: null,
  properties: ["residence", "garage", "special"],
  businesses: ["business"],
};

export async function getOwnedPropertiesWithStorage(
  characterId: string,
  scope: OwnedScope = "all",
): Promise<OwnedPropertyDetail[]> {
  const supabase = await createClient();

  const boost = await getHangarBoostContext(characterId);

  const query = supabase
    .from("user_owned_properties")
    .select(`
      id,
      property_id,
      properties!inner (
        display_name, property_type, subtype, subtype_display, neighborhood, image_path,
        capacity, ownership_group, counts_as_garage, price,
        property_upgrades ( id, display_name, capacity, required_upgrade_id, sort_order, price, sub_slots, mutex_group, mutex_allow_none, included_on_purchase )
      ),
      user_owned_property_upgrades ( property_upgrade_id ),
      user_owned_vehicles!stored_in_property_id (
        id, assigned_upgrade_id, sub_slot
      )
    `)
    .eq("character_id", characterId)
    .order("created_at", { ascending: true });

  const types = SCOPE_TYPES[scope];
  if (types) query.in("properties.property_type", types);

  const { data, error } = await query;

  if (error) throw error;

  type Row = NonNullable<typeof data>[number];

  return (data ?? []).map((row: Row) => {
    const p = Array.isArray(row.properties) ? row.properties[0] : row.properties;
    type RawSubSlot = { label: string; capacity: number; required_upgrade_id?: string | null; vehicle_id?: string | null; vehicle_ids?: string[] | null };
    const allUpgrades = (p?.property_upgrades ?? []) as Array<{
      id: string; display_name: string; capacity: number;
      required_upgrade_id: string | null; sort_order: number;
      price: number | null;
      sub_slots: RawSubSlot[] | null;
      mutex_group: string | null;
      mutex_allow_none: boolean | null;
      included_on_purchase: boolean | null;
    }>;
    const installedIds = new Set(
      (row.user_owned_property_upgrades ?? []).map(
        (u: { property_upgrade_id: string }) => u.property_upgrade_id,
      ),
    );
    const cars = (row.user_owned_vehicles ?? []) as Array<{
      id: string; assigned_upgrade_id: string | null; sub_slot: string | null;
    }>;
    const carsByUpgrade = new Map<string | null, number>();
    const carsByUpgradeSubSlot = new Map<string, number>(); // key = `${upgradeId ?? "base"}::${subSlot ?? ""}`
    for (const c of cars) {
      carsByUpgrade.set(
        c.assigned_upgrade_id,
        (carsByUpgrade.get(c.assigned_upgrade_id) ?? 0) + 1,
      );
      const key = `${c.assigned_upgrade_id ?? "base"}::${c.sub_slot ?? ""}`;
      carsByUpgradeSubSlot.set(key, (carsByUpgradeSubSlot.get(key) ?? 0) + 1);
    }

    return {
      id: row.id,
      property_id: row.property_id,
      display_name: p?.display_name ?? "",
      property_type: (p?.property_type ?? "residence") as OwnedPropertyDetail["property_type"],
      subtype: p?.subtype ?? "",
      subtype_display: p?.subtype_display ?? "",
      neighborhood: p?.neighborhood ?? null,
      image_path: p?.image_path ?? null,
      base_capacity: applyHangarBoost({
        ownershipGroup: p?.ownership_group ?? "",
        assignedUpgradeId: null,
        baseCapacity: p?.capacity ?? 0,
        ownsMckenzie: boost.ownsMckenzie,
        gtaPlus: boost.gtaPlus,
      }),
      counts_as_garage: p?.counts_as_garage ?? false,
      ownership_group: p?.ownership_group ?? "",
      price: (p?.price ?? null) as number | null,
      // Counts represent the USER-FACING upgrade checklist — included_on_purchase
      // upgrades (Mansion Garage, Vinewood floors, etc.) are not user choices
      // and are excluded so the "N / M upgrades" badge matches what the user
      // sees in the Upgrades tab.
      total_upgrades: allUpgrades.filter((u) => !u.included_on_purchase).length,
      installed_upgrades: allUpgrades.filter(
        (u) => !u.included_on_purchase && installedIds.has(u.id),
      ).length,
      total_cars: cars.length,
      upgrades: allUpgrades
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((u) => {
          // The Arena's Large Vehicle Bay holds one Cerberus per installed
          // floor (ground + B1 + B2), so its capacity tracks what's installed
          // rather than the static seed value.
          const capacity =
            u.id === ARENA_LARGE_BAY_UPGRADE_ID
              ? arenaLargeBayCapacity(installedIds)
              : u.capacity;
          return {
            ...u,
            capacity,
            price: u.price ?? null,
            mutex_group: u.mutex_group ?? null,
            mutex_allow_none: u.mutex_allow_none ?? false,
            included_on_purchase: u.included_on_purchase ?? false,
            // Included-on-purchase upgrades (mansion garage, garage floors,
            // facility weaponized bays…) come WITH the property — always treat
            // them as installed even if no explicit row exists yet.
            is_installed: installedIds.has(u.id) || (u.included_on_purchase ?? false),
            cars_here: carsByUpgrade.get(u.id) ?? 0,
            sub_slots: u.sub_slots
              ? u.sub_slots.map((s) => ({
                  label: s.label,
                  capacity:
                    u.id === ARENA_LARGE_BAY_UPGRADE_ID ? capacity : s.capacity,
                  required_upgrade_id: s.required_upgrade_id ?? null,
                  vehicle_id: s.vehicle_id ?? null,
                  vehicle_ids: s.vehicle_ids ?? null,
                  cars_here: carsByUpgradeSubSlot.get(`${u.id}::${s.label}`) ?? 0,
                }))
              : null,
          };
        }),
    };
  });
}
