// Copies the built vehicle images from data/images/vehicles (the pipeline's
// output, source of truth) into public/vehicles so Next can serve them.
// Run as: npm run images:publish
import { cpSync, mkdirSync, existsSync, readdirSync } from "node:fs";

const src = "data/images/vehicles";
const dest = "public/vehicles";

if (!existsSync(src)) {
  console.error(`Source folder ${src} does not exist. Run the image pipeline first.`);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true, force: true });

const count = readdirSync(dest).filter((f) => f.endsWith(".webp")).length;
console.log(`Published ${count} vehicle images to ${dest}/`);
