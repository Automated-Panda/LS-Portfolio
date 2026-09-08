"use server";

import { revalidatePath } from "next/cache";

import {
  bayForStoredVehicle,
  type ContainerBayView,
  type ContainerUpgradeView,
} from "@/lib/containers";
import { getOwnedContainerVehicles } from "@/lib/queries/container-vehicles";
import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/scope";

type Result = { ok: true } | { error: string };

export type ContainerOption = {
  /** The owned container vehicle to nest into. */
  containerOwnedVehicleId: string;
  containerDisplayName: string;
  bayLabel: string;
  capacity: number;
  used: number;
};

/**
 * The owned container vehicles a storable vehicle can be nested into right now
 * (correct container type, gating upgrade installed). Used by the InstanceDrawer
 * to offer "store inside …" options. Only vehicle-bound bays for v1.
 */
export async function getOwnedContainersForStorable(
  childVehicleId: string,
): Promise<ContainerOption[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { characterId } = (await getScope())!;

  const match = bayForStoredVehicle(childVehicleId);
  if (!match) return [];

  const containers = (await getOwnedContainerVehicles()).filter(
    (c) => c.vehicle_id === match.containerVehicleId,
  );
  if (containers.length === 0) return [];

  const ids = containers.map((c) => c.id);
  const { data: nested } = await supabase
    .from("user_owned_vehicles")
    .select("stored_in_vehicle_id, sub_slot")
    .eq("character_id", characterId)
    .in("stored_in_vehicle_id", ids);

  const key = (cid: string, label: string) => `${cid}::${label}`;
  const used = new Map<string, number>();
  for (const n of nested ?? []) {
    const k = key((n.stored_in_vehicle_id as string) ?? "", (n.sub_slot as string) ?? "");
    used.set(k, (used.get(k) ?? 0) + 1);
  }

  const options: ContainerOption[] = [];
  for (const c of containers) {
    const bay = c.bays.find(
      (b) =>
        b.vehicle_id === childVehicleId ||
        (b.vehicle_ids?.includes(childVehicleId) ?? false),
    );
    if (!bay) continue; // gating upgrade not installed → no bay
    options.push({
      containerOwnedVehicleId: c.id,
      containerDisplayName: c.display_name,
      bayLabel: bay.label,
      capacity: bay.capacity,
      used: used.get(key(c.id, bay.label)) ?? 0,
    });
  }
  return options;
}

/**
 * Nest a vehicle inside a container vehicle's bay. Validates ownership, the
 * vehicle↔bay binding, the gating upgrade, and bay capacity. Clears any property
 * assignment (mutual exclusivity).
 */
