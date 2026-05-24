import { createClient } from "@/lib/supabase/server";
import {
  formatClass,
  type FilterOptions,
  type VehicleSummary,
} from "@/lib/vehicles";

export type VehiclesBrowserData = {
  vehicles: VehicleSummary[];
  ownedVehicleIds: string[];
  filters: FilterOptions;
};

export async function getVehiclesBrowserData(
  userId: string,
): Promise<VehiclesBrowserData> {
  const supabase = await createClient();

  const [
    { data: vehicleRows, error: vehiclesErr },
    { data: manufacturerRows, error: mfrErr },
    { data: tagRows, error: tagsErr },
    { data: ownedRows, error: ownedErr },
  ] = await Promise.all([
    supabase
      .from("vehicles")
      .select(
        `id, internal_name, display_name, class, manufacturer_id, image_path,
         manufacturers ( display ),
         vehicle_tag_links ( tag_id )`,
      )
      .order("display_name", { ascending: true }),
    supabase
      .from("manufacturers")
      .select("id, display")
      .order("display", { ascending: true }),
    supabase
      .from("vehicle_tags")
      .select("id, display")
      .order("display", { ascending: true }),
    supabase
      .from("user_owned_vehicles")
      .select("vehicle_id")
      .eq("user_id", userId),
  ]);

  if (vehiclesErr) throw vehiclesErr;
  if (mfrErr) throw mfrErr;
  if (tagsErr) throw tagsErr;
  if (ownedErr) throw ownedErr;

  type RawVehicle = {
    id: string;
    internal_name: string;
    display_name: string;
    class: string;
    manufacturer_id: string;
    image_path: string | null;
    manufacturers: { display: string } | { display: string }[] | null;
    vehicle_tag_links: Array<{ tag_id: string }> | null;
  };

  const raw = (vehicleRows ?? []) as RawVehicle[];
  const ownedSet = new Set((ownedRows ?? []).map((r) => r.vehicle_id));
  const ownedCount = new Map<string, number>();
  for (const r of ownedRows ?? []) {
    ownedCount.set(r.vehicle_id, (ownedCount.get(r.vehicle_id) ?? 0) + 1);
  }

  // Fold drift variants into their base by display_name.
  const isDrift = (v: RawVehicle) =>
    v.internal_name.toLowerCase().startsWith("drift");

  const byDisplay = new Map<string, RawVehicle[]>();
  for (const v of raw) {
    const arr = byDisplay.get(v.display_name) ?? [];
    arr.push(v);
    byDisplay.set(v.display_name, arr);
  }

  const driftIds = new Set<string>();
  const driftByBaseId = new Map<string, { id: string; owned: boolean }>();
  for (const [, group] of byDisplay) {
    const drifts = group.filter(isDrift);
    const bases = group.filter((v) => !isDrift(v));
    if (drifts.length === 0 || bases.length === 0) continue;
    // Pair the first drift with the first base in the group.
    const base = bases[0];
    const drift = drifts[0];
    driftIds.add(drift.id);
    driftByBaseId.set(base.id, {
      id: drift.id,
      owned: ownedSet.has(drift.id),
    });
  }

  const vehicles: VehicleSummary[] = raw
    .filter((v) => !driftIds.has(v.id))
    .map((v) => {
      const mfr = Array.isArray(v.manufacturers)
        ? v.manufacturers[0]
        : v.manufacturers;
      return {
        id: v.id,
        display_name: v.display_name,
        class: formatClass(v.class),
        manufacturer_id: v.manufacturer_id,
        manufacturer_display: mfr?.display ?? v.manufacturer_id,
        image_path: v.image_path,
        tag_ids: (v.vehicle_tag_links ?? []).map((l) => l.tag_id),
        owned_count: ownedCount.get(v.id) ?? 0,
        drift_variant: driftByBaseId.get(v.id) ?? null,
      };
    });

  const classes = Array.from(new Set(vehicles.map((v) => v.class))).sort();

  return {
    vehicles,
    ownedVehicleIds: (ownedRows ?? []).map((r) => r.vehicle_id),
    filters: {
      classes,
      manufacturers: manufacturerRows ?? [],
      tags: tagRows ?? [],
    },
  };
}

export async function getOwnedCounts(
  userId: string,
): Promise<{ vehicles: number; properties: number; businesses: number }> {
  const supabase = await createClient();

  const [vehiclesRes, ownedPropsRes] = await Promise.all([
    // Counts user_owned_vehicles rows = instance count (multi-instance aware).
    supabase
      .from("user_owned_vehicles")
      .select("vehicle_id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("user_owned_properties")
      .select("property_id, properties!inner(property_type)")
      .eq("user_id", userId),
  ]);

  type OwnedPropRow = {
    property_id: string;
    properties:
      | { property_type: string }
      | Array<{ property_type: string }>
      | null;
  };

  const ownedProps = (ownedPropsRes.data ?? []) as OwnedPropRow[];

  let businesses = 0;
  let properties = 0;
  for (const row of ownedProps) {
    const p = Array.isArray(row.properties) ? row.properties[0] : row.properties;
    if (p?.property_type === "business") businesses += 1;
    else properties += 1;
  }

  return {
    vehicles: vehiclesRes.count ?? 0,
    properties,
    businesses,
  };
}
