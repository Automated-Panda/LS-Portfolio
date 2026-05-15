# Phase 4b — Nightclubs Pilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the property data model from 15 type-level rows to per-instance rows. Pilot with 10 real-location Nightclubs (one per in-game neighborhood) carrying the full 6-upgrade pattern. Validates the granular-properties schema and the `/properties` UI end-to-end before fanning out to apartments, garages, businesses, etc.

**Architecture:** Additive migration on existing `properties` + `property_upgrades` tables — new columns `subtype`, `subtype_display`, `neighborhood`, `capacity`. New id convention `{subtype}-{slug}` (e.g. `nightclub-la-mesa`). Truncate-then-reimport: pre-launch, only James has any owned rows, so a clean reset is the simplest migration path (per the Phase 4b design spec). Other property types (apartments, garages, bunkers, etc.) come in follow-up sessions.

**Tech Stack:** Next.js 15 · TypeScript · Supabase (hosted, MCP plugin) · Zod · tsx · Sharp · shadcn/ui · Tailwind

**Verification approach (project-specific):** This project has no automated test framework — Phase 0–4a relied on `npm run typecheck` (TS errors), `npm run validate` (Zod + integrity), MCP `execute_sql` (row counts), and manual `/properties` browser smoke tests. This plan follows the same pattern. **Do not introduce a test framework as part of this work** — that's a separate decision.

**Reference spec:** [`docs/specs/2026-04-18-properties-granular-design.md`](../specs/2026-04-18-properties-granular-design.md)

---

## File Structure

**Created:**
- `supabase/migrations/0003_granular_properties.sql` — adds subtype / subtype_display / neighborhood / capacity columns, truncates existing rows, adds indexes
- `scripts/data/nightclubs-seed.ts` — 10 nightclub instances × 6 upgrades each
- `data/images/properties/nightclub.webp` — single type-level image shared by all 10 nightclub cards (handled outside this plan; placeholder fallback works without it)

**Modified:**
- `scripts/schema.ts` — `PropertySchema` adds `subtype`, `subtype_display`, `neighborhood`, `capacity`
- `scripts/data/properties-seed.ts` — replaces 15 type-level rows with imports from `nightclubs-seed.ts` (other types disabled for now, kept as commented blocks for easy revert in follow-up sessions)
- `scripts/build-properties.ts` — image-path resolution by `subtype` (so all `nightclub-*` instances point to one `nightclub.webp`) instead of by id
- `scripts/import-seed.ts` — writes the new columns into the `properties` upsert
- `lib/properties.ts` — `PropertySummary` adds `subtype`, `subtype_display`, `neighborhood`; `PropertyFilterOptions` adds `subtypes`, `neighborhoods`
- `lib/queries/properties.ts` — selects new columns; builds distinct `subtypes` + `neighborhoods` filter lists
- `app/(app)/properties/filter-bar.tsx` — adds a subtype pill row under the type row; swaps `location` dropdown → `neighborhood` dropdown
- `app/(app)/properties/property-card.tsx` — shows the neighborhood + subtype as the muted sub-line
- `docs/plan.md` — phase-progress entry for "Nightclubs pilot landed"

**Truncated (no schema change but data wiped):**
- `properties`, `property_upgrades`, `user_owned_properties`, `user_owned_property_upgrades` — cascaded from `properties` truncate

---

## Pre-flight checks

Before starting, confirm with James:

- [ ] He's OK losing his test ownership state on hosted Supabase (the spec assumes this; verify in-session).
- [ ] `.env.local` is currently pointing at **hosted** Supabase (the default per memory). If it's pointed at Docker, switch back before reimport.
- [ ] Working tree is clean (`git status`).

---

## Task 1: Schema migration — add granular columns + truncate

**Files:**
- Create: `supabase/migrations/0003_granular_properties.sql`

**Why truncate inside the migration:** Adding `subtype text NOT NULL` and `subtype_display text NOT NULL` to a table with existing rows fails unless we provide defaults or backfill. Truncating first is cleaner than carrying a deprecated default forever — and pre-launch this is safe per the spec.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0003_granular_properties.sql`:

```sql
-- Phase 4b: granular per-instance properties.
-- Existing 15 type-level rows are dropped; data is re-imported by
-- npm run db:import from the new instance-level seed.
-- Pre-launch, only test ownership state is lost.

