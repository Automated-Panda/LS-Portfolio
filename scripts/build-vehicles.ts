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

// DurtyFree's per-vehicle Manufacturer strings are truncated for some cars
// ("BENEFAC", "LAMPADA"), producing a duplicate manufacturer that collides with
// the correct one. Canonicalize the id so those vehicles fold onto the right
// manufacturer. DISPLAY overrides fix names that can't be recovered by
// title-casing the source string (e.g. "DEWBAUCH" -> "Dewbauchee").
const MANUFACTURER_ID_ALIASES: Record<string, string> = {
  benefac: "benefactor",
  lampada: "lampadati",
};
const MANUFACTURER_DISPLAY_OVERRIDES: Record<string, string> = {
  dewbauch: "Dewbauchee",
};

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
    let manufacturerId = toSlug(
      v.Manufacturer || englishOf(v.ManufacturerDisplayName, "unknown"),
    );
    manufacturerId = MANUFACTURER_ID_ALIASES[manufacturerId] ?? manufacturerId;
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
        display: MANUFACTURER_DISPLAY_OVERRIDES[id] ?? titleCase(name),
        country: null,
      };
    }
  }
  for (const id of usedManufacturers) {
    if (!manufacturers[id]) {
      manufacturers[id] = {
        display: MANUFACTURER_DISPLAY_OVERRIDES[id] ?? titleCase(id.replace(/-/g, " ")),
        country: null,
      };
    }
  }

  // Drop vehicles with no image for now — reportable via validate
  const missingImages = vehicles.filter((v) => !v.image_path);

  // Price overlay: data/seed/vehicle-prices.json is a flat { id: priceUSD }
  // sidecar — keeps prices out of the heavy build-from-raw pipeline while
  // still surviving a full rebuild.
  try {
    const overlayRaw = await fs.readFile(
      path.join(SEED_DIR, "vehicle-prices.json"),
      "utf8",
    );
    const overlay = JSON.parse(overlayRaw) as Record<string, unknown>;
    let priced = 0;
    for (const v of vehicles) {
      const raw = overlay[v.id];
      if (typeof raw === "number" && Number.isFinite(raw) && raw >= 0) {
        v.price = raw;
        priced += 1;
      }
    }
    console.log(`Applied price overlay: ${priced} / ${vehicles.length} priced.`);
  } catch {
    // Overlay file missing — that's fine, prices will just be null.
  }

  // Availability overlay: data/seed/vehicle-availability.json is a flat
  // { id: status } sidecar listing only the non-available exceptions. Everything
  // else defaults to "available".
  const VALID_AVAILABILITY = new Set([
    "available",
    "discontinued",
    "unobtainable",
    "blacklisted",
    "seasonal",
  ]);
  try {
    const overlayRaw = await fs.readFile(
      path.join(SEED_DIR, "vehicle-availability.json"),
      "utf8",
    );
    const overlay = JSON.parse(overlayRaw) as Record<string, unknown>;
    let flagged = 0;
    for (const v of vehicles) {
      const raw = overlay[v.id];
      if (typeof raw === "string" && VALID_AVAILABILITY.has(raw) && raw !== "available") {
        v.availability = raw as typeof v.availability;
        flagged += 1;
      }
    }
    console.log(`Applied availability overlay: ${flagged} non-available.`);
  } catch {
    // Overlay file missing — fine, everything stays "available".
  }

  // Vendor overlay: data/seed/vehicle-vendors.json maps id -> storefront,
  // derived from the cached Fandom "purchasable from X" categories.
  const VALID_VENDORS = new Set([
    "southern_san_andreas",
    "legendary_motorsport",
    "elitas_travel",
    "warstock",
    "dock_tease",
    "pedal_metal",
  ]);
  try {
    const overlayRaw = await fs.readFile(
      path.join(SEED_DIR, "vehicle-vendors.json"),
      "utf8",
    );
    const overlay = JSON.parse(overlayRaw) as Record<string, unknown>;
    let withVendor = 0;
    for (const v of vehicles) {
      const raw = overlay[v.id];
      if (typeof raw === "string" && VALID_VENDORS.has(raw)) {
        v.vendor = raw as typeof v.vendor;
        withVendor += 1;
      }
    }
    console.log(`Applied vendor overlay: ${withVendor} with a vendor.`);
  } catch {
    // Overlay file missing — fine, vendors will just be null.
  }

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
