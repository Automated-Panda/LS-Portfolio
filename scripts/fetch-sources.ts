/**
 * Stage 1: pull all raw upstream data into data/raw/.
 * Idempotent — skips files already present unless --force is passed.
 * Network is only ever touched here; downstream stages read from data/raw/.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { ensureDir, fileExists } from "./lib/fs";
import { toSlug } from "./lib/slug";
import { fandomPageUrl } from "./lib/fandom";

const RAW_DIR = path.join("data", "raw");
const FANDOM_CACHE = path.join(RAW_DIR, "fandom-cache");

const DURTYFREE_BASE =
  "https://raw.githubusercontent.com/DurtyFree/gta-v-data-dumps/master";

const DURTYFREE_FILES = [
  { name: "vehicles.json", url: `${DURTYFREE_BASE}/vehicles.json` },
  { name: "vehiclesClasses.json", url: `${DURTYFREE_BASE}/vehiclesClasses.json` },
  {
    name: "vehiclesManufacturers.json",
    url: `${DURTYFREE_BASE}/vehiclesManufacturers.json`,
  },
];

const FORCE = process.argv.includes("--force");
const UA = "LSGarageManager-seed/0.1 (personal project)";
const FANDOM_DELAY_MS = 400;

const CLASS_FILTER: string[] | null = null;

const STORABLE_TYPES = new Set([
  "CAR",
  "BIKE",
  "BICYCLE",
  "QUADBIKE",
  "AMPHIBIOUS_AUTOMOBILE",
  "SUBMARINECAR",
  "AMPHIBIOUS_QUADBIKE",
]);

async function fetchToFile(url: string, outPath: string): Promise<void> {
  if (!FORCE && (await fileExists(outPath))) {
    console.log(`  skip (cached): ${path.basename(outPath)}`);
    return;
  }
  console.log(`  GET ${url}`);
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Fetch failed ${res.status}: ${url}`);
  const text = await res.text();
  await ensureDir(path.dirname(outPath));
  await fs.writeFile(outPath, text, "utf8");
}

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

interface DurtyFreeName {
  English?: string;
  Name?: string;
}

interface DurtyFreeVehicle {
  Name: string;
  DisplayName: DurtyFreeName | string;
  ManufacturerDisplayName?: DurtyFreeName | string;
  Manufacturer?: string;
  Class?: string;
  Type?: string;
}

function englishOf(v: DurtyFreeName | string | undefined, fallback: string): string {
  if (!v) return fallback;
  if (typeof v === "string") return v;
  return v.English || v.Name || fallback;
}

async function main(): Promise<void> {
  await ensureDir(RAW_DIR);
  await ensureDir(FANDOM_CACHE);

  console.log("Fetching DurtyFree dumps...");
  for (const f of DURTYFREE_FILES) {
    await fetchToFile(f.url, path.join(RAW_DIR, f.name));
  }

  console.log("Reading vehicles.json to determine Fandom scrape list...");
  const vehiclesRaw: DurtyFreeVehicle[] = JSON.parse(
    await fs.readFile(path.join(RAW_DIR, "vehicles.json"), "utf8"),
  );

  const inScope = vehiclesRaw.filter((v) => {
    if (!v.Type || !STORABLE_TYPES.has(v.Type)) return false;
    if (CLASS_FILTER === null) return true;
    return v.Class && CLASS_FILTER.includes(v.Class);
  });

  console.log(
    `${inScope.length} vehicles in scope (filter: ${
      CLASS_FILTER ? CLASS_FILTER.join(",") : "all"
    })`,
  );

  console.log("Fetching Fandom pages...");
  let fetched = 0;
  let skipped = 0;
  let failed = 0;
  for (const v of inScope) {
    const displayName = englishOf(v.DisplayName, v.Name);
    const id = toSlug(v.Name);
    if (!id) continue;
    const outPath = path.join(FANDOM_CACHE, `${id}.html`);
    if (!FORCE && (await fileExists(outPath))) {
      skipped++;
      continue;
    }
    const url = fandomPageUrl(displayName);
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA } });
      if (!res.ok) {
        console.log(`  ${res.status} ${displayName} → ${url}`);
        failed++;
        continue;
      }
      const html = await res.text();
      await fs.writeFile(outPath, html, "utf8");
      fetched++;
      await sleep(FANDOM_DELAY_MS);
    } catch (err) {
      console.log(`  ERR ${displayName}: ${(err as Error).message}`);
      failed++;
    }
  }
  console.log(
    `Fandom: ${fetched} fetched, ${skipped} cached, ${failed} failed`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