-- 1. Drop existing rows (cascades through property_upgrades,
--    user_owned_properties, user_owned_property_upgrades).
truncate table public.properties cascade;

-- 2. Add per-instance columns. NOT NULL is safe now because the
--    table is empty after the truncate above.
alter table public.properties
  add column if not exists subtype          text not null,
  add column if not exists subtype_display  text not null,
  add column if not exists neighborhood     text,
  add column if not exists capacity         int  not null default 0;

-- 3. Index the new filterable columns.
create index if not exists properties_subtype_idx
  on public.properties(subtype);
create index if not exists properties_neighborhood_idx
  on public.properties(neighborhood);
```

- [ ] **Step 2: Apply via MCP plugin**

Use the supabase MCP plugin tool `apply_migration` with:
- `name`: `0003_granular_properties`
- `query`: the full SQL above

This applies directly to the hosted LSPortfolio project. The plugin records it in `supabase_migrations.schema_migrations` so it tracks alongside `0001_init` and `0002_revoke_handle_new_user`.

- [ ] **Step 3: Verify migration applied**

Use MCP `execute_sql` to run:

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public' and table_name = 'properties'
order by ordinal_position;
```

Expected: the four new columns (`subtype`, `subtype_display`, `neighborhood`, `capacity`) appear with correct types/nullability. `properties` row count is **0** (truncated):

```sql
select count(*) from public.properties;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0003_granular_properties.sql
git commit -m "$(cat <<'EOF'
Phase 4b: migration 0003 — granular property columns

Adds subtype, subtype_display, neighborhood, capacity columns to
public.properties. Truncates the table first (cascade) since the new
NOT NULL columns are incompatible with the existing 15 type-level rows;
data is re-imported from the new instance-level seed by npm run db:import.

Pre-launch, only James's test ownership state is lost.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Extend the Zod schema

**Files:**
- Modify: `scripts/schema.ts`

- [ ] **Step 1: Add fields to `PropertySchema`**

In `scripts/schema.ts`, update `PropertySchema` (around line 47–59) from:

```ts
export const PropertySchema = z.object({
  id: z.string().min(1),
  display_name: z.string().min(1),
  property_type: z.enum(["business", "residence", "garage", "special"]),
  location: z.string().nullable(),
  image_path: z.string().min(1).nullable(),
  counts_as_garage: z.boolean(),
  upgrades: z.array(PropertyUpgradeSchema),
  _sources: z.object({
    fandom: z.string().url().nullable(),
    gtabase: z.string().url().nullable(),
  }),
});
```

to:

```ts
export const PropertySchema = z.object({
  id: z.string().min(1),
  display_name: z.string().min(1),
  property_type: z.enum(["business", "residence", "garage", "special"]),
  subtype: z.string().min(1),
  subtype_display: z.string().min(1),
  location: z.string().nullable(),
  neighborhood: z.string().nullable(),
  capacity: z.number().int().min(0),
  image_path: z.string().min(1).nullable(),
  counts_as_garage: z.boolean(),
  upgrades: z.array(PropertyUpgradeSchema),
  _sources: z.object({
    fandom: z.string().url().nullable(),
    gtabase: z.string().url().nullable(),
  }),
  verify: z.boolean().optional(),
});
```

(`verify` is the optional per-row flag from the design spec — set to `true` on rows with guessed addresses so the build script can log a summary.)

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: errors in `scripts/data/properties-seed.ts` (referenced fields don't exist yet) and in `scripts/build-properties.ts` / `scripts/import-seed.ts`. That's expected — those get fixed in the following tasks. Don't commit yet.

---

## Task 3: Write the nightclubs seed file

**Files:**
- Create: `scripts/data/nightclubs-seed.ts`

- [ ] **Step 1: Create the seed file**

Create `scripts/data/nightclubs-seed.ts`:

```ts
import type { Property } from "../schema";

/**
 * GTA Online Nightclubs — 10 per-location instances.
 * Each instance carries the same 6-upgrade pattern (3 garage levels +
 * equipment + security + dry-ice). Garage Level 3 has +11 capacity to
 * include the MTL Pounder Custom slot.
 *
 * Some street addresses are best-effort and flagged `verify: true` for
 * a follow-up pass against the Fandom location pages.
 */

