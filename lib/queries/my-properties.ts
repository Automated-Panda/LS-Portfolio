// lib/queries/my-properties.ts
import { createClient } from "@/lib/supabase/server";

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
  userId: string,
  scope: OwnedScope = "all",
): Promise<OwnedPropertyDetail[]> {
  const supabase = await createClient();

  const query = supabase
    .from("user_owned_properties")
    .select(`
      id,
      property_id,
      properties!inner (
        display_name, property_type, subtype, subtype_display, neighborhood, image_path,
        capacity, ownership_group, counts_as_garage,
        property_upgrades ( id, display_name, capacity, required_upgrade_id, sort_order )
      ),
      user_owned_property_upgrades ( property_upgrade_id ),
      user_owned_vehicles!stored_in_property_id (
        id, assigned_upgrade_id
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  const types = SCOPE_TYPES[scope];
  if (types) query.in("properties.property_type", types);

  const { data, error } = await query;

  if (error) throw error;

  type Row = NonNullable<typeof data>[number];

  return (data ?? []).map((row: Row) => {
    const p = Array.isArray(row.properties) ? row.properties[0] : row.properties;
    const allUpgrades = (p?.property_upgrades ?? []) as Array<{
      id: string; display_name: string; capacity: number;
      required_upgrade_id: string | null; sort_order: number;
    }>;
    const installedIds = new Set(
      (row.user_owned_property_upgrades ?? []).map(
        (u: { property_upgrade_id: string }) => u.property_upgrade_id,
      ),
    );
    const cars = (row.user_owned_vehicles ?? []) as Array<{
      id: string; assigned_upgrade_id: string | null;
    }>;
    const carsByUpgrade = new Map<string | null, number>();
    for (const c of cars) {
      carsByUpgrade.set(
        c.assigned_upgrade_id,
        (carsByUpgrade.get(c.assigned_upgrade_id) ?? 0) + 1,
      );
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
      base_capacity: p?.capacity ?? 0,
      counts_as_garage: p?.counts_as_garage ?? false,
      ownership_group: p?.ownership_group ?? "",
      total_upgrades: allUpgrades.length,
      installed_upgrades: allUpgrades.filter((u) => installedIds.has(u.id))
        .length,
      total_cars: cars.length,
      upgrades: allUpgrades
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((u) => ({
          ...u,
          is_installed: installedIds.has(u.id),
          cars_here: carsByUpgrade.get(u.id) ?? 0,
        })),
    };
  });
}
