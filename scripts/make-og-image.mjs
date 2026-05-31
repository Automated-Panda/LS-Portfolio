// One-off: build the 1200x630 Open Graph share image — the GT Vault lockup
// centered on the brand-dark background with the tagline beneath it.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const p = (...x) => join(ROOT, ...x);

const W = 1200, H = 630;

// Trim the transparent lockup to its content, scale to ~720px wide.
const lockup = await sharp(p("docs", "brand", "GTVault Lockup (Transparent).png"))
  .trim()
  .resize({ width: 720 })
  .toBuffer();
const lockMeta = await sharp(lockup).metadata();

// Tagline as centered SVG text.
const tagline = Buffer.from(
  `<svg width="${W}" height="120" xmlns="http://www.w3.org/2000/svg">
     <text x="50%" y="60%" text-anchor="middle"
       font-family="Arial, Helvetica, sans-serif" font-size="40" font-weight="700"
       fill="#a3a3a3">Track your entire GTA V empire</text>
   </svg>`,
);

const lockTop = Math.round(H / 2 - lockMeta.height / 2) - 50;

await sharp({
  create: { width: W, height: H, channels: 4, background: "#0a0a0a" },
})
  .composite([
    { input: lockup, top: lockTop, left: Math.round(W / 2 - lockMeta.width / 2) },
    { input: tagline, top: lockTop + lockMeta.height + 24, left: 0 },
  ])
  .webp({ quality: 88 })
  .toFile(p("public", "marketing", "og.webp"));

console.log(`og.webp ${W}x${H} written (lockup ${lockMeta.width}x${lockMeta.height})`);
