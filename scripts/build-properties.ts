/**
 * Stage 3: build data/seed/properties.json from the hand-curated seed file.
 * No scraping needed — property list is small and curated.
 */
import path from "node:path";
import { writeJson } from "./lib/fs";
import { toSlug } from "./lib/slug";
import { PROPERTIES_SEED } from "./data/properties-seed";
import type { Property } from "./schema";

const SEED_DIR = path.join("data", "seed");
const IMAGES_DIR = path.join("data", "images", "properties");

async function main(): Promise<void> {
  const properties: Property[] = PROPERTIES_SEED.map((p) => ({
    ...p,
    image_path: path
      .join(IMAGES_DIR, `${toSlug(p.id)}.webp`)
      .replace(/\\/g, "/"),
  }));

  // Property images are not fetched automatically for Phase 0.
  // Cover images can be curated manually later. Paths are recorded
  // so the downstream import script knows where to look when they exist.

  await writeJson(path.join(SEED_DIR, "properties.json"), properties);
  console.log(`Wrote ${properties.length} properties`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
