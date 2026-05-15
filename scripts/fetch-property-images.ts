/**
 * Brute-force fetch per-instance property images from gtabase.com's CDN.
 *
 * For each property in data/seed/properties.json, generate a list of
 * candidate URLs based on subtype + id heuristics, fetch the first that
 * returns 200, normalize to webp at 600w, save as
 * data/images/properties/<id>.webp.
 *
 * Logs successes + failures. Re-run safely: existing webp files are skipped.
 *
 * Run:  npx tsx scripts/fetch-property-images.ts
 *       npx tsx scripts/fetch-property-images.ts --force      # re-fetch everything
 *       npx tsx scripts/fetch-property-images.ts --only=<id>  # one property
 */
import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

import sharp from "sharp";

import type { Property } from "./schema";

const PROPERTIES_JSON = path.join("data", "seed", "properties.json");
const OUT_DIR = path.join("data", "images", "properties");
const WIDTH = 600;
const QUALITY = 85;

// Subtype → list of gtabase URL "type" slugs to try (in order).
// Discovered by sampling property pages: MC clubhouses use "biker-clubhouse"
// not "clubhouse", biker businesses use "biker-business", etc.
const IMAGE_TYPES_BY_SUBTYPE: Record<string, string[]> = {
  nightclub: ["nightclub"],
  "high-end-apartment": ["apartment"],
  "mid-end-apartment": ["apartment"],
  "low-end-apartment": ["apartment"],
  "casino-penthouse": ["apartment"],
  "stand-alone-garage": ["garage"],
  "eclipse-blvd-garages": ["garage"],
  "ceo-office": ["office"],
  "mc-clubhouse": ["biker-clubhouse"],
  bunker: ["bunker"],
  facility: ["facility"],
  hangar: ["hangar"],
  agency: ["agency"],
  arcade: ["arcade"],
  "auto-shop": ["auto-shop"],
  "salvage-yard": ["salvage-yard"],
  "vehicle-warehouse": ["vehicle-warehouse"],
  yacht: ["yacht"],
  "biker-business-coke": ["biker-business"],
  "biker-business-meth": ["biker-business"],
  "biker-business-weed": ["biker-business"],
  "biker-business-cash": ["biker-business"],
  "biker-business-forgery": ["biker-business"],
};

// For biker businesses, gtabase slugs use the FULL business name + location,
// e.g. "cocaine-lockup-paleto-bay" not "paleto-bay" alone.
const BIKER_BUSINESS_NAME: Record<string, string> = {
  "biker-business-coke": "cocaine-lockup",
  "biker-business-meth": "methamphetamine-lab",
  "biker-business-weed": "weed-farm",
  "biker-business-cash": "counterfeit-cash-factory",
  "biker-business-forgery": "document-forgery-office",
};

const ADDR_EXPANSIONS: Array<[RegExp, string]> = [
  [/(^|-)dr(-|$)/g, "$1drive$2"],
  [/(^|-)st(-|$)/g, "$1street$2"],
  [/(^|-)ave(-|$)/g, "$1avenue$2"],
  [/(^|-)rd(-|$)/g, "$1road$2"],
  [/(^|-)blvd(-|$)/g, "$1boulevard$2"],
  [/(^|-)fwy(-|$)/g, "$1freeway$2"],
  [/(^|-)hwy(-|$)/g, "$1highway$2"],
  [/(^|-)pkwy(-|$)/g, "$1parkway$2"],
  // Compass-direction prefixes (e.g. "0112 S Rockford Dr" -> "south rockford drive")
  [/(^|-)s-/g, "$1south-"],
  [/(^|-)n-/g, "$1north-"],
  [/(^|-)e-/g, "$1east-"],
  [/(^|-)w-/g, "$1west-"],
];

function expandAbbrev(slug: string): string {
  let out = slug;
  for (const [re, sub] of ADDR_EXPANSIONS) out = out.replace(re, sub);
  return out;
}

/** Drop trailing -s after a word boundary if it looks possessive
 *  (e.g. "pixel-petes" -> "pixel-pete", but leave "towers" alone). */
function dropPossessiveS(slug: string): string {
  // Only strip when the segment-before-s ends in a consonant we recognise
  // as the singular form (pete -> petes is possessive; tower -> towers is plural).
  // This is heuristic; we add both forms to candidates anyway.
  return slug.replace(/-petes(-|$)/g, "-pete$1");
}

