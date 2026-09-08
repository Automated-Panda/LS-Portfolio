// scripts/diagnose-orphaned-cars.ts
// READ-ONLY. Dumps everything needed to understand (and later repair) the
// cross-character property-delete bug for one user. Writes nothing.
//   pnpm exec tsx --env-file=.env.local scripts/diagnose-orphaned-cars.ts <email>
import { createClient } from "@supabase/supabase-js";

async function main() {
  const arg = process.argv[2];
  if (!arg) { console.error("Usage: ... diagnose-orphaned-cars.ts <userId or email>"); process.exit(1); }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) { console.error("✗ Supabase env vars missing"); process.exit(1); }
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  let userId = arg;
  if (arg.includes("@")) {
    let page = 1, found: { id: string; email?: string } | undefined;
    while (!found) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw new Error(error.message);
      found = data.users.find((u) => u.email?.toLowerCase() === arg.toLowerCase());
      if (data.users.length < 1000) break;
      page++;
    }
    if (!found) { console.error(`No user with email ${arg}`); process.exit(1); }
    userId = found.id;
  }
  console.log(`\n=== USER ${arg} → ${userId} ===`);

  const { data: prof } = await db.from("profiles")
    .select("username, active_character_id, gta_plus, role").eq("id", userId).maybeSingle();
  console.log("profile:", JSON.stringify(prof));

  const { data: gps } = await db.from("game_profiles")
    .select("id, name, gta_plus, created_at").eq("user_id", userId).order("created_at");
  console.log("\n--- game_profiles ---");
  for (const g of gps ?? []) console.log(` ${g.id}  ${g.name.padEnd(14)} gta+=${g.gta_plus}  ${g.created_at}`);

  const { data: chars } = await db.from("characters")
    .select("id, game_profile_id, name, created_at").eq("user_id", userId).order("created_at");
  console.log("\n--- characters ---");
  for (const c of chars ?? [])
    console.log(` ${c.id}  ${c.name.padEnd(14)} profile=${c.game_profile_id}  ${c.created_at}${c.id === prof?.active_character_id ? "   <-- ACTIVE" : ""}`);

  const { data: props } = await db.from("user_owned_properties")
    .select("id, character_id, property_id, created_at, properties!inner(display_name, counts_as_garage, capacity)")
    .eq("user_id", userId).order("created_at");
  console.log("\n--- owned properties (chronological) ---");
  for (const p of props ?? []) {
    const pr = p.properties as unknown as { display_name: string; counts_as_garage: boolean; capacity: number };
    console.log(` ${p.created_at}  char=${p.character_id?.slice(0, 8)}  ${pr.display_name} (cap ${pr.capacity}${pr.counts_as_garage ? ", garage" : ""})  owned_id=${p.id}`);
  }

  const { data: cars } = await db.from("user_owned_vehicles")
    .select("id, character_id, vehicle_id, nickname, stored_in_property_id, assigned_upgrade_id, sub_slot, slot_number, stored_in_vehicle_id, created_at, updated_at")
    .eq("user_id", userId).order("created_at");
  console.log(`\n--- owned vehicles: ${(cars ?? []).length} total ---`);

  const orphans = (cars ?? []).filter(
    (c) => !c.stored_in_property_id && !c.stored_in_vehicle_id &&
           (c.assigned_upgrade_id || c.slot_number !== null || c.sub_slot),
  );
  const plainUnassigned = (cars ?? []).filter(
    (c) => !c.stored_in_property_id && !c.stored_in_vehicle_id &&
           !c.assigned_upgrade_id && c.slot_number === null && !c.sub_slot,
  );
  const parked = (cars ?? []).filter((c) => c.stored_in_property_id);
  console.log(`  parked: ${parked.length} | orphaned-with-breadcrumb: ${orphans.length} | plain unassigned: ${plainUnassigned.length} | nested: ${(cars ?? []).filter(c => c.stored_in_vehicle_id).length}`);

  // Map every orphan's remembered upgrade back to the property it belongs to.
  const upIds = Array.from(new Set(orphans.map((o) => o.assigned_upgrade_id).filter(Boolean))) as string[];
  const upMap = new Map<string, { property_id: string; display_name: string; up_name: string }>();
  if (upIds.length) {
    const { data: ups } = await db.from("property_upgrades")
      .select("id, display_name, property_id, properties!inner(display_name)").in("id", upIds);
    for (const u of ups ?? []) {
      const pr = u.properties as unknown as { display_name: string };
      upMap.set(u.id as string, { property_id: u.property_id as string, display_name: pr.display_name, up_name: u.display_name as string });
    }
  }

  const ownedPropIdsByChar = new Map<string, Set<string>>();
  for (const p of props ?? []) {
    const k = (p.character_id as string) ?? "none";
    if (!ownedPropIdsByChar.has(k)) ownedPropIdsByChar.set(k, new Set());
    ownedPropIdsByChar.get(k)!.add(p.property_id as string);
  }

  console.log("\n--- ORPHANED CARS (unparked but still remember where they were) ---");
  for (const o of orphans) {
    const u = o.assigned_upgrade_id ? upMap.get(o.assigned_upgrade_id) : undefined;
    const stillOwns = u ? ownedPropIdsByChar.get((o.character_id as string) ?? "none")?.has(u.property_id) : undefined;
    console.log(
      ` car=${o.id.slice(0, 8)} char=${(o.character_id as string ?? "NULL").slice(0, 8)} ${(o.nickname ?? o.vehicle_id).padEnd(24)}` +
      ` upgrade=${o.assigned_upgrade_id ?? "-"} slot=${o.slot_number ?? "-"} sub=${o.sub_slot ?? "-"}` +
      (u ? `  => ${u.display_name} / ${u.up_name}  [property ${stillOwns ? "STILL OWNED" : "*** NO LONGER OWNED ***"}]` : "  => property unknown"),
    );
  }

  console.log("\n--- plain unassigned (no breadcrumb; may or may not be damage) ---");
  for (const c of plainUnassigned)
    console.log(` car=${c.id.slice(0, 8)} char=${(c.character_id as string ?? "NULL").slice(0, 8)} ${(c.nickname ?? c.vehicle_id)}  created=${c.created_at}`);

  const { data: plans } = await db.from("organizer_plans")
    .select("id, character_id, status, applied_at, created_at, undo_snapshot")
    .eq("user_id", userId).order("created_at", { ascending: false }).limit(25);
  console.log(`\n--- organizer plans (newest 25) — undo_snapshots are exact prior locations ---`);
  for (const p of plans ?? []) {
    const snap = p.undo_snapshot as { vehicles?: unknown[] } | null;
    console.log(` ${p.created_at} status=${p.status} applied=${p.applied_at ?? "-"} snapshot_vehicles=${snap?.vehicles?.length ?? 0} id=${p.id}`);
  }
  const withSnap = (plans ?? []).filter((p) => (p.undo_snapshot as { vehicles?: unknown[] } | null)?.vehicles?.length);
  if (withSnap.length) {
    console.log("\n--- newest snapshot contents ---");
    console.log(JSON.stringify(withSnap[0].undo_snapshot, null, 2).slice(0, 4000));
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
