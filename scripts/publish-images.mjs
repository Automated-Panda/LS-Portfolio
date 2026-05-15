// Copies the built images from data/images/{vehicles,properties} (the
// pipeline's output, source of truth) into public/{vehicles,properties} so
// Next can serve them.
// Run as: npm run images:publish
import { cpSync, mkdirSync, existsSync, readdirSync } from "node:fs";

function publish(src, dest, label) {
  if (!existsSync(src)) {
    console.warn(`Source folder ${src} does not exist; skipping ${label}.`);
    return;
  }
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true, force: true });
  const count = readdirSync(dest).filter((f) => f.endsWith(".webp")).length;
  console.log(`Published ${count} ${label} images to ${dest}/`);
}

publish("data/images/vehicles", "public/vehicles", "vehicle");
publish("data/images/properties", "public/properties", "property");
