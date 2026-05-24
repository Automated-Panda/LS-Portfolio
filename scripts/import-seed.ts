/**
 * Reads data/seed/*.json and upserts reference data into Supabase.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 * (set in .env.local — this script bypasses RLS via the service role).
 *
 * Idempotent: safe to re-run; uses upsert on every table.
 */
// Env vars loaded via `tsx --env-file=.env.local` (see package.json `db:import`).
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readJson } from "./lib/fs";
import type { Vehicle, Property, Tag, Manufacturer } from "./schema";

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    "Missing env vars. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

const SEED_DIR = path.join("data", "seed");

async function main(): Promise<void> {
  const manufacturers = await readJson<Record<string, Manufacturer>>(
    path.join(SEED_DIR, "manufacturers.json"),
  );
  const tags = await readJson<Record<string, Tag>>(
    path.join(SEED_DIR, "tags.json"),
  );
  const vehicles = await readJson<Vehicle[]>(
    path.join(SEED_DIR, "vehicles.json"),
  );
  const properties = await readJson<Property[]>(
    path.join(SEED_DIR, "properties.json"),
  );

  // ---- manufacturers ----
  console.log(`Importing ${Object.keys(manufacturers).length} manufacturers...`);
  const manufacturerRows = Object.entries(manufacturers).map(([id, m]) => ({
    id,
    display: m.display,
    country: m.country,
  }));
  await upsert("manufacturers", manufacturerRows);

  // ---- vehicle_tags ----
  console.log(`Importing ${Object.keys(tags).length} vehicle_tags...`);
  const tagRows = Object.entries(tags).map(([id, t]) => ({
    id,
    display: t.display,
    rule: t.rule,
  }));
  await upsert("vehicle_tags", tagRows);

  // ---- vehicles ----
  console.log(`Importing ${vehicles.length} vehicles...`);
  const vehicleRows = vehicles.map((v) => ({
    id: v.id,
    internal_name: v.internal_name,
    display_name: v.display_name,
    manufacturer_id: v.manufacturer_id,
    class: v.class,
    release_update: v.release_update,
    is_garage_storable: v.is_garage_storable,
    variant_of: null as string | null, // set in second pass so parent rows exist
    image_path: v.image_path,
    source_durtyfree: v._sources.durtyfree,
    source_fandom: v._sources.fandom,
  }));
  await upsert("vehicles", vehicleRows);

  // second pass: attach variant_of now that all rows exist
  const variantUpdates = vehicles
    .filter((v) => v.variant_of)
    .map((v) => ({ id: v.id, variant_of: v.variant_of as string }));
  if (variantUpdates.length) {
    console.log(`  attaching ${variantUpdates.length} variant relationships...`);
    for (const row of variantUpdates) {
      const { error } = await supabase
        .from("vehicles")
        .update({ variant_of: row.variant_of })
        .eq("id", row.id);
      if (error) throw new Error(`update vehicle variant_of ${row.id}: ${error.message}`);
    }
  }

  // ---- vehicle_tag_links ----
  const linkRows: { vehicle_id: string; tag_id: string }[] = [];
  for (const v of vehicles) {
    for (const tagId of v.tags) {
      linkRows.push({ vehicle_id: v.id, tag_id: tagId });
    }
  }
  console.log(`Importing ${linkRows.length} vehicle_tag_links...`);
  // delete any existing links first so a changed tag set is fully re-applied
  const vehicleIds = vehicles.map((v) => v.id);
  const { error: delErr } = await supabase
    .from("vehicle_tag_links")
    .delete()
    .in("vehicle_id", vehicleIds);
  if (delErr) throw new Error(`clear vehicle_tag_links: ${delErr.message}`);
  await upsert("vehicle_tag_links", linkRows, "vehicle_id,tag_id");

  // ---- properties ----
  console.log(`Importing ${properties.length} properties...`);
  // Mirror migration 0005's ownership_group backfill: apartments + standalone
  // garages share the 'residential' pool (10-property cap post-Criminal
  // Enterprises). Other subtypes are their own group.
  const RESIDENTIAL_POOL = new Set([
    "high-end-apartment",
    "mid-end-apartment",
    "low-end-apartment",
    "stand-alone-garage",
  ]);
  const propertyRows = properties.map((p) => ({
    id: p.id,
    display_name: p.display_name,
    property_type: p.property_type,
    subtype: p.subtype,
    subtype_display: p.subtype_display,
    location: p.location,
    neighborhood: p.neighborhood,
    capacity: p.capacity,
    ownership_group: RESIDENTIAL_POOL.has(p.subtype) ? "residential" : p.subtype,
    image_path: p.image_path,
    counts_as_garage: p.counts_as_garage,
    source_fandom: p._sources.fandom,
    source_gtabase: p._sources.gtabase,
  }));
  await upsert("properties", propertyRows);

  // ---- property_upgrades ----
  const upgradeRows = properties.flatMap((p, _pi) =>
    p.upgrades.map((u, ui) => ({
      id: u.id,
      property_id: p.id,
      display_name: u.display_name,
      tier: u.tier,
      capacity: u.capacity,
      required_upgrade_id: null as string | null, // second pass
      notes: u.notes,
      sort_order: ui,
    })),
  );
  console.log(`Importing ${upgradeRows.length} property_upgrades...`);
  await upsert("property_upgrades", upgradeRows);

  const upgradeRequires = properties
    .flatMap((p) => p.upgrades)
    .filter((u) => u.required_upgrade_id)
    .map((u) => ({ id: u.id, required_upgrade_id: u.required_upgrade_id as string }));
  if (upgradeRequires.length) {
    console.log(`  attaching ${upgradeRequires.length} upgrade requirements...`);
    for (const row of upgradeRequires) {
      const { error } = await supabase
        .from("property_upgrades")
        .update({ required_upgrade_id: row.required_upgrade_id })
        .eq("id", row.id);
      if (error)
        throw new Error(`update property_upgrade required_upgrade_id ${row.id}: ${error.message}`);
    }
  }

  console.log("Import complete.");
}

async function upsert(
  table: string,
  rows: Record<string, unknown>[],
  onConflict = "id",
): Promise<void> {
  if (!rows.length) return;
  const chunkSize = 500;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(`upsert ${table} (chunk ${i}): ${error.message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
