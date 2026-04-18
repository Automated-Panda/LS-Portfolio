/**
 * Patch images for vehicles that either have no image or got a placeholder.
 *
 * Covers two cases:
 *  1. `image_path=null` in the seed (original 403s).
 *  2. `image_path` set but pointing at the known GTA Wiki "Site-community-image"
 *     placeholder — this happens when a Fandom page is a *disambiguation* and
 *     the parser fell through to `og:image`. Fix is to retry via the
 *     `_(HD_Universe)` variant, which is where GTA IV/V vehicle pages live
 *     when the plain name is a disambig.
 *
 * The script also drops any rows listed in `BOGUS_IDS` (mission-only AI-only
 * entries that slipped through the storable filter and have faction-name
 * display values).
 *
 * Run with: npm run images:fetch-missing
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import sharp from "sharp";
import { createClient } from "@supabase/supabase-js";

import { parseFandomPage } from "./lib/fandom";

// Aspect-ratio threshold: anything taller than ~0.9:1 is suspect. Car infobox
// shots from Fandom are always landscape; portrait/square usually means the
// parser grabbed a banner or icon instead of the vehicle shot.
const MIN_LANDSCAPE_RATIO = 1.1;

const SEED_PATH = path.join("data", "seed", "vehicles.json");
const IMAGES_DIR = path.join("data", "images", "vehicles");
const PUBLIC_DIR = path.join("public", "vehicles");

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
const FANDOM_DELAY_MS = 400;

// MD5 of the Fandom "Site-community-image" / site-logo placeholder that gets
// downloaded when a page is a disambiguation with no infobox.
const PLACEHOLDER_HASHES = new Set([
  "b769c5147526a0277bb8b69edf688da6",
]);

// Seed entries that don't represent real player-ownable vehicles (mission-only
// AI variants pointed at faction wiki pages, etc.). Dropped from seed + DB.
const BOGUS_IDS = new Set(["fbi", "fbi2"]);

// Manual Fandom URL overrides for vehicles whose seed-derived slug 404s.
const FANDOM_URL_OVERRIDES: Record<string, string> = {
  faction2: "https://gta.fandom.com/wiki/Faction_Custom",
  feltzer3: "https://gta.fandom.com/wiki/Stirling_GT",
  blade: "https://gta.fandom.com/wiki/Blade_(car)",
  vigilante: "https://gta.fandom.com/wiki/Vigilante_(car)",
  dukes: "https://gta.fandom.com/wiki/Dukes_(car)",
};

type SeedVehicle = {
  id: string;
  internal_name: string;
  display_name: string;
  image_path: string | null;
  _sources: { fandom?: string };
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function hashFile(p: string): Promise<string | null> {
  try {
    const buf = await fs.readFile(p);
    return crypto.createHash("md5").update(buf).digest("hex");
  } catch {
    return null;
  }
}

async function isSuspectImage(p: string): Promise<boolean> {
  try {
    const { width, height } = await sharp(p).metadata();
    if (!width || !height) return true;
    return width / height < MIN_LANDSCAPE_RATIO;
  } catch {
    return true;
  }
}

function hdUniverseVariant(url: string): string {
  return url.endsWith("_(HD_Universe)") ? url : `${url}_(HD_Universe)`;
}

async function tryFetchImage(fandomUrl: string): Promise<string | null> {
  const res = await fetch(fandomUrl, { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) return null;
  const parsed = parseFandomPage(await res.text());
  return parsed.image_url;
}

async function downloadAndNormalize(
  imageUrl: string,
  outPath: string,
): Promise<void> {
  const res = await fetch(imageUrl, { headers: { "User-Agent": BROWSER_UA } });
  if (!res.ok) throw new Error(`Image fetch ${res.status} for ${imageUrl}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await sharp(buf)
    .resize({ width: 600, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(outPath);
}

async function main(): Promise<void> {
  const raw = await fs.readFile(SEED_PATH, "utf8");
  let vehicles = JSON.parse(raw) as SeedVehicle[];

  // 1. Drop bogus entries.
  const droppedIds: string[] = [];
  vehicles = vehicles.filter((v) => {
    if (BOGUS_IDS.has(v.id)) {
      droppedIds.push(v.id);
      return false;
    }
    return true;
  });
  if (droppedIds.length > 0) {
    console.log(`Dropping bogus entries: ${droppedIds.join(", ")}`);
  }

  // 2. Build re-source list: null images + placeholder-hash images + portrait-
  //    aspect images (likely wrong grab off a disambig page).
  const needsReSource: SeedVehicle[] = [];
  for (const v of vehicles) {
    if (!v._sources?.fandom) continue;
    if (!v.image_path) {
      needsReSource.push(v);
      continue;
    }
    const h = await hashFile(v.image_path);
    if (h && PLACEHOLDER_HASHES.has(h)) {
      needsReSource.push(v);
      continue;
    }
    if (await isSuspectImage(v.image_path)) {
      needsReSource.push(v);
    }
  }
  console.log(`${needsReSource.length} vehicles need image re-sourcing.`);

  const patched: Array<{ id: string; image_path: string }> = [];
  const failed: string[] = [];

  for (const v of needsReSource) {
    const originalUrl = FANDOM_URL_OVERRIDES[v.id] ?? v._sources.fandom!;
    // Try HD_Universe variant first (catches disambig pages), then original.
    const candidates = [hdUniverseVariant(originalUrl), originalUrl];

    let imageUrl: string | null = null;
    let sourceUrl: string | null = null;
    for (const url of candidates) {
      try {
        imageUrl = await tryFetchImage(url);
        if (imageUrl) {
          sourceUrl = url;
          break;
        }
      } catch {
        // swallow and try next
      }
      await sleep(FANDOM_DELAY_MS);
    }

    if (!imageUrl) {
      console.log(`  ✗ ${v.id} — no image found via any URL`);
      failed.push(v.id);
      continue;
    }

    try {
      const outPath = path.join(IMAGES_DIR, `${v.id}.webp`);
      const pubPath = path.join(PUBLIC_DIR, `${v.id}.webp`);
      await downloadAndNormalize(imageUrl, outPath);
      await fs.mkdir(PUBLIC_DIR, { recursive: true });
      await fs.copyFile(outPath, pubPath);

      const relPath = outPath.replace(/\\/g, "/");
      v.image_path = relPath;
      patched.push({ id: v.id, image_path: relPath });
      console.log(`  ✓ ${v.id} ← ${sourceUrl}`);
    } catch (err) {
      console.log(`  ERR ${v.id}: ${(err as Error).message}`);
      failed.push(v.id);
    }

    await sleep(FANDOM_DELAY_MS);
  }

  if (patched.length > 0 || droppedIds.length > 0) {
    await fs.writeFile(SEED_PATH, JSON.stringify(vehicles, null, 2), "utf8");
    console.log(`\nUpdated ${SEED_PATH} (${patched.length} patched, ${droppedIds.length} dropped).`);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if ((patched.length > 0 || droppedIds.length > 0) && url && key) {
    const supabase = createClient(url, key);
    for (const p of patched) {
      const { error } = await supabase
        .from("vehicles")
        .update({ image_path: p.image_path })
        .eq("id", p.id);
      if (error) console.log(`  DB update failed for ${p.id}: ${error.message}`);
    }
    for (const id of droppedIds) {
      // Clean up dependent tables first to respect FK constraints.
      await supabase.from("vehicle_tag_links").delete().eq("vehicle_id", id);
      await supabase.from("user_owned_vehicles").delete().eq("vehicle_id", id);
      const { error } = await supabase.from("vehicles").delete().eq("id", id);
      if (error) console.log(`  DB delete failed for ${id}: ${error.message}`);
    }
    console.log(`Synced ${patched.length} image updates + ${droppedIds.length} deletes to DB.`);
  } else if ((patched.length > 0 || droppedIds.length > 0) && (!url || !key)) {
    console.log(
      "Skipping DB sync — NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.",
    );
  }

  console.log(
    `\nDone. ${patched.length} sourced, ${failed.length} still failed${
      failed.length ? `: ${failed.join(", ")}` : ""
    }, ${droppedIds.length} bogus dropped.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
