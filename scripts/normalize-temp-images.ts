// Drop-zone normalizer: take images from docs/temp-images/ and route them
// into data/images/vehicles/ OR data/images/properties/ depending on
// whether the filename stem matches a vehicle id or a property id.
//
// Filename stem = the id of the thing you're adding/replacing an image for.
// Convert to 600w webp, keep the path slot the same so the DB image_path
// (if already set) keeps pointing at it.
//
// Add entries to NAME_OVERRIDES when a drop's filename doesn't match the
// stored id (e.g. "liberator" is internally named "monster").
//
// After running this, run `npm run images:publish` to copy the new webps
// into public/ so Vercel serves them.

import { promises as fs } from "node:fs";
import path from "node:path";

import sharp from "sharp";

const SRC_DIR = path.resolve("docs/temp-images");
const VEHICLES_OUT = path.resolve("data/images/vehicles");
const PROPERTIES_OUT = path.resolve("data/images/properties");
const VEHICLES_JSON = path.resolve("data/seed/vehicles.json");
const PROPERTIES_JSON = path.resolve("data/seed/properties.json");

const WIDTH = 600;
const QUALITY = 85;

const NAME_OVERRIDES: Record<string, string> = {
  liberator: "monster",
  caracara4x4: "caracara2",
};

type WithId = { id: string };

async function loadIds(jsonPath: string): Promise<Set<string>> {
  try {
    const raw = await fs.readFile(jsonPath, "utf8");
    const rows = JSON.parse(raw) as WithId[];
    return new Set(rows.map((r) => r.id));
  } catch {
    return new Set();
  }
}

async function main() {
  const [entries, vehicleIds, propertyIds] = await Promise.all([
    fs.readdir(SRC_DIR),
    loadIds(VEHICLES_JSON),
    loadIds(PROPERTIES_JSON),
  ]);

  const images = entries.filter((f) =>
    /\.(png|jpe?g|webp|avif|gif)$/i.test(f),
  );

  if (images.length === 0) {
    console.log("No images found in docs/temp-images/");
    return;
  }

  await fs.mkdir(VEHICLES_OUT, { recursive: true });
  await fs.mkdir(PROPERTIES_OUT, { recursive: true });

  let vehicleCount = 0;
  let propertyCount = 0;
  let skipped = 0;

  for (const file of images) {
    const stem = path.basename(file, path.extname(file)).toLowerCase();
    const id = NAME_OVERRIDES[stem] ?? stem;

    let outDir: string;
    let kind: string;
    if (vehicleIds.has(id)) {
      outDir = VEHICLES_OUT;
      kind = "vehicle";
      vehicleCount += 1;
    } else if (propertyIds.has(id)) {
      outDir = PROPERTIES_OUT;
      kind = "property";
      propertyCount += 1;
    } else {
      console.warn(
        `⚠ ${file}: stem "${id}" matches no known vehicle or property id — skipped`,
      );
      skipped += 1;
      continue;
    }

    const src = path.join(SRC_DIR, file);
    const dest = path.join(outDir, `${id}.webp`);

    const buf = await fs.readFile(src);
    const beforeKb = (buf.length / 1024).toFixed(1);

    await sharp(buf)
      .resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(dest);

    const afterStat = await fs.stat(dest);
    const afterKb = (afterStat.size / 1024).toFixed(1);

    const renamed = id !== stem ? ` (renamed ${stem} → ${id})` : "";
    console.log(
      `✓ ${file} → ${kind}/${id}.webp  (${beforeKb}KB → ${afterKb}KB)${renamed}`,
    );
  }

  console.log(
    `\nNormalized ${vehicleCount} vehicle + ${propertyCount} property image(s)${skipped > 0 ? ` · ${skipped} skipped` : ""}.`,
  );
  if (vehicleCount > 0 || propertyCount > 0) {
    console.log(
      `\nNext step: npm run images:publish  (copies new webps to public/)`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