/** apt-N → aptN (no dash) variant gtabase uses for some apartment slugs. */
function joinAptNumber(slug: string): string {
  return slug.replace(/-apt-(\d+)/g, "-apt$1");
}

/** Stand-alone garage reorder: unit-N-<street> → <street>-unit-N */
function reverseUnitGarage(slug: string): string | null {
  const m = slug.match(/^unit-(\d+)-(.+)$/);
  return m ? `${m[2]}-unit-${m[1]}` : null;
}

/** Strip the subtype prefix from an id. */
function stripSubtype(id: string, subtype: string): string {
  return id.startsWith(subtype + "-") ? id.slice(subtype.length + 1) : id;
}

/** Build candidate gtabase image URLs for a property. */
function buildCandidates(prop: Property): string[] {
  const imageTypes = IMAGE_TYPES_BY_SUBTYPE[prop.subtype] ?? [prop.subtype];
  const stripped = stripSubtype(prop.id, prop.subtype);
  const slugs = new Set<string>();

  // -----------------------------------------------------------------
  // Subtype-specific slug rules (most authoritative — try first).
  // -----------------------------------------------------------------

  if (prop.subtype.startsWith("biker-business-")) {
    // gtabase: cocaine-lockup-paleto-bay
    const businessName = BIKER_BUSINESS_NAME[prop.subtype];
    slugs.add(`${businessName}-${stripped}`);
    // Also try with slugified neighborhood — handles cases where the id
    // has the location elements in a different order, e.g.
    // "vinewood-downtown" in id vs "downtown-vinewood" on gtabase, or
    // "san-chianski" in id vs full "san-chianski-mountain-range" name.
    if (prop.neighborhood) {
      const nbhdSlug = prop.neighborhood
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      slugs.add(`${businessName}-${nbhdSlug}`);
    }
  } else if (prop.subtype === "mc-clubhouse") {
    // gtabase: <location>-clubhouse, with -clubhouse-2 for 2-story variants
    if (stripped.endsWith("-1story")) {
      slugs.add(`${stripped.slice(0, -7)}-clubhouse`);
    } else if (stripped.endsWith("-2story")) {
      const base = stripped.slice(0, -7);
      slugs.add(`${base}-clubhouse-2`);
      slugs.add(`${base}-clubhouse`);
    } else {
      slugs.add(`${stripped}-clubhouse`);
    }
  } else if (prop.subtype === "yacht") {
    // 3 model variants; Aquarius is the canonical "base" model on gtabase.
    slugs.add("the-aquarius");
    slugs.add("the-pisces");
    slugs.add("the-orion");
  } else if (
    prop.subtype === "high-end-apartment" &&
    /^\d{4}-/.test(stripped)
  ) {
    // Stilt house — gtabase uses `stilt-<full-address>`
    const expanded = expandAbbrev(stripped);
    slugs.add(`stilt-${expanded}`);
    slugs.add(`stilt-${stripped}`);
  } else if (prop.subtype === "eclipse-blvd-garages") {
    // gtabase uses singular "garage"
    slugs.add("eclipse-blvd-garage");
  } else if (prop.subtype === "casino-penthouse") {
    slugs.add("master-penthouse-the-diamond");
  } else if (prop.id === "nightclub-la-puerta") {
    // gtabase indexes this nightclub under "LSIA" rather than "La Puerta".
    slugs.add("lsia-nightclub");
  }

  // -----------------------------------------------------------------
  // Generic patterns (try after subtype-specific).
  // -----------------------------------------------------------------

  for (const imgType of imageTypes) {
    slugs.add(`${stripped}-${imgType}`);
  }
  slugs.add(stripped);

  // Expanded address forms (drive vs dr, etc.)
  const expanded = expandAbbrev(stripped);
  if (expanded !== stripped) {
    for (const imgType of imageTypes) {
      slugs.add(`${expanded}-${imgType}`);
    }
    slugs.add(expanded);
  }

  // Stand-alone garages with "unit-N-<street>" pattern — also try reversed.
  if (prop.subtype === "stand-alone-garage") {
    for (const slug of [...slugs]) {
      const reversed = reverseUnitGarage(slug);
      if (reversed) slugs.add(reversed);
    }
    // Some standalone garages on gtabase carry a "garage-" prefix
    // (e.g. garage-innocence-boulevard).
    slugs.add(`garage-${expanded}`);
  }

  // Apartment slugs: gtabase uses "aptN" (no dash) more often than "apt-N";
  // also recognise the 3-Alta-Street-Tower "tower" variant.
  if (imageTypes.includes("apartment")) {
    for (const slug of [...slugs]) {
      const joined = joinAptNumber(slug);
      if (joined !== slug) slugs.add(joined);
    }
    if (stripped === "3-alta-st") {
      slugs.add("3-alta-street-tower");
    }
  }

  // Apostrophe-s normalisation (pixel-petes → pixel-pete).
  for (const slug of [...slugs]) {
    const dropped = dropPossessiveS(slug);
    if (dropped !== slug) slugs.add(dropped);
  }

  // Murrieta typo special-case: gtabase has "murietta" (sic) in some slugs
  if (stripped.includes("murrieta")) {
    for (const slug of [...slugs]) {
      slugs.add(slug.replace(/murrieta/g, "murietta"));
    }
  }

  // -----------------------------------------------------------------
  // Generate URLs: try webp (jch-optimize CDN) and jpg (original asset).
  // Also try a `full_` infix variant gtabase uses for some larger images.
  // -----------------------------------------------------------------

  const urls: string[] = [];
  for (const imgType of imageTypes) {
    for (const slug of slugs) {
      if (!slug) continue;
      urls.push(
        `https://www.gtabase.com/images/jch-optimize/ng/images_gta-5_properties_${imgType}_${slug}.webp`,
      );
      urls.push(
        `https://www.gtabase.com/images/jch-optimize/ng/images_gta-5_properties_${imgType}_full_${slug}.webp`,
      );
      urls.push(
        `https://www.gtabase.com/images/gta-5/properties/${imgType}/${slug}.jpg`,
      );
      urls.push(
        `https://www.gtabase.com/images/gta-5/properties/${imgType}/full/${slug}.jpg`,
      );
    }
  }
  return urls;
}