type LocationSeed = {
  id: string;
  display_name: string;
  neighborhood: string;
  address: string;
  verify?: boolean;
};

const LOCATIONS: LocationSeed[] = [
  { id: "nightclub-la-mesa",            display_name: "La Mesa Nightclub",            neighborhood: "La Mesa",            address: "1618 Popular St" },
  { id: "nightclub-mission-row",        display_name: "Mission Row Nightclub",        neighborhood: "Mission Row",        address: "South Mo Milton Drive",       verify: true },
  { id: "nightclub-del-perro",          display_name: "Del Perro Nightclub",          neighborhood: "Del Perro",          address: "Bay City Avenue",             verify: true },
  { id: "nightclub-downtown-vinewood",  display_name: "Downtown Vinewood Nightclub",  neighborhood: "Downtown Vinewood",  address: "Vinewood Boulevard",          verify: true },
  { id: "nightclub-strawberry",         display_name: "Strawberry Nightclub",         neighborhood: "Strawberry",         address: "Strawberry Avenue",           verify: true },
  { id: "nightclub-vespucci-canals",    display_name: "Vespucci Canals Nightclub",    neighborhood: "Vespucci Canals",    address: "Cougar Avenue",               verify: true },
  { id: "nightclub-west-vinewood",      display_name: "West Vinewood Nightclub",      neighborhood: "West Vinewood",      address: "Eclipse Boulevard",           verify: true },
  { id: "nightclub-elysian-island",     display_name: "Elysian Island Nightclub",     neighborhood: "Elysian Island",     address: "Norton Place",                verify: true },
  { id: "nightclub-cypress-flats",      display_name: "Cypress Flats Nightclub",      neighborhood: "Cypress Flats",      address: "Carson Avenue",               verify: true },
  { id: "nightclub-la-puerta",          display_name: "La Puerta Nightclub",          neighborhood: "La Puerta",          address: "Adam's Apple Boulevard",      verify: true },
];

function buildNightclub(loc: LocationSeed): Omit<Property, "image_path"> {
  return {
    id: loc.id,
    display_name: loc.display_name,
    property_type: "business",
    subtype: "nightclub",
    subtype_display: "Nightclub",
    location: loc.address,
    neighborhood: loc.neighborhood,
    capacity: 0, // capacity comes from the garage upgrades
    counts_as_garage: true,
    upgrades: [
      {
        id: `${loc.id}-garage-1`,
        display_name: "Storage Garage Level 1",
        tier: 1,
        capacity: 10,
        required_upgrade_id: null,
        notes: null,
      },
      {
        id: `${loc.id}-garage-2`,
        display_name: "Storage Garage Level 2",
        tier: 2,
        capacity: 10,
        required_upgrade_id: `${loc.id}-garage-1`,
        notes: null,
      },
      {
        id: `${loc.id}-garage-3`,
        display_name: "Storage Garage Level 3",
        tier: 3,
        capacity: 11,
        required_upgrade_id: `${loc.id}-garage-2`,
        notes: "Includes the MTL Pounder Custom slot",
      },
      {
        id: `${loc.id}-equipment`,
        display_name: "Equipment Upgrade",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Increases nightclub income generation",
      },
      {
        id: `${loc.id}-security`,
        display_name: "Security Upgrade",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Reduces raid frequency",
      },
      {
        id: `${loc.id}-dry-ice`,
        display_name: "Dry Ice Machine",
        tier: null,
        capacity: 0,
        required_upgrade_id: null,
        notes: "Cosmetic / perk",
      },
    ],
    _sources: {
      fandom: "https://gta.fandom.com/wiki/Nightclubs",
      gtabase: "https://www.gtabase.com/grand-theft-auto-v/guides/property-types/nightclubs",
    },
    ...(loc.verify ? { verify: true } : {}),
  };
}

export const NIGHTCLUBS_SEED: Omit<Property, "image_path">[] =
  LOCATIONS.map(buildNightclub);
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: still errors in `scripts/data/properties-seed.ts` and downstream — fixed in Task 4.

---

## Task 4: Replace the properties seed

**Files:**
- Modify: `scripts/data/properties-seed.ts`

- [ ] **Step 1: Rewrite to import nightclubs**

Replace the entire contents of `scripts/data/properties-seed.ts` with:

