/**
 * Applies data/seed/vehicle-availability.json to BOTH data/seed/vehicles.json
 * and the hosted DB. The sidecar lists only the non-available exceptions;
 * every other vehicle is reset to 'available'. Idempotent — safe to re-run
 * after editing the sidecar.
 *
 * Run with: npm run availability:apply  (loads .env.local for DB creds)
 *
 * This is a lightweight alternative to a full `build:vehicles` + `db:import`
 * when only availability changed. build-vehicles.ts applies the same overlay
 * during a full rebuild, so the two stay consistent.
 */
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readJson, writeJson } from "./lib/fs";
import type { Vehicle } from "./schema";

const SEED_DIR = path.join("data", "seed");
const VALID = new Set([
  "available",
  "discontinued",
  "unobtainable",
  "blacklisted",
  "seasonal",
]);

async function main(): Promise<void> {
  const sidecar = await readJson<Record<string, string>>(
    path.join(SEED_DIR, "vehicle-availability.json"),
  );

  const overrides: Record<string, string> = {};
  for (const [id, status] of Object.entries(sidecar)) {
    if (typeof status !== "string" || !VALID.has(status)) {
      throw new Error(`Invalid availability "${status}" for ${id}`);
    }
    if (status !== "available") overrides[id] = status;
  }

  // ---- patch vehicles.json ----
  const vehPath = path.join(SEED_DIR, "vehicles.json");
  const vehicles = await readJson<Vehicle[]>(vehPath);
  let patched = 0;
  for (const v of vehicles) {
    if (overrides[v.id]) {
      v.availability = overrides[v.id] as Vehicle["availability"];
      patched += 1;
    } else if (v.availability) {
      delete v.availability;
    }
  }
  await writeJson(vehPath, vehicles);
  console.log(`Patched vehicles.json: ${patched} non-available.`);

  // ---- sync DB ----
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log("No DB creds (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY) — skipping DB sync.");
    return;
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { error: resetErr } = await supabase
    .from("vehicles")
    .update({ availability: "available" })
    .neq("availability", "available");
  if (resetErr) throw new Error(`reset availability: ${resetErr.message}`);

  for (const [id, status] of Object.entries(overrides)) {
    const { error } = await supabase
      .from("vehicles")
      .update({ availability: status })
      .eq("id", id);
    if (error) throw new Error(`update ${id}: ${error.message}`);
  }
  console.log(`Synced DB: ${Object.keys(overrides).length} non-available.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
