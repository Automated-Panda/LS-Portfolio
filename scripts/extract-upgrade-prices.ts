/**
 * One-shot: parse `($N,NNN,NNN)` and similar money expressions out of
 * property_upgrade `notes` strings in the seed (and every business-seed source
 * file) and write a `price` field on each upgrade row in properties.json.
 *
 * Run with: npx tsx scripts/extract-upgrade-prices.ts
 *
 * The DB import (`npm run db:import`) will then push the new prices to
 * Supabase via the existing upsert pipeline.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

const PROPERTIES_JSON = path.join("data", "seed", "properties.json");

type PropertyUpgrade = {
  id: string;
  display_name: string;
  notes: string | null;
  price?: number | null;
  [k: string]: unknown;
};

type Property = {
  id: string;
  upgrades: PropertyUpgrade[];
  [k: string]: unknown;
};

// Match $N,NNN,NNN or $NNN,NNN or $1.75M-style currency strings.
// We anchor on the leading $ to avoid matching plain numbers.
const MONEY = /\$\s*([0-9][0-9,]*(?:\.[0-9]+)?(?:M|K)?)/g;

function parseMoney(raw: string): number | null {
  // "1,155,000" → 1155000; "1.75M" → 1750000; "320K" → 320000
  const s = raw.replace(/,/g, "").toUpperCase();
  const mMatch = s.match(/^([0-9.]+)M$/);
  if (mMatch) return Math.round(parseFloat(mMatch[1]) * 1_000_000);
  const kMatch = s.match(/^([0-9.]+)K$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1_000);
  const n = parseFloat(s);
  return Number.isFinite(n) ? Math.round(n) : null;
}

/**
 * Some notes contain multiple prices (e.g. "3 tiers ($150k–$290k)") or ranges.
 * Pick the SMALLEST sane number — that represents the cheapest available option
 * (matches the "base price" semantic for portfolio-value tracking).
 */
function extractPrice(notes: string | null): number | null {
  if (!notes) return null;
  const matches = [...notes.matchAll(MONEY)]
    .map((m) => parseMoney(m[1]))
    .filter((n): n is number => n !== null && n >= 1_000);
  if (matches.length === 0) return null;
  return Math.min(...matches);
}

async function main(): Promise<void> {
  const raw = await fs.readFile(PROPERTIES_JSON, "utf8");
  const props = JSON.parse(raw) as Property[];

  let patched = 0;
  let skipped = 0;
  let alreadySet = 0;

  for (const p of props) {
    for (const u of p.upgrades) {
      if (u.price !== undefined && u.price !== null) {
        alreadySet += 1;
        continue;
      }
      const price = extractPrice(u.notes);
      if (price === null) {
        skipped += 1;
        continue;
      }
      u.price = price;
      patched += 1;
    }
  }

  await fs.writeFile(PROPERTIES_JSON, JSON.stringify(props, null, 2), "utf8");
  console.log(
    `Extracted upgrade prices — patched ${patched}, skipped ${skipped} (no price in notes), already-set ${alreadySet}.`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
