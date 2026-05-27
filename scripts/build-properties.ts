/**
 * Stage 3: build data/seed/properties.json from the hand-curated seed file.
 *
 * Image-path resolution priority:
 *   1. data/images/properties/<id>.webp                 — unique per-instance
 *   2. data/images/properties/<parent_building>.webp    — tower-level (units inherit tower image)
 *   3. data/images/properties/<subtype>.webp            — type-level fallback
 *   4. null                                             — UI shows "No image"
 *
 * Use scripts/fetch-property-images.ts to source per-instance images from
 * gtabase. Subtype-level fallbacks are seeded manually (copy of a sample
 * instance) for subtypes where one or more instances lack a unique image.
 *
 * Pricing sidecar: data/seed/property-prices.json is a flat
 * { propertyId: priceUSD } map that's overlaid onto each property's
 * `price` field during build. Keeps prices canonical without bloating
 * every per-type seed file.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { writeJson } from "./lib/fs";
import { PROPERTIES_SEED } from "./data/properties-seed";
import type { Property } from "./schema";

const SEED_DIR = path.join("data", "seed");
const IMAGES_DIR = path.join("data", "images", "properties");
const PRICES_PATH = path.join(SEED_DIR, "property-prices.json");
const UPGRADE_PRICES_PATH = path.join(SEED_DIR, "upgrade-prices.json");

function loadJsonMap(filePath: string): Record<string, number> {
  try {
    const raw = readFileSync(filePath, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === "number" && Number.isFinite(v) && v >= 0) out[k] = v;
    }
    return out;
  } catch {
    return {};
  }
}

function resolveImagePath(prop: Omit<Property, "image_path">): string | null {
  const candidates = [prop.id];
  if (prop.parent_building) candidates.push(prop.parent_building);
  candidates.push(prop.subtype);

  for (const key of candidates) {
    const p = path.join(IMAGES_DIR, `${key}.webp`).replace(/\\/g, "/");
    if (existsSync(p)) return p;
  }
  return null;
}

async function main(): Promise<void> {
  const propertyPriceOverlay = loadJsonMap(PRICES_PATH);
  const upgradePriceOverlay = loadJsonMap(UPGRADE_PRICES_PATH);

  const properties: Property[] = PROPERTIES_SEED.map((p) => ({
    ...p,
    parent_building: p.parent_building ?? null,
    image_path: resolveImagePath(p),
    price: propertyPriceOverlay[p.id] ?? p.price ?? null,
    upgrades: p.upgrades.map((u) => ({
      ...u,
      price: upgradePriceOverlay[u.id] ?? u.price ?? null,
    })),
  }));

  const priced = properties.filter((p) => p.price !== null && p.price !== undefined).length;
  const totalUpgrades = properties.reduce((s, p) => s + p.upgrades.length, 0);
  const pricedUpgrades = properties.reduce(
    (s, p) => s + p.upgrades.filter((u) => u.price !== null && u.price !== undefined).length,
    0,
  );

  const withInstanceImage = properties.filter(
    (p) => p.image_path && p.image_path.endsWith(`${p.id}.webp`),
  ).length;
  const withSubtypeFallback = properties.filter(
    (p) => p.image_path && !p.image_path.endsWith(`${p.id}.webp`),
  ).length;
  const noImage = properties.filter((p) => !p.image_path).length;
  const verifyCount = properties.filter((p) => p.verify).length;

  await writeJson(path.join(SEED_DIR, "properties.json"), properties);
  console.log(`Wrote ${properties.length} properties`);
  console.log(
    `  ${withInstanceImage} unique · ${withSubtypeFallback} subtype fallback · ${noImage} no image`,
  );
  console.log(
    `  ${priced} priced · ${properties.length - priced} unpriced (properties)`,
  );
  console.log(
    `  ${pricedUpgrades} / ${totalUpgrades} upgrade prices`,
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
