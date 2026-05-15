/**
 * Stage 3: build data/seed/properties.json from the hand-curated seed file.
 *
 * Image-path resolution: per-instance first, subtype-level fallback second.
 *   1. data/images/properties/<id>.webp           — unique per-property image
 *   2. data/images/properties/<subtype>.webp      — type-level fallback
 *   3. null                                       — UI shows "No image"
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
  const instanceImage = path
    .join(IMAGES_DIR, `${prop.id}.webp`)
    .replace(/\\/g, "/");
  if (existsSync(instanceImage)) return instanceImage;

  const subtypeImage = path
    .join(IMAGES_DIR, `${prop.subtype}.webp`)
    .replace(/\\/g, "/");
  if (existsSync(subtypeImage)) return subtypeImage;

  return null;
}

async function main(): Promise<void> {
  const properties: Property[] = PROPERTIES_SEED.map((p) => ({
    ...p,
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
