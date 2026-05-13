/**
 * Stage 3: build data/seed/properties.json from the hand-curated seed file.
 * No scraping needed — property list is small and curated.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { writeJson } from "./lib/fs";
import { toSlug } from "./lib/slug";
import { PROPERTIES_SEED } from "./data/properties-seed";
import type { Property } from "./schema";

const SEED_DIR = path.join("data", "seed");
const IMAGES_DIR = path.join("data", "images", "properties");

async function main(): Promise<void> {
  // image_path is only set when a curated cover actually exists on disk;
  // otherwise the frontend falls back to the "No image" placeholder. Cover
  // images can be dropped into data/images/properties/{slug}.webp over time
  // without touching code or DB schema.
  const properties: Property[] = PROPERTIES_SEED.map((p) => {
    const candidate = path
      .join(IMAGES_DIR, `${toSlug(p.id)}.webp`)
      .replace(/\\/g, "/");
    return {
      ...p,
      image_path: existsSync(candidate) ? candidate : null,
    };
  });

  const withImage = properties.filter((p) => p.image_path).length;
  await writeJson(path.join(SEED_DIR, "properties.json"), properties);
  console.log(
    `Wrote ${properties.length} properties (${withImage} with cover image)`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
