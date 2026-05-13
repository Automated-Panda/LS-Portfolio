/**
 * Stage 2: transform data/raw/ into data/seed/vehicles.json + data/seed/manufacturers.json
 * and download normalized images into data/images/vehicles/.
 * Pure function of data/raw/ — safe to re-run.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { readJson, writeJson, fileExists } from "./lib/fs";
import { toSlug } from "./lib/slug";
import { parseFandomPage, fandomPageUrl } from "./lib/fandom";
import { deriveTagsForVehicle } from "./lib/tags";
import { detectVariantOf } from "./lib/variants";
import { downloadAndNormalize } from "./lib/image";
import type { Vehicle, Manufacturer, Tag } from "./schema";

const RAW_DIR = path.join("data", "raw");
const FANDOM_CACHE = path.join(RAW_DIR, "fandom-cache");
const SEED_DIR = path.join("data", "seed");
const IMAGES_DIR = path.join("data", "images", "vehicles");

const CLASS_FILTER: string[] | null = null;

const INCLUDED_TYPES = new Set([
  "CAR",
  "BIKE",
  "BICYCLE",
  "QUADBIKE",
  "AMPHIBIOUS_AUTOMOBILE",
  "SUBMARINECAR",
  "AMPHIBIOUS_QUADBIKE",
  "PLANE",
  "HELI",
  "BOAT",
  "SUBMARINE",
  "BLIMP",
]);

const GARAGE_STORABLE_TYPES = new Set([
  "CAR",
  "BIKE",
  "BICYCLE",
  "QUADBIKE",
  "AMPHIBIOUS_AUTOMOBILE",
  "SUBMARINECAR",
  "AMPHIBIOUS_QUADBIKE",
]);
const DURTYFREE_SOURCE_URL =
  "https://github.com/DurtyFree/gta-v-data-dumps/blob/master/vehicles.json";

interface DurtyFreeName {
  English?: string;
  Name?: string;
}

interface DurtyFreeVehicle {
  Name: string;
  DisplayName: DurtyFreeName | string;
  ManufacturerDisplayName?: DurtyFreeName | string;
  Manufacturer?: string;
  Class?: string;
  Type?: string;
}


function englishOf(v: DurtyFreeName | string | undefined, fallback: string): string {
  if (!v) return fallback;
  if (typeof v === "string") return v;
  return v.English || v.Name || fallback;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/\s+/)
    .map((w) => (w.length ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

async function main(): Promise<void> {
  console.log("Reading raw sources...");
  const vehiclesRaw = await readJson<DurtyFreeVehicle[]>(
    path.join(RAW_DIR, "vehicles.json"),
  );
  const manufacturersRaw = await readJson<string[]>(
    path.join(RAW_DIR, "vehiclesManufacturers.json"),
  );
  const tagDefs = await readJson<Record<string, Tag>>(
    path.join(SEED_DIR, "tags.json"),
  );

  const inScope = vehiclesRaw.filter((v) => {
    if (!v.Type || !INCLUDED_TYPES.has(v.Type)) return false;
    if (CLASS_FILTER === null) return true;
    return v.Class && CLASS_FILTER.includes(v.Class);
  });
  console.log(`${inScope.length} vehicles in scope`);

  const allInternalNames = new Set(vehiclesRaw.map((v) => v.Name.toLowerCase()));

  // Build id map first so variant_of can reference other ids.
  // Ids are derived from the game's internal name (unique by definition).
  const idMap = new Map<string, string>();
  for (const v of inScope) {
    const slug = toSlug(v.Name);
    if (slug) idMap.set(v.Name.toLowerCase(), slug);
  }

  const usedManufacturers = new Set<string>();
  const vehicles: Vehicle[] = [];
  let skipped = 0;

  for (const v of inScope) {
    const id = idMap.get(v.Name.toLowerCase());
    if (!id) {
      skipped++;
      continue;
    }
    const displayName = englishOf(v.DisplayName, v.Name);

    const fandomHtmlPath = path.join(FANDOM_CACHE, `${id}.html`);
    let fandomData = {
      display_name: null as string | null,
      image_url: null as string | null,
      categories: [] as string[],
    };
    if (await fileExists(fandomHtmlPath)) {
      const html = await fs.readFile(fandomHtmlPath, "utf8");
      fandomData = parseFandomPage(html);
    } else {
      console.log(`  no fandom cache for ${id}, using DurtyFree name only`);
    }

    // Image
    const imageOutPath = path.join(IMAGES_DIR, `${id}.webp`);
    const imageRelPath = imageOutPath.replace(/\\/g, "/");
    if (fandomData.image_url && !(await fileExists(imageOutPath))) {
      try {
        await downloadAndNormalize(fandomData.image_url, imageOutPath);
        console.log(`  img ${id}`);
      } catch (err) {
        console.log(`  img FAIL ${id}: ${(err as Error).message}`);
      }
    }

    // Manufacturer id
    const manufacturerId = toSlug(
      v.Manufacturer || englishOf(v.ManufacturerDisplayName, "unknown"),
    );
    usedManufacturers.add(manufacturerId);

    // Variant detection
    const parentInternal = detectVariantOf(
      v.Name.toLowerCase(),
      allInternalNames,
    );
    const variant_of = parentInternal ? idMap.get(parentInternal) ?? null : null;

    // Tags
    const tags = deriveTagsForVehicle(id, fandomData.categories, tagDefs);

    const fandomUrl = fandomPageUrl(displayName);

    vehicles.push({
      id,
      internal_name: v.Name,
      display_name: fandomData.display_name || displayName,
      manufacturer_id: manufacturerId,
      class: v.Class || "Unknown",
      release_update: null,
      is_garage_storable: GARAGE_STORABLE_TYPES.has(v.Type ?? ""),
      variant_of,
      tags,
      image_path: (await fileExists(imageOutPath)) ? imageRelPath : null,
      _sources: {
        durtyfree: DURTYFREE_SOURCE_URL,
        fandom: fandomUrl,
      },
    });
  }

  // Manufacturers file — only those referenced by in-scope vehicles
  const manufacturers: Record<string, Manufacturer> = {};
  for (const name of manufacturersRaw) {
    if (typeof name !== "string" || !name) continue;
    const id = toSlug(name);
    if (usedManufacturers.has(id)) {
      manufacturers[id] = {
        display: titleCase(name),
        country: null,
      };
    }
  }
  for (const id of usedManufacturers) {
    if (!manufacturers[id]) {
      manufacturers[id] = { display: titleCase(id.replace(/-/g, " ")), country: null };
    }
  }

  // Drop vehicles with no image for now — reportable via validate
  const missingImages = vehicles.filter((v) => !v.image_path);

  await writeJson(path.join(SEED_DIR, "vehicles.json"), vehicles);
  await writeJson(path.join(SEED_DIR, "manufacturers.json"), manufacturers);

  console.log(
    `Wrote ${vehicles.length} vehicles, ${
      Object.keys(manufacturers).length
    } manufacturers. Skipped: ${skipped}. Missing images: ${missingImages.length}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
