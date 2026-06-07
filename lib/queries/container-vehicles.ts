// lib/queries/container-vehicles.ts
// Read each owned container vehicle (Terrorbyte/MOC/Kosatka/Acid Lab) with its
// upgrade rows (installed state) and the storage bays those upgrades expose.
// Mirrors getOwnedPropertiesWithStorage. The vehicles NESTED inside a container
// are not fetched here — the caller derives them from the full instances list
// via OwnedVehicleInstance.nested_in (same pattern /my-vehicles uses for cars).
//
// Pure derivation + view types live in lib/containers.ts (client-safe, tested);
// this module is the server-only query that feeds it DB rows.

import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/scope";
import {
  CONTAINER_VEHICLES,
  deriveContainerView,
  type ContainerBayView,
  type ContainerUpgradeView,
  type RawContainerUpgrade,
} from "@/lib/containers";

export type OwnedContainerVehicle = {
  id: string; // user_owned_vehicles.id
  vehicle_id: string; // catalogue id (terbyte/kosatka/brickade2/moc)
  display_name: string;
  image_path: string | null;
  upgrades: ContainerUpgradeView[];
  bays: ContainerBayView[];
};

export async function getOwnedContainerVehicles(): Promise<OwnedContainerVehicle[]> {
  const scope = await getScope();
  if (!scope) return [];
  const supabase = await createClient();
  const containerIds = Object.keys(CONTAINER_VEHICLES);
  if (containerIds.length === 0) return [];

  const { data, error } = await supabase
    .from("user_owned_vehicles")
    .select(`
      id, vehicle_id,
      vehicles!inner (
        display_name, image_path,
        vehicle_upgrades (
          id, display_name, capacity, sub_slots, required_upgrade_id,
          mutex_group, included_on_purchase, price, sort_order
        )
      ),
      user_owned_vehicle_upgrades ( vehicle_upgrade_id )
    `)
    .eq("character_id", scope.characterId)
    .in("vehicle_id", containerIds)
    .order("created_at", { ascending: true });

  if (error) throw error;

  type Row = NonNullable<typeof data>[number];

  return (data ?? []).map((row: Row) => {
    const v = Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles;
    const installedIds = new Set(
      (row.user_owned_vehicle_upgrades ?? []).map(
        (u: { vehicle_upgrade_id: string }) => u.vehicle_upgrade_id,
      ),
    );
    const raw = (v?.vehicle_upgrades ?? []) as RawContainerUpgrade[];
    const { upgrades, bays } = deriveContainerView(raw, installedIds);

    return {
      id: row.id,
      vehicle_id: row.vehicle_id,
      display_name: v?.display_name ?? "",
      image_path: v?.image_path ?? null,
      upgrades,
      bays,
    };
  });
}
