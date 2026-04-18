// One-off: apply manual Benny's tag corrections from user review.
// Also fixes the Youga Custom manufacturer (Vapid → Bravado).
//
// Env vars loaded via `tsx --env-file=.env.local`.

import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import { readJson, writeJson } from "./lib/fs";
import type { Vehicle } from "./schema";

const TAG_ID = "bennys";
const SEED_PATH = path.join("data", "seed", "vehicles.json");

const REMOVE_BENNYS_FROM = [
  "comet2", // Pfister Comet
  "elegy2", // Elegy RH8
  "gauntlet3", // Bravado Gauntlet Classic
  "virgo3", // Dundreary Virgo Classic
  "youga2", // Bravado Youga Classic
  "youga3", // Bravado Youga Classic 4x4
];

const ADD_BENNYS_TO = [
  "elegy", // Elegy Retro Custom
  "youga4", // Bravado Youga Custom
];

const MANUFACTURER_FIXES: Array<{ id: string; manufacturer_id: string }> = [
  { id: "youga4", manufacturer_id: "bravado" },
];

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing env vars.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

async function main(): Promise<void> {
  const vehicles = await readJson<Vehicle[]>(SEED_PATH);
  const byId = new Map(vehicles.map((v) => [v.id, v]));

  let seedChanges = 0;

  for (const id of REMOVE_BENNYS_FROM) {
    const v = byId.get(id);
    if (!v) {
      console.warn(`  ! unknown id: ${id}`);
      continue;
    }
    if (v.tags.includes(TAG_ID)) {
      v.tags = v.tags.filter((t) => t !== TAG_ID);
      console.log(`  - ${id.padEnd(12)} (${v.display_name})  — bennys removed`);
      seedChanges++;
    } else {
      console.log(`  · ${id.padEnd(12)} (${v.display_name})  — already no bennys`);
    }
  }

  for (const id of ADD_BENNYS_TO) {
    const v = byId.get(id);
    if (!v) {
      console.warn(`  ! unknown id: ${id}`);
      continue;
    }
    if (!v.tags.includes(TAG_ID)) {
      v.tags = [...v.tags, TAG_ID];
      console.log(`  + ${id.padEnd(12)} (${v.display_name})  — bennys added`);
      seedChanges++;
    } else {
      console.log(`  · ${id.padEnd(12)} (${v.display_name})  — already has bennys`);
    }
  }

  for (const fix of MANUFACTURER_FIXES) {
    const v = byId.get(fix.id);
    if (!v) continue;
    if (v.manufacturer_id !== fix.manufacturer_id) {
      console.log(
        `  ~ ${fix.id.padEnd(12)} manufacturer  ${v.manufacturer_id} → ${fix.manufacturer_id}`,
      );
      v.manufacturer_id = fix.manufacturer_id;
      seedChanges++;
    }
  }

  if (seedChanges > 0) {
    await writeJson(SEED_PATH, vehicles);
    console.log(`\nSeed updated (${seedChanges} change(s)).`);
  } else {
    console.log("\nNo seed changes.");
  }

  // DB: delete bennys links for REMOVE list
  if (REMOVE_BENNYS_FROM.length) {
    const { error } = await supabase
      .from("vehicle_tag_links")
      .delete()
      .eq("tag_id", TAG_ID)
      .in("vehicle_id", REMOVE_BENNYS_FROM);
    if (error) throw new Error(`delete: ${error.message}`);
    console.log(`DB: removed bennys from ${REMOVE_BENNYS_FROM.length} vehicle(s).`);
  }

  // DB: insert bennys links for ADD list
  if (ADD_BENNYS_TO.length) {
    const rows = ADD_BENNYS_TO.map((vehicle_id) => ({
      vehicle_id,
      tag_id: TAG_ID,
    }));
    const { error } = await supabase
      .from("vehicle_tag_links")
      .upsert(rows, { onConflict: "vehicle_id,tag_id" });
    if (error) throw new Error(`insert: ${error.message}`);
    console.log(`DB: added bennys to ${ADD_BENNYS_TO.length} vehicle(s).`);
  }

  // DB: manufacturer fixes
  for (const fix of MANUFACTURER_FIXES) {
    const { error } = await supabase
      .from("vehicles")
      .update({ manufacturer_id: fix.manufacturer_id })
      .eq("id", fix.id);
    if (error) throw new Error(`update mfr ${fix.id}: ${error.message}`);
    console.log(`DB: ${fix.id} manufacturer → ${fix.manufacturer_id}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