export async function assignVehicleToContainer(opts: {
  ownedVehicleId: string;
  containerOwnedVehicleId: string;
  bayLabel: string;
}): Promise<Result | { capacityExceeded: { capacity: number; current: number } }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { characterId } = (await getScope())!;

  const [{ data: child }, { data: container }] = await Promise.all([
    supabase
      .from("user_owned_vehicles")
      .select("vehicle_id")
      .eq("id", opts.ownedVehicleId)
      .eq("character_id", characterId)
      .maybeSingle(),
    supabase
      .from("user_owned_vehicles")
      .select("vehicle_id")
      .eq("id", opts.containerOwnedVehicleId)
      .eq("character_id", characterId)
      .maybeSingle(),
  ]);
  if (!child) return { error: "Vehicle not found." };
  if (!container) return { error: "Container vehicle not found." };

  const match = bayForStoredVehicle(child.vehicle_id as string);
  if (
    !match ||
    match.containerVehicleId !== container.vehicle_id ||
    match.bay.label !== opts.bayLabel
  ) {
    return { error: "This vehicle can't be stored in that container bay." };
  }

  // Bay must exist on the owned container (gating upgrade installed) + have room.
  const containers = await getOwnedContainerVehicles();
  const c = containers.find((x) => x.id === opts.containerOwnedVehicleId);
  const bay = c?.bays.find((b) => b.label === opts.bayLabel);
  if (!bay) {
    return { error: "That bay isn't available — install the required upgrade first." };
  }

  const { count } = await supabase
    .from("user_owned_vehicles")
    .select("id", { count: "exact", head: true })
    .eq("character_id", characterId)
    .eq("stored_in_vehicle_id", opts.containerOwnedVehicleId)
    .eq("sub_slot", opts.bayLabel)
    .neq("id", opts.ownedVehicleId);
  if ((count ?? 0) >= bay.capacity) {
    return { capacityExceeded: { capacity: bay.capacity, current: count ?? 0 } };
  }

  const { error } = await supabase
    .from("user_owned_vehicles")
    .update({
      stored_in_vehicle_id: opts.containerOwnedVehicleId,
      sub_slot: opts.bayLabel,
      stored_in_property_id: null,
      assigned_upgrade_id: null,
      slot_number: null,
    })
    .eq("id", opts.ownedVehicleId)
    .eq("character_id", characterId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

// --- Container-side management (the container's own drawer) -----------------

export type ContainerNestedVehicle = {
  instanceId: string;
  name: string;
  bayLabel: string | null;
};

export type ContainerDetail = {
  upgrades: ContainerUpgradeView[];
  bays: ContainerBayView[];
  nested: ContainerNestedVehicle[];
};

/** Full management view for one owned container vehicle: its upgrades (installed
 *  state), the bays its installed upgrades expose, and the vehicles nested in it. */
export async function getContainerDetail(
  ownedVehicleId: string,
): Promise<ContainerDetail | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { characterId } = (await getScope())!;

  const container = (await getOwnedContainerVehicles()).find(
    (c) => c.id === ownedVehicleId,
  );
  if (!container) return null;

  const { data: nested } = await supabase
    .from("user_owned_vehicles")
    .select("id, nickname, sub_slot, vehicles!inner(display_name)")
    .eq("character_id", characterId)
    .eq("stored_in_vehicle_id", ownedVehicleId);

  const nestedList: ContainerNestedVehicle[] = (nested ?? []).map((n) => {
    const v = Array.isArray(n.vehicles) ? n.vehicles[0] : n.vehicles;
    return {
      instanceId: n.id as string,
      name: (n.nickname as string) || v?.display_name || "Vehicle",
      bayLabel: (n.sub_slot as string) ?? null,
    };
  });

  return { upgrades: container.upgrades, bays: container.bays, nested: nestedList };
}

/**
 * Install or uninstall a vehicle upgrade on an owned container. Installing an
 * upgrade in a mutex group (e.g. MOC cab choice) uninstalls its siblings.
 */
export async function setVehicleUpgrade(opts: {
  ownedVehicleId: string;
  vehicleUpgradeId: string;
  install: boolean;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };
  const { characterId } = (await getScope())!;

  // Confirm the owned vehicle belongs to the user (RLS also enforces this).
  const { data: owned } = await supabase
    .from("user_owned_vehicles")
    .select("id")
    .eq("id", opts.ownedVehicleId)
    .eq("character_id", characterId)
    .maybeSingle();
  if (!owned) return { error: "Vehicle not found." };

  if (!opts.install) {
    const { error } = await supabase
      .from("user_owned_vehicle_upgrades")
      .delete()
      .eq("user_owned_vehicle_id", opts.ownedVehicleId)
      .eq("vehicle_upgrade_id", opts.vehicleUpgradeId);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: true };
  }

  // Installing: clear mutex siblings first.
  const { data: upg } = await supabase
    .from("vehicle_upgrades")
    .select("vehicle_id, mutex_group")
    .eq("id", opts.vehicleUpgradeId)
    .maybeSingle();
  if (!upg) return { error: "Upgrade not found." };

  if (upg.mutex_group) {
    const { data: siblings } = await supabase
      .from("vehicle_upgrades")
      .select("id")
      .eq("vehicle_id", upg.vehicle_id)
      .eq("mutex_group", upg.mutex_group);
    const siblingIds = (siblings ?? []).map((s) => s.id as string);
    if (siblingIds.length > 0) {
      await supabase
        .from("user_owned_vehicle_upgrades")
        .delete()
        .eq("user_owned_vehicle_id", opts.ownedVehicleId)
        .in("vehicle_upgrade_id", siblingIds);
    }
  }

  const { error } = await supabase
    .from("user_owned_vehicle_upgrades")
    .upsert(
      {
        user_owned_vehicle_id: opts.ownedVehicleId,
        vehicle_upgrade_id: opts.vehicleUpgradeId,
      },
      { onConflict: "user_owned_vehicle_id,vehicle_upgrade_id" },
    );
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}