async function tryFetch(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (res.status !== 200) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength < 1500) return null; // gtabase serves ~1.2KB placeholder for 404s
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const force = args.includes("--force");
  const only = args.find((a) => a.startsWith("--only="))?.slice(7);

  await fs.mkdir(OUT_DIR, { recursive: true });

  const raw = await fs.readFile(PROPERTIES_JSON, "utf-8");
  const properties: Property[] = JSON.parse(raw);

  const targets = only ? properties.filter((p) => p.id === only) : properties;

  console.log(
    `Fetching images for ${targets.length} properties (force=${force})...`,
  );

  let success = 0;
  let skipped = 0;
  const failed: { id: string; subtype: string }[] = [];

  for (const prop of targets) {
    const dest = path.join(OUT_DIR, `${prop.id}.webp`);

    if (!force && existsSync(dest)) {
      skipped++;
      continue;
    }

    const candidates = buildCandidates(prop);
    let found = false;

    for (const url of candidates) {
      const buf = await tryFetch(url);
      if (!buf) continue;

      try {
        await sharp(buf)
          .resize({ width: WIDTH, withoutEnlargement: true })
          .webp({ quality: QUALITY })
          .toFile(dest);
        const filename = url.split("/").slice(-1)[0];
        console.log(`  ✓ ${prop.id}  (${filename})`);
        success++;
        found = true;
        break;
      } catch {
        // Body may not be a real image (HTML error page that slipped past
        // the size check). Try the next candidate.
        continue;
      }
    }

    if (!found) {
      console.log(`  ✗ ${prop.id}`);
      failed.push({ id: prop.id, subtype: prop.subtype });
    }
  }

  console.log(
    `\n  ✓ ${success} new  ·  ⏩ ${skipped} already present  ·  ✗ ${failed.length} failed`,
  );

  if (failed.length > 0) {
    const bySubtype = new Map<string, string[]>();
    for (const f of failed) {
      const arr = bySubtype.get(f.subtype) ?? [];
      arr.push(f.id);
      bySubtype.set(f.subtype, arr);
    }
    console.log("\nFailures by subtype:");
    for (const [subtype, ids] of [...bySubtype.entries()].sort()) {
      console.log(`  ${subtype} (${ids.length}):`);
      for (const id of ids) console.log(`    ${id}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
