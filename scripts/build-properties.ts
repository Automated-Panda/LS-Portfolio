/**
 * Stage 3: build data/seed/properties.json from the hand-curated seed file.
 *
 * Image-path resolution priority:
 *   1. data/images/properties/<id>.webp                 — unique per-instance
 *   2. data/images/properties/<parent_building>.webp    — tower-level (units inherit tower image)
 *   3. data/images/properties/<subtype>.webp            — type-level fallback
 *   4. null                                             — UI shows "No image"
 *
 * Use scripts/fetch-property-images.ts to source per-instance images from
 * gtabase. Subtype-level fallbacks are seeded manually (copy of a sample
 * instance) for subtypes where one or more instances lack a unique image.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { writeJson } from "./lib/fs";
import { PROPERTIES_SEED } from "./data/properties-seed";
import type { Property } from "./schema";

const SEED_DIR = path.join("data", "seed");
const IMAGES_DIR = path.join("data", "images", "properties");

function resolveImagePath(prop: Omit<Property, "image_path">): string | null {
  const candidates = [prop.id];
  if (prop.parent_building) candidates.push(prop.parent_building);
  candidates.push(prop.subtype);

  for (const key of candidates) {
    const p = path.join(IMAGES_DIR, `${key}.webp`).replace(/\\/g, "/");
    if (existsSync(p)) return p;
  }
  return null;
}

async function main(): Promise<void> {
  const properties: Property[] = PROPERTIES_SEED.map((p) => ({
    ...p,
    parent_building: p.parent_building ?? null,
    image_path: resolveImagePath(p),
  }));

  const withInstanceImage = properties.filter(
    (p) => p.image_path && p.image_path.endsWith(`${p.id}.webp`),
  ).length;
  const withSubtypeFallback = properties.filter(
    (p) => p.image_path && !p.image_path.endsWith(`${p.id}.webp`),
  ).length;
  const noImage = properties.filter((p) => !p.image_path).length;
  const verifyCount = properties.filter((p) => p.verify).length;

  await writeJson(path.join(SEED_DIR, "properties.json"), properties);
  console.log(`Wrote ${properties.length} properties`);
  console.log(
    `  ${withInstanceImage} unique · ${withSubtypeFallback} subtype fallback · ${noImage} no image`,
  );
  if (verifyCount > 0) {
    console.log(
      `  ⚠️  ${verifyCount} properties flagged for James to verify (verify: true)`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
