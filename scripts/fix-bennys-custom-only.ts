// One-off: apply "customs only" rule to the Benny's tag.
//
// For each vehicle V with `bennys` tag:
//   - If V is a variant (variant_of != null) → keep
//   - If V is a base and NO variant of V has `bennys` → keep (standalone custom)
//   - If V is a base AND some variant of V has `bennys` → strip `bennys` from V
//
// Updates data/seed/vehicles.json AND the Supabase `vehicle_tag_links` table.
// Env vars loaded via `tsx --env-file=.env.local`.

import path from "node:path";
import { createClient } from "@supabase/supabase-js";

import { readJson, writeJson } from "./lib/fs";
import type { Vehicle } from "./schema";

const TAG_ID = "bennys";
const SEED_PATH = path.join("data", "seed", "vehicles.json");

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "Missing env vars. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

async function main(): Promise<void> {
  const vehicles = await readJson<Vehicle[]>(SEED_PATH);

  const variantsOf = new Map<string, Vehicle[]>();
  for (const v of vehicles) {
    if (!v.variant_of) continue;
    const arr = variantsOf.get(v.variant_of) ?? [];
    arr.push(v);
    variantsOf.set(v.variant_of, arr);
  }

  const toStrip: string[] = [];
  for (const v of vehicles) {
    if (v.variant_of !== null) continue;
    if (!v.tags.includes(TAG_ID)) continue;
    const variants = variantsOf.get(v.id) ?? [];
    const someVariantTagged = variants.some((w) => w.tags.includes(TAG_ID));
    if (someVariantTagged) toStrip.push(v.id);
  }

  if (toStrip.length === 0) {
    console.log("Nothing to change — all bases already clean.");
    return;
  }

  console.log(`Stripping '${TAG_ID}' from ${toStrip.length} base vehicle(s):`);
  for (const id of toStrip) {
    const v = vehicles.find((x) => x.id === id);
    if (v) {
      v.tags = v.tags.filter((t) => t !== TAG_ID);
      console.log(`  - ${id}  (${v.display_name})`);
    }
  }

  await writeJson(SEED_PATH, vehicles);
  console.log(`\nSeed JSON updated.`);

  const { error: delErr } = await supabase
    .from("vehicle_tag_links")
    .delete()
    .eq("tag_id", TAG_ID)
    .in("vehicle_id", toStrip);
  if (delErr) {
    throw new Error(`delete vehicle_tag_links: ${delErr.message}`);
  }
  console.log(`DB tag links removed for ${toStrip.length} vehicles.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
