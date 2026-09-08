// scripts/restore-orphaned-cars.ts
// Repairs the cross-character property-delete bug for ONE character: re-creates
// the owned-property rows that were deleted out from under the character, puts
// back the upgrades their cars reference, and re-parks every car that still
// remembers its floor/bay (assigned_upgrade_id), keeping its exact slot_number
// and sub_slot.
//
// Cars whose only breadcrumb is a slot_number (no assigned_upgrade_id) are NOT
// touched - the property they lived in is unknowable from the data.
//
// DRY RUN by default. Pass --apply to write.
//   pnpm exec tsx --env-file=.env.local scripts/restore-orphaned-cars.ts <email> [--apply]
import { createClient } from "@supabase/supabase-js";

const APPLY = process.argv.includes("--apply");

async function main() {
  const arg = process.argv[2];
  if (!arg || arg.startsWith("--")) {
    console.error("Usage: ... restore-orphaned-cars.ts <userId or email> [--apply]");
    process.exit(1);
  }
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId = arg;
  if (arg.includes("@")) {
    const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw new Error(error.message);
    const found = data.users.find((u) => u.email?.toLowerCase() === arg.toLowerCase());
    if (!found) { console.error(`No user with email ${arg}`); process.exit(1); }
    userId = found.id;
  }

  const { data: prof } = await db.from("profiles").select("active_character_id").eq("id", userId).maybeSingle();
  const characterId = prof?.active_character_id as string;
  if (!characterId) { console.error("No active character"); process.exit(1); }
  console.log(`${APPLY ? "APPLY" : "DRY RUN"}  user=${userId}  character=${characterId}\n`);

  // 1. Orphans that still remember a floor/bay.
  const { data: orphans } = await db.from("user_owned_vehicles")
    .select("id, vehicle_id, nickname, assigned_upgrade_id, slot_number, sub_slot")
    .eq("character_id", characterId)
    .is("stored_in_property_id", null)
    .is("stored_in_vehicle_id", null)
    .not("assigned_upgrade_id", "is", null);
  if (!orphans?.length) { console.log("Nothing to restore."); return; }

  // 2. Upgrade -> property.
  const upIds = Array.from(new Set(orphans.map((o) => o.assigned_upgrade_id as string)));
  const { data: ups } = await db.from("property_upgrades")
    .select("id, display_name, property_id, included_on_purchase").in("id", upIds);
  const upToProp = new Map((ups ?? []).map((u) => [u.id as string, u.property_id as string]));

  // 3. Group orphans by the property they belong to.
  const byProp = new Map<string, typeof orphans>();
  for (const o of orphans) {
    const pid = upToProp.get(o.assigned_upgrade_id as string);
    if (!pid) { console.log(`  ! unknown upgrade ${o.assigned_upgrade_id} on car ${o.id} - skipping`); continue; }
    if (!byProp.has(pid)) byProp.set(pid, [] as unknown as typeof orphans);
    byProp.get(pid)!.push(o);
  }

  const { data: propRows } = await db.from("properties")
    .select("id, display_name, ownership_group").in("id", [...byProp.keys()]);
  const propName = new Map((propRows ?? []).map((p) => [p.id as string, p.display_name as string]));

  // 4. What does the character already own (idempotency / re-run safety)?
  const { data: alreadyOwned } = await db.from("user_owned_properties")
    .select("id, property_id").eq("character_id", characterId);
  const ownedByProp = new Map((alreadyOwned ?? []).map((o) => [o.property_id as string, o.id as string]));

  let carsRestored = 0, propsCreated = 0;

  for (const [propertyId, cars] of byProp) {
    console.log(`--- ${propName.get(propertyId)} (${propertyId}) - ${cars.length} cars`);

    let ownedPropertyId = ownedByProp.get(propertyId);
    if (ownedPropertyId) {
      console.log(`    property already owned (${ownedPropertyId}) - reusing, not re-creating`);
    } else {
      console.log(`    CREATE user_owned_properties row`);
      if (APPLY) {
        const { data: row, error } = await db.from("user_owned_properties")
          .insert({ user_id: userId, character_id: characterId, property_id: propertyId })
          .select("id").single();
        if (error) throw new Error(`insert property ${propertyId}: ${error.message}`);
        ownedPropertyId = row.id as string;
      } else {
        ownedPropertyId = "<new>";
      }
      propsCreated++;
    }

    // 5. Upgrades: everything included_on_purchase, plus every upgrade these
    //    cars actually reference (Maze Bank West garage levels are not included).
    const { data: catalog } = await db.from("property_upgrades")
      .select("id, included_on_purchase, required_upgrade_id").eq("property_id", propertyId);
    const referenced = new Set(cars.map((c) => c.assigned_upgrade_id as string));
    const needed = new Set<string>();
    for (const u of catalog ?? []) {
      if (u.included_on_purchase || referenced.has(u.id as string)) needed.add(u.id as string);
    }
    // Pull in any prerequisite chain (garage-2 requires garage-1).
    let grew = true;
    while (grew) {
      grew = false;
      for (const u of catalog ?? []) {
        if (needed.has(u.id as string) && u.required_upgrade_id && !needed.has(u.required_upgrade_id as string)) {
          needed.add(u.required_upgrade_id as string); grew = true;
        }
      }
    }
    console.log(`    INSTALL upgrades: ${[...needed].join(", ") || "(none)"}`);
    if (APPLY && needed.size) {
      const { error } = await db.from("user_owned_property_upgrades").upsert(
        [...needed].map((u) => ({ user_owned_property_id: ownedPropertyId, property_upgrade_id: u })),
        { onConflict: "user_owned_property_id,property_upgrade_id", ignoreDuplicates: true },
      );
      if (error) throw new Error(`install upgrades on ${propertyId}: ${error.message}`);
    }

    // 6. Re-park the cars. slot_number / sub_slot / assigned_upgrade_id are left
    //    exactly as they are - only the lost parent link is restored.
    for (const c of cars) {
      console.log(`      park ${(c.nickname ?? c.vehicle_id).padEnd(22)} upgrade=${c.assigned_upgrade_id} slot=${c.slot_number ?? "-"} sub=${c.sub_slot ?? "-"}`);
      if (APPLY) {
        const { error } = await db.from("user_owned_vehicles")
          .update({ stored_in_property_id: ownedPropertyId })
          .eq("id", c.id).eq("character_id", characterId).is("stored_in_property_id", null);
        if (error) throw new Error(`park car ${c.id}: ${error.message}`);
      }
      carsRestored++;
    }
  }

  console.log(`\n${APPLY ? "APPLIED" : "WOULD APPLY"}: ${propsCreated} properties re-created, ${carsRestored} cars re-parked.`);
  if (!APPLY) console.log("Re-run with --apply to write.");
}
main().catch((e) => { console.error(e); process.exit(1); });
