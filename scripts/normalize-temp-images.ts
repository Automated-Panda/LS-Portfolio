// One-off: normalize images dropped into docs/temp-images/ and move them
// into data/images/vehicles/ with the right internal_name.
//
// Filename stem = vehicle internal_name by default. Add entries to
// NAME_OVERRIDES when a drop's filename doesn't match the stored id
// (e.g. "liberator" is internally named "monster").

import { promises as fs } from "node:fs";
import path from "node:path";

import sharp from "sharp";

const SRC_DIR = path.resolve("docs/temp-images");
const OUT_DIR = path.resolve("data/images/vehicles");
const WIDTH = 600;
const QUALITY = 85;

const NAME_OVERRIDES: Record<string, string> = {
  liberator: "monster",
  caracara4x4: "caracara2",
};

async function main() {
  const entries = await fs.readdir(SRC_DIR);
  const images = entries.filter((f) =>
    /\.(png|jpe?g|webp|avif|gif)$/i.test(f),
  );

  if (images.length === 0) {
    console.log("No images found in docs/temp-images/");
    return;
  }

  await fs.mkdir(OUT_DIR, { recursive: true });

  for (const file of images) {
    const stem = path.basename(file, path.extname(file)).toLowerCase();
    const id = NAME_OVERRIDES[stem] ?? stem;
    const src = path.join(SRC_DIR, file);
    const dest = path.join(OUT_DIR, `${id}.webp`);

    const buf = await fs.readFile(src);
    const beforeKb = (buf.length / 1024).toFixed(1);

    await sharp(buf)
      .resize({ width: WIDTH, withoutEnlargement: true })
      .webp({ quality: QUALITY })
      .toFile(dest);

    const afterStat = await fs.stat(dest);
    const afterKb = (afterStat.size / 1024).toFixed(1);

    const renamed = id !== stem ? ` (renamed ${stem} → ${id})` : "";
    console.log(`✓ ${file} → ${id}.webp  (${beforeKb}KB → ${afterKb}KB)${renamed}`);
  }

  console.log(`\nNormalized ${images.length} image(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