```ts
import type { Property } from "../schema";
import { NIGHTCLUBS_SEED } from "./nightclubs-seed";

/**
 * Phase 4b granular property seed. Each row is a single in-game
 * property instance (specific location), not a type-level archetype.
 *
 * Pilot scope: Nightclubs only (10 rows × 6 upgrades = 60 upgrade rows).
 * Apartments, garages, bunkers, offices, MC clubhouses, businesses,
 * vehicle warehouses, arcades, auto shops, agencies, salvage yards,
 * facilities, hangars, yachts, and biker businesses follow in
 * subsequent sessions.
 */
export const PROPERTIES_SEED: Omit<Property, "image_path">[] = [
  ...NIGHTCLUBS_SEED,
];
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: now only `scripts/build-properties.ts` and `scripts/import-seed.ts` should still be erroring (next tasks).

---

## Task 5: Update the build script for subtype-based images

**Files:**
- Modify: `scripts/build-properties.ts`

- [ ] **Step 1: Switch image-path lookup from id → subtype**

In the Phase 4b model, every `nightclub-*` instance shares one `nightclub.webp`. Replace the contents of `scripts/build-properties.ts` with:

```ts
/**
 * Stage 3: build data/seed/properties.json from the hand-curated seed file.
 *
 * Image-path resolution: every instance of subtype X shares one image,
 * `data/images/properties/<subtype>.webp`. Per-property images come in a
 * later phase if a property needs visual differentiation from its siblings.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { writeJson } from "./lib/fs";
import { PROPERTIES_SEED } from "./data/properties-seed";
import type { Property } from "./schema";

const SEED_DIR = path.join("data", "seed");
const IMAGES_DIR = path.join("data", "images", "properties");

async function main(): Promise<void> {
  const properties: Property[] = PROPERTIES_SEED.map((p) => {
    const candidate = path
      .join(IMAGES_DIR, `${p.subtype}.webp`)
      .replace(/\\/g, "/");
    return {
      ...p,
      image_path: existsSync(candidate) ? candidate : null,
    };
  });

  const withImage = properties.filter((p) => p.image_path).length;
  const verifyCount = properties.filter((p) => p.verify).length;

  await writeJson(path.join(SEED_DIR, "properties.json"), properties);
  console.log(
    `Wrote ${properties.length} properties (${withImage} with cover image)`,
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
```

- [ ] **Step 2: Run the build**

```bash
npm run build:properties
```

Expected output: `Wrote 10 properties (0 with cover image)` plus a verify-flagged summary (9 of 10 rows are flagged).

- [ ] **Step 3: Validate**

```bash
npm run validate
```

Expected: clean — Zod accepts the new shape, integrity checks pass.

---

## Task 6: Update the import script

**Files:**
- Modify: `scripts/import-seed.ts`

- [ ] **Step 1: Write new columns to the properties upsert**

In `scripts/import-seed.ts`, find the `propertyRows` mapping (around line 113–122) and update it from:

```ts
const propertyRows = properties.map((p) => ({
  id: p.id,
  display_name: p.display_name,
  property_type: p.property_type,
  location: p.location,
  image_path: p.image_path,
  counts_as_garage: p.counts_as_garage,
  source_fandom: p._sources.fandom,
  source_gtabase: p._sources.gtabase,
}));
```

to:

```ts
const propertyRows = properties.map((p) => ({
  id: p.id,
  display_name: p.display_name,
  property_type: p.property_type,
  subtype: p.subtype,
  subtype_display: p.subtype_display,
  location: p.location,
  neighborhood: p.neighborhood,
  capacity: p.capacity,
  image_path: p.image_path,
  counts_as_garage: p.counts_as_garage,
  source_fandom: p._sources.fandom,
  source_gtabase: p._sources.gtabase,
}));
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: clean (0 errors).

---

## Task 7: Reimport seed against hosted DB

- [ ] **Step 1: Run the import**

```bash
npm run db:import
```

Expected output includes:

```
Importing 10 properties...
Importing 60 property_upgrades...
  attaching 20 upgrade requirements...
Import complete.
```

(The 20 upgrade requirements come from the L2→L1 and L3→L2 chains, two per nightclub × 10 nightclubs.)

- [ ] **Step 2: Verify via MCP `execute_sql`**

Run:

```sql
select count(*) as properties from public.properties;
select count(*) as upgrades   from public.property_upgrades;
select count(*) as requires
  from public.property_upgrades
  where required_upgrade_id is not null;
select neighborhood, count(*)
  from public.properties
  group by neighborhood
  order by neighborhood;
```

Expected:
- 10 properties
- 60 upgrades
- 20 requires
- 10 distinct neighborhoods (1 property each)

- [ ] **Step 3: Commit the data + script changes**

```bash
git add scripts/schema.ts scripts/data/properties-seed.ts \
        scripts/data/nightclubs-seed.ts scripts/build-properties.ts \
        scripts/import-seed.ts data/seed/properties.json
git commit -m "$(cat <<'EOF'
Phase 4b: nightclubs seed + import (10 instances × 6 upgrades)

Replaces the 15 type-level property seed with per-instance rows.
Pilot scope is Nightclubs only — 10 locations, each carrying the same
6-upgrade pattern (3 garage levels + equipment + security + dry-ice).
Apartments, garages, businesses etc. fan out in follow-up sessions.

- scripts/schema.ts: PropertySchema adds subtype, subtype_display,
  neighborhood, capacity, and an optional verify flag.
- scripts/data/nightclubs-seed.ts: 10 LOCATIONS × buildNightclub().
- scripts/data/properties-seed.ts: collapses to NIGHTCLUBS_SEED only.
- scripts/build-properties.ts: image path now resolved from subtype
  (every nightclub-* shares one nightclub.webp); logs verify count.
- scripts/import-seed.ts: writes the new columns to the upsert.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Surface new columns in the client layer

**Files:**
- Modify: `lib/properties.ts`
- Modify: `lib/queries/properties.ts`

- [ ] **Step 1: Extend client types**

Replace the contents of `lib/properties.ts` with:

```ts
export type PropertyType = "residence" | "garage" | "business" | "special";

export type PropertySummary = {
  id: string;
  display_name: string;
  property_type: PropertyType;
  subtype: string;
  subtype_display: string;
  location: string | null;
  neighborhood: string | null;
  capacity: number;
  image_path: string | null;
  counts_as_garage: boolean;
  max_capacity: number;
  upgrade_count: number;
};

export type PropertyFilterOptions = {
  types: PropertyType[];
  subtypes: { id: string; display: string }[];
  neighborhoods: string[];
};

export function propertyImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const basename = imagePath.split("/").pop();
  return basename ? `/properties/${basename}` : null;
}

export function formatPropertyType(type: PropertyType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}
```

- [ ] **Step 2: Update the query**

Replace the contents of `lib/queries/properties.ts` with:

```ts
import { createClient } from "@/lib/supabase/server";
import type {
  PropertyFilterOptions,
  PropertySummary,
  PropertyType,
} from "@/lib/properties";

export type PropertiesBrowserData = {
  properties: PropertySummary[];
  ownedPropertyIds: string[];
  filters: PropertyFilterOptions;
};

export async function getPropertiesBrowserData(
  userId: string,
): Promise<PropertiesBrowserData> {
  const supabase = await createClient();

  const [
    { data: propertyRows, error: propsErr },
    { data: ownedRows, error: ownedErr },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select(
        `id, display_name, property_type, subtype, subtype_display,
         location, neighborhood, capacity, image_path, counts_as_garage,
         property_upgrades ( capacity )`,
      )
      .order("subtype_display", { ascending: true })
      .order("display_name", { ascending: true }),
    supabase
      .from("user_owned_properties")
      .select("property_id")
      .eq("user_id", userId),
  ]);

  if (propsErr) throw propsErr;
  if (ownedErr) throw ownedErr;

  type RawProperty = {
    id: string;
    display_name: string;
    property_type: PropertyType;
    subtype: string;
    subtype_display: string;
    location: string | null;
    neighborhood: string | null;
    capacity: number;
    image_path: string | null;
    counts_as_garage: boolean;
    property_upgrades: Array<{ capacity: number }> | null;
  };

  const raw = (propertyRows ?? []) as RawProperty[];

  const properties: PropertySummary[] = raw.map((p) => {
    const upgrades = p.property_upgrades ?? [];
    const upgradeMax = upgrades.reduce(
      (m, u) => Math.max(m, u.capacity ?? 0),
      0,
    );
    return {
      id: p.id,
      display_name: p.display_name,
      property_type: p.property_type,
      subtype: p.subtype,
      subtype_display: p.subtype_display,
      location: p.location,
      neighborhood: p.neighborhood,
      capacity: p.capacity,
      image_path: p.image_path,
      counts_as_garage: p.counts_as_garage,
      max_capacity: Math.max(p.capacity, upgradeMax),
      upgrade_count: upgrades.length,
    };
  });

  const typeSet = new Set<PropertyType>();
  const subtypeMap = new Map<string, string>();
  const nbhdSet = new Set<string>();
  for (const p of properties) {
    typeSet.add(p.property_type);
    subtypeMap.set(p.subtype, p.subtype_display);
    if (p.neighborhood) nbhdSet.add(p.neighborhood);
  }

  const typeOrder: PropertyType[] = ["residence", "garage", "business", "special"];

  return {
    properties,
    ownedPropertyIds: (ownedRows ?? []).map((r) => r.property_id),
    filters: {
      types: typeOrder.filter((t) => typeSet.has(t)),
      subtypes: Array.from(subtypeMap.entries())
        .map(([id, display]) => ({ id, display }))
        .sort((a, b) => a.display.localeCompare(b.display)),
      neighborhoods: Array.from(nbhdSet).sort(),
    },
  };
}
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: errors in `app/(app)/properties/filter-bar.tsx` and `app/(app)/properties/property-card.tsx` because `PropertyFilterOptions.locations` no longer exists. Fixed in Task 9.

---

## Task 9: Update `/properties` UI — subtype pills + neighborhood dropdown

**Files:**
- Modify: `app/(app)/properties/filter-bar.tsx`
- Modify: `app/(app)/properties/property-card.tsx`

> **Note:** You haven't yet read these two files. Read them first before editing — they're small but the existing prop names and URL-param keys vary. The Edit tool will refuse if you haven't.

- [ ] **Step 1: Read both files**

```
Read app/(app)/properties/filter-bar.tsx
Read app/(app)/properties/property-card.tsx
```

- [ ] **Step 2: Update `filter-bar.tsx`**

Apply these changes:
1. Rename the `locations` prop on `PropertyFilterOptions` consumers to `neighborhoods`.
2. Add a `subtypes: { id: string; display: string }[]` prop.
3. URL param `?loc=` → `?nbhd=`. Add a new `?subtype=` URL param.
4. Render the existing Type pill row, then a new **Subtype pill row** below it, then the search input and the neighborhood dropdown (replacing the location dropdown).
5. Subtype pills should default to "All subtypes" and toggle to the selected `subtype`. When the Type filter changes, clear the subtype selection if the current subtype is no longer represented in the filtered set.

Show the subtype row only when there are 2+ subtypes available after the Type filter narrows the list — otherwise it's noise (one subtype = no choice to make).

- [ ] **Step 3: Update `property-card.tsx`**

Show the muted sub-line as `{subtype_display} · {neighborhood ?? "Location unknown"}` instead of the current location chip. Keep the existing image overlay (`property_type` badge top-left), capacity chip, ownership toggle.

- [ ] **Step 4: Typecheck**

```bash
npm run typecheck
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add lib/properties.ts lib/queries/properties.ts \
        app/\(app\)/properties/filter-bar.tsx \
        app/\(app\)/properties/property-card.tsx
git commit -m "$(cat <<'EOF'
Phase 4b: /properties UI — subtype pills + neighborhood dropdown

PropertySummary surfaces subtype, subtype_display, neighborhood, capacity.
PropertyFilterOptions exposes distinct subtypes and neighborhoods. Filter
bar renders a subtype pill row under Type when 2+ subtypes are visible,
plus a neighborhood dropdown replacing the old location dropdown. Card
sub-line shows subtype · neighborhood.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Browser smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

Expected: server up on `http://localhost:3000`.

- [ ] **Step 2: Visit `/properties` logged in**

Verify:
- ✅ 10 nightclub cards render, ordered by `display_name`.
- ✅ Each card shows: `<location>` as image overlay (with type=Business badge), `<location_name>` as title, `Nightclub · <neighborhood>` muted sub-line, capacity 31 (10+10+11) or similar reflecting the upgrade max.
- ✅ Cards have the "No image" fallback (nightclub.webp not added yet — expected).
- ✅ Subtype pill row is hidden (only one subtype: Nightclub) — that's correct per the "show only when 2+" rule.
- ✅ Type pill row still works (filtering to "Residence" hides all 10, "Business" shows all 10).
- ✅ Neighborhood dropdown shows 10 distinct neighborhoods.
- ✅ Selecting a neighborhood narrows to 1 card.
- ✅ Search "La" matches La Mesa + La Puerta.
- ✅ Ownership toggle works (click card → emerald ring + check; reload → still owned).
- ✅ Sidebar Properties count updates when you toggle.

- [ ] **Step 3: Spot-check filters via URL**

Navigate to:
- `/properties?nbhd=La%20Mesa` → 1 card (La Mesa)
- `/properties?subtype=nightclub&type=business` → 10 cards
- `/properties?q=vinewood` → 2 cards (Downtown + West Vinewood)

- [ ] **Step 4: Spot-check via MCP one more time**

```sql
select id, display_name, subtype, neighborhood, capacity
  from public.properties
  order by display_name;
```

Confirm 10 rows, all `subtype = 'nightclub'`, all with neighborhoods.

If anything fails, stop and surface it for review before commit. Do NOT mark the task done if any check fails.

- [ ] **Step 5: Stop dev server, document the result**

Update `docs/plan.md` — add a new dated section at the top of "Where we left off" describing what landed and what's outstanding. Bump Phase 4 status note. Commit.

```bash
git add docs/plan.md
git commit -m "$(cat <<'EOF'
docs: plan.md — Phase 4b nightclubs pilot landed

10 per-location nightclub instances replace the old type-level row.
Granular columns (subtype/subtype_display/neighborhood/capacity) now
on properties. Filter UI adds subtype pills (hidden until 2+ subtypes)
and a neighborhood dropdown. Next: fan out to apartments + garages.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Out of scope this session (do NOT build)

These are deliberately deferred — write them down only as follow-up tasks in `docs/plan.md`, don't implement:

- **`nightclub.webp` image curation** — drop a single 600w webp into `data/images/properties/nightclub.webp`, run `npm run images:publish`, redeploy. Separate piece.
- **`/my-properties` upgrade-tier UI** — Phase 4c. Brainstorm next.
- **Other property types** (apartments, garages, businesses, etc.) — follow-up sessions per Phase 4b spec section "Fan out to remaining property types".
- **Vehicle→property linking schema** — separate plan (the layer between Phase 4b and the onboarding wizard).
- **Onboarding wizard** — final layer. Brainstorm + spec separately once Phase 4b fanout is far enough along.
- **Tightening NOT NULL on `subtype` / `subtype_display`** — already NOT NULL in migration 0003; nothing to follow up.
- **Renaming the old `location` column** to drop it in favor of `neighborhood + address` — leave both. `location` is still useful for the street address (e.g. "1618 Popular St") and `neighborhood` is the rollup. They're not redundant.

---

## Verification summary (run from the repo root)

After completion, these should all pass:

```bash
npm run typecheck       # 0 errors
npm run build:properties # writes 10 properties
npm run validate         # 0 errors
```

MCP `execute_sql`:

```sql
select count(*) from public.properties;                       -- 10
select count(*) from public.property_upgrades;                -- 60
select count(distinct neighborhood) from public.properties;    -- 10
```

Browser `/properties` shows 10 nightclub cards with subtype `Nightclub`, each in a distinct neighborhood, with ownership toggle wired.

---

## Self-review notes

- **Spec coverage:** All 7 steps from the Phase 4b spec's "What to build next session" section are covered. Step 8 (`/my-properties` upgrade UI) is explicitly out of scope and called out. Step 9 (fan-out to other property types) is explicitly deferred.
- **Placeholder scan:** None. All file paths, code blocks, SQL, and commands are concrete.
- **Type consistency:** `subtype`, `subtype_display`, `neighborhood`, `capacity` match across schema.ts, lib/properties.ts, lib/queries/properties.ts, import-seed.ts, the SQL migration, and the seed file.
- **Ambiguity:** Task 9 deliberately defers exact filter-bar layout to the implementer (after they read the current file) — the requirements (subtype pills, neighborhood dropdown, hide-when-1-subtype rule) are explicit, but the precise component composition follows the existing pattern.
