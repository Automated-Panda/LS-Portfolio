/**
 * Stage 4: validate data/seed/ against Zod schemas + referential integrity.
 * Exits non-zero if anything fails.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { readJson, fileExists } from "./lib/fs";
import {
  VehiclesFileSchema,
  PropertiesFileSchema,
  TagsFileSchema,
  ManufacturersFileSchema,
} from "./schema";
import type { Vehicle, Property, Tag, Manufacturer } from "./schema";

const SEED_DIR = path.join("data", "seed");
const IMAGES_DIR = path.join("data", "images", "vehicles");

interface Report {
  errors: string[];
  warnings: string[];
}

const report: Report = { errors: [], warnings: [] };
const err = (m: string) => report.errors.push(m);
const warn = (m: string) => report.warnings.push(m);

async function main(): Promise<void> {
  // Load + schema-validate
  const vehiclesRaw = await readJson<unknown>(path.join(SEED_DIR, "vehicles.json"));
  const propertiesRaw = await readJson<unknown>(
    path.join(SEED_DIR, "properties.json"),
  );
  const tagsRaw = await readJson<unknown>(path.join(SEED_DIR, "tags.json"));
  const manufacturersRaw = await readJson<unknown>(
    path.join(SEED_DIR, "manufacturers.json"),
  );

  const vehiclesParse = VehiclesFileSchema.safeParse(vehiclesRaw);
  if (!vehiclesParse.success) {
    err("vehicles.json: schema validation failed");
    for (const issue of vehiclesParse.error.issues) {
      err(`  ${issue.path.join(".")}: ${issue.message}`);
    }
  }
  const propertiesParse = PropertiesFileSchema.safeParse(propertiesRaw);
  if (!propertiesParse.success) {
    err("properties.json: schema validation failed");
    for (const issue of propertiesParse.error.issues) {
      err(`  ${issue.path.join(".")}: ${issue.message}`);
    }
  }
  const tagsParse = TagsFileSchema.safeParse(tagsRaw);
  if (!tagsParse.success) {
    err("tags.json: schema validation failed");
  }
  const manufacturersParse = ManufacturersFileSchema.safeParse(manufacturersRaw);
  if (!manufacturersParse.success) {
    err("manufacturers.json: schema validation failed");
  }

  if (report.errors.length) {
    finish();
    return;
  }

  const vehicles = vehiclesParse.data as Vehicle[];
  const properties = propertiesParse.data as Property[];
  const tags = tagsParse.data as Record<string, Tag>;
  const manufacturers = manufacturersParse.data as Record<string, Manufacturer>;

  // Referential integrity
  const vehicleIds = new Set(vehicles.map((v) => v.id));
  const tagIds = new Set(Object.keys(tags));
  const manufacturerIds = new Set(Object.keys(manufacturers));

  // Dupes
  const seenVehicleIds = new Set<string>();
  for (const v of vehicles) {
    if (seenVehicleIds.has(v.id)) err(`duplicate vehicle id: ${v.id}`);
    seenVehicleIds.add(v.id);
  }
  const seenPropertyIds = new Set<string>();
  for (const p of properties) {
    if (seenPropertyIds.has(p.id)) err(`duplicate property id: ${p.id}`);
    seenPropertyIds.add(p.id);
  }

  // Vehicle references
  for (const v of vehicles) {
    if (v.variant_of && !vehicleIds.has(v.variant_of)) {
      err(`${v.id}: variant_of references unknown ${v.variant_of}`);
    }
    if (!manufacturerIds.has(v.manufacturer_id)) {
      err(`${v.id}: unknown manufacturer ${v.manufacturer_id}`);
    }
    for (const t of v.tags) {
      if (!tagIds.has(t)) err(`${v.id}: unknown tag ${t}`);
    }
    if (v.image_path === null) {
      warn(`${v.id}: no image`);
    } else if (!(await fileExists(v.image_path))) {
      warn(`${v.id}: image file missing at ${v.image_path}`);
    }
  }

  // Property upgrade references
  for (const p of properties) {
    const upgradeIds = new Set(p.upgrades.map((u) => u.id));
    for (const u of p.upgrades) {
      if (u.required_upgrade_id && !upgradeIds.has(u.required_upgrade_id)) {
        err(
          `${p.id}.${u.id}: required_upgrade_id ${u.required_upgrade_id} not found in property`,
        );
      }
    }
  }

  // Orphan images
  try {
    const imageFiles = await fs.readdir(IMAGES_DIR);
    const referenced = new Set(
      vehicles
        .map((v) => v.image_path)
        .filter((p): p is string => typeof p === "string" && p.length > 0)
        .map((p) => path.basename(p)),
    );
    for (const f of imageFiles) {
      if (f === ".gitkeep") continue;
      if (!referenced.has(f)) warn(`orphan image: ${f}`);
    }
  } catch {
    warn(`images dir not readable: ${IMAGES_DIR}`);
  }

  finish();
}

function finish(): void {
  console.log("");
  console.log(`Errors:   ${report.errors.length}`);
  console.log(`Warnings: ${report.warnings.length}`);
  if (report.errors.length) {
    console.log("\n--- errors ---");
    for (const e of report.errors) console.log(`  ${e}`);
  }
  if (report.warnings.length) {
    console.log("\n--- warnings ---");
    for (const w of report.warnings.slice(0, 50)) console.log(`  ${w}`);
    if (report.warnings.length > 50)
      console.log(`  ... and ${report.warnings.length - 50} more`);
  }
  if (report.errors.length) {
    process.exit(1);
  } else {
    console.log("\nvalidate: OK");
  }
}

main().catch((err2) => {
  console.error(err2);
  process.exit(1);
});
