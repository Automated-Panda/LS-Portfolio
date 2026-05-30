// One-off: optimize the dropped GT Vault brand PNGs into web-ready assets.
// Run: node scripts/place-brand.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...x) => join(ROOT, ...x);

const T = p("docs", "brand");
const lockupTransparent = join(T, "GTVault Lockup (Transparent).png");
const badge = join(T, "GTVault Logo 512x512.png"); // skyline badge (standalone mark)
const favicon = join(T, "favicon.png"); // simplified "GT" ring badge (favicon)

const fmt = (b) => `${(b.length / 1024).toFixed(1)}KB`;

// Tight content bounding box of a transparent PNG. Uses an alpha threshold so
// faint near-invisible edge artifacts (the source has a ~alpha-40 haze band
// glued to the bottom edge) are excluded — otherwise they leave a thin line
// and lopsided whitespace in the cropped logo.
async function contentBBox(file, thr = 64) {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const A = channels - 1;
  let top = height, bot = -1, left = width, right = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (data[(y * width + x) * channels + A] > thr) {
        if (y < top) top = y;
        if (y > bot) bot = y;
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  return { left, top, width: right - left + 1, height: bot - top + 1 };
}

const box = await contentBBox(lockupTransparent, 64);

// Sidebar + marketing-hero lockup (transparent → for the dark UI), tight-cropped
const logo = await sharp(lockupTransparent)
  .extract(box)
  .resize({ width: 600 })
  .png({ compressionLevel: 9 })
  .toBuffer({ resolveWithObject: true });
await sharp(logo.data).toFile(p("public", "logo.png"));

// Email-header lockup: same tight crop, flattened onto the template card colour
// (#161616) with padding, so it blends on the dark email and stays readable in
// clients that ignore transparency / force light mode.
const email = await sharp(lockupTransparent)
  .extract(box)
  .resize({ width: 440 })
  .extend({ top: 40, bottom: 40, left: 48, right: 48, background: "#161616" })
  .flatten({ background: "#161616" })
  .png({ compressionLevel: 9 })
  .toBuffer();
await sharp(email).toFile(p("public", "logo-email.png"));

// Favicon "GT" ring badge → browser favicon + apple touch icon
const fav = await sharp(favicon).metadata();
const icon = await sharp(favicon).resize(256, 256).png({ compressionLevel: 9 }).toBuffer();
await sharp(icon).toFile(p("app", "icon.png"));
const apple = await sharp(favicon).resize(180, 180).png({ compressionLevel: 9 }).toBuffer();
await sharp(apple).toFile(p("app", "apple-icon.png"));

// Skyline badge → standalone mark (larger/richer contexts)
const mark = await sharp(badge).resize(512, 512).png({ compressionLevel: 9 }).toBuffer();
await sharp(mark).toFile(p("public", "logo-mark.png"));

console.log("crop box           ", JSON.stringify(box));
console.log("public/logo.png    ", logo.info.width + "x" + logo.info.height, fmt(logo.data));
console.log("public/logo-email  ", fmt(email));
console.log("favicon source     ", fav.width + "x" + fav.height);
console.log("app/icon.png       ", "256x256", fmt(icon));
console.log("app/apple-icon.png ", "180x180", fmt(apple));
console.log("public/logo-mark   ", "512x512", fmt(mark));
