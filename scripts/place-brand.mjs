// One-off: optimize the dropped GT Vault brand PNGs into web-ready assets.
// Run: node scripts/place-brand.mjs
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...x) => join(ROOT, ...x);

const T = p("docs", "brand");
const lockupTransparent = join(T, "GTVault Lockup (Transparent).png");
const lockupBlack = join(T, "GTVault Lockup (Black).png");
const badge = join(T, "GTVault Logo 512x512.png");

const fmt = (b) => `${(b.length / 1024).toFixed(1)}KB`;

// Sidebar + marketing-hero lockup (transparent → for the dark UI)
const logo = await sharp(lockupTransparent)
  .trim()
  .resize({ width: 600 })
  .png({ compressionLevel: 9 })
  .toBuffer({ resolveWithObject: true });
await sharp(logo.data).toFile(p("public", "logo.png"));

// Email-header lockup: transparent lockup flattened onto the template card
// colour (#161616) with padding, so it blends on the dark email yet stays a
// tidy, readable block in clients that ignore transparency / force light mode.
const email = await sharp(lockupTransparent)
  .trim()
  .resize({ width: 440 })
  .extend({ top: 40, bottom: 40, left: 48, right: 48, background: "#161616" })
  .flatten({ background: "#161616" })
  .png({ compressionLevel: 9 })
  .toBuffer();
await sharp(email).toFile(p("public", "logo-email.png"));

// Badge → favicon + apple icon + standalone mark
const icon = await sharp(badge).resize(256, 256).png({ compressionLevel: 9 }).toBuffer();
await sharp(icon).toFile(p("app", "icon.png"));
const apple = await sharp(badge).resize(180, 180).png({ compressionLevel: 9 }).toBuffer();
await sharp(apple).toFile(p("app", "apple-icon.png"));
const mark = await sharp(badge).resize(512, 512).png({ compressionLevel: 9 }).toBuffer();
await sharp(mark).toFile(p("public", "logo-mark.png"));

console.log("public/logo.png       ", logo.info.width + "x" + logo.info.height, fmt(logo.data));
console.log("public/logo-email.png ", "480w", fmt(email));
console.log("app/icon.png          ", "256x256", fmt(icon));
console.log("app/apple-icon.png    ", "180x180", fmt(apple));
console.log("public/logo-mark.png  ", "512x512", fmt(mark));
