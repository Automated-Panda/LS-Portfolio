/**
 * Stage 3: build data/seed/properties.json from the hand-curated seed file.
 *
 * Image-path resolution: every instance of subtype X shares one image,
 * `data/images/properties/<subtype>.webp`. Per-property images come in a
 * later phase if a property needs visual differentiation from its siblings.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { writeJson } from "./lib/fs";
import { PROPERTIES_SEED } from "./data/properties-seed";
import type { Property } from "./schema";

const SEED_DIR = path.join("data", "seed");
const IMAGES_DIR = path.join("data", "images", "properties");

async function main(): Promise<void> {
  const properties: Property[] = PROPERTIES_SEED.map((p) => {
    const candidate = path
      .join(IMAGES_DIR, `${p.subtype}.webp`)
      .replace(/\\/g, "/");
    return {
      ...p,
      image_path: existsSync(candidate) ? candidate : null,
    };
  });

  const withImage = properties.filter((p) => p.image_path).length;
  const verifyCount = properties.filter((p) => p.verify).length;

  await writeJson(path.join(SEED_DIR, "properties.json"), properties);
  console.log(
    `Wrote ${properties.length} properties (${withImage} with cover image)`,
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
