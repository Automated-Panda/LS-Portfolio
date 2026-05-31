// One-off: normalize the dropped marketing screenshots into web-ready webp
// and report output dimensions (so the <Image> width/height props match).
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...x) => join(ROOT, ...x);
const T = p("docs", "temp-images");
const OUT = p("public", "marketing");

// source file -> { out name, target width }. Sources are all 1211x580.
const MAP = [
  { src: "dashboard.png", out: "dashboard.webp", width: 1600 }, // hero
  { src: "organizer.png", out: "organizer.webp", width: 1280 }, // Pro spotlight
  { src: "vehicles.png",  out: "vehicles.webp",  width: 1280 }, // showcase
  { src: "property.png",  out: "property.webp",  width: 1280 }, // showcase
];

for (const m of MAP) {
  const buf = await sharp(join(T, m.src))
    .resize({ width: m.width, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  await sharp(buf).toFile(join(OUT, m.out));
  const meta = await sharp(buf).metadata();
  console.log(
    `${m.out.padEnd(16)} ${meta.width}x${meta.height}  ${(buf.length / 1024).toFixed(0)}KB`,
  );
}
