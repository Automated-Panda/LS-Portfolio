/**
 * Patch manufacturer display names that should be all-caps acronyms but
 * came out title-cased from the DurtyFree source (e.g. "Mtl" → "MTL").
 *
 * Run with: npm run mfr:fix-acronyms
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const SEED_PATH = path.join("data", "seed", "manufacturers.json");

const ACRONYM_FIXES: Record<string, string> = {
  bf: "BF",
  hvy: "HVY",
  lcc: "LCC",
  mtl: "MTL",
};

async function main(): Promise<void> {
  const raw = await fs.readFile(SEED_PATH, "utf8");
  const mfrs = JSON.parse(raw) as Record<
    string,
    { display: string; country: string | null }
  >;

  const changed: Array<{ id: string; from: string; to: string }> = [];
  for (const [id, want] of Object.entries(ACRONYM_FIXES)) {
    if (!mfrs[id]) {
      console.log(`  skip ${id} — not in seed`);
      continue;
    }
    if (mfrs[id].display !== want) {
      changed.push({ id, from: mfrs[id].display, to: want });
      mfrs[id].display = want;
    }
  }

  if (changed.length === 0) {
    console.log("No changes needed — all acronyms already correct.");
    return;
  }

  await fs.writeFile(SEED_PATH, JSON.stringify(mfrs, null, 2), "utf8");
  for (const c of changed) console.log(`  ${c.id}: "${c.from}" → "${c.to}"`);
  console.log(`\nSeed updated: ${changed.length} manufacturer displays fixed.`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.log(
      "Skipping DB sync — NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set.",
    );
    return;
  }
  const supabase = createClient(url, key);
  for (const c of changed) {
    const { error } = await supabase
      .from("manufacturers")
      .update({ display: c.to })
      .eq("id", c.id);
    if (error) console.log(`  DB update failed for ${c.id}: ${error.message}`);
  }
  console.log(`Synced ${changed.length} rows to DB.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
