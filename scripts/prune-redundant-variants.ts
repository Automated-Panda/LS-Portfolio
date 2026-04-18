/**
 * Drop visually-indistinguishable variant_of rows.
 *
 * Two patterns are pruned:
 *   (1) Variant whose display_name matches its base's display_name
 *       (e.g. bison/bison2/bison3 — all labelled "Bison").
 *   (2) Multiple variants of the same base that share a display_name with
 *       each other but NOT the base (e.g. dune4/dune5 both "Ramp Buggy",
 *       base dune has a different display). Keep the lowest-id, drop the rest.
 *
 * Kept:
 *   - Every base vehicle (variant_of = null)
 *   - Variants whose display_name is unique in their group (e.g. Kuruma
 *     (Armored))
 *   - All drift-prefixed rows (handled separately by the drift UX layer)
 *
 * Run with: npm run vehicles:prune-variants
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SEED_PATH = path.join("data", "seed", "vehicles.json");
const IMAGES_DIR = path.join("data", "images", "vehicles");
const PUBLIC_DIR = path.join("public", "vehicles");

type SeedVehicle = {
  id: string;
  internal_name: string;
  display_name: string;
  variant_of: string | null;
};

function isDrift(v: SeedVehicle): boolean {
  return v.internal_name.toLowerCase().startsWith("drift");
}

async function safeUnlink(p: string): Promise<void> {
  try {
    await fs.unlink(p);
  } catch {
    // already gone
  }
}

async function main(): Promise<void> {
  const raw = await fs.readFile(SEED_PATH, "utf8");
  const vehicles = JSON.parse(raw) as SeedVehicle[];
  const byId = new Map(vehicles.map((v) => [v.id, v]));

  const droppable = new Set<string>();

  // Pattern 1: variant whose display matches its base's display.
  for (const v of vehicles) {
    if (!v.variant_of || isDrift(v)) continue;
    const base = byId.get(v.variant_of);
    if (base && base.display_name === v.display_name) droppable.add(v.id);
  }

  // Pattern 2: group by display_name; if no base (non-drift, non-variant) has
  // this display, keep the lowest-id non-drift variant and drop the rest.
  const byDisplay = new Map<string, SeedVehicle[]>();
  for (const v of vehicles) {
    const arr = byDisplay.get(v.display_name) ?? [];
    arr.push(v);
    byDisplay.set(v.display_name, arr);
  }
  for (const [, group] of byDisplay) {
    if (group.length < 2) continue;
    const bases = group.filter((v) => !v.variant_of && !isDrift(v));
    if (bases.length > 0) continue;
    const nonDriftVariants = group
      .filter((v) => v.variant_of && !isDrift(v))
      .filter((v) => !droppable.has(v.id))
      .sort((a, b) => a.id.localeCompare(b.id));
    for (let i = 1; i < nonDriftVariants.length; i++) {
      droppable.add(nonDriftVariants[i].id);
    }
  }

  const droppableIds = Array.from(droppable).sort();
  if (droppableIds.length === 0) {
    console.log("Nothing to prune.");
    return;
  }

  console.log(`Pruning ${droppableIds.length} redundant variants:`);
  for (const id of droppableIds) {
    const v = byId.get(id);
    console.log(`  - ${id} ("${v?.display_name}")`);
  }

  const kept = vehicles.filter((v) => !droppable.has(v.id));
  await fs.writeFile(SEED_PATH, JSON.stringify(kept, null, 2), "utf8");
  console.log(`\nSeed updated: ${vehicles.length} → ${kept.length}`);

  for (const id of droppableIds) {
    await safeUnlink(path.join(IMAGES_DIR, `${id}.webp`));
    await safeUnlink(path.join(PUBLIC_DIR, `${id}.webp`));
  }
  console.log(`Removed ${droppableIds.length} image files.`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log(
      "Skipping DB sync — NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.",
    );
    return;
  }
  const supabase = createClient(url, key);
  let deleted = 0;
  for (const id of droppableIds) {
    await supabase.from("vehicle_tag_links").delete().eq("vehicle_id", id);
    await supabase.from("user_owned_vehicles").delete().eq("vehicle_id", id);
    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) console.log(`  DB delete failed for ${id}: ${error.message}`);
    else deleted++;
  }
  console.log(`Deleted ${deleted} rows from DB.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
