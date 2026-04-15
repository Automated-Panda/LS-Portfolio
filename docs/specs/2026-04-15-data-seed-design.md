# Data Seed & Repo Foundation — Design

**Date:** 2026-04-15
**Status:** Draft (pending user review)
**Scope:** Foundation for LS Garage Manager — repo structure, data sourcing pipeline, and seed JSON format. Precedes any backend or UI work.

---

## 1. Goals

Build the canonical dataset of GTA Online vehicles and properties as versioned JSON seed files, and establish a clean repo skeleton ready for Next.js + Supabase development.

**In scope for this phase:**
- Repo folder structure and initial config (Next.js app router, Tailwind, Supabase placeholders)
- Scraping/compilation pipeline that produces `data/seed/vehicles.json`, `data/seed/properties.json`, `data/seed/tags.json`, `data/seed/manufacturers.json`
- Normalized local vehicle images under `data/images/vehicles/`
- `docs/plan.md` living tracker
- Validation script for the seed files

**Explicitly out of scope:**
- Any Supabase setup (project, schema, migrations) — deferred to next phase
- Any UI implementation — deferred to a later phase
- Auto-organize, drag-and-drop, 3D views (per original MVP constraints)
- Per-slot x/y positions — deferred until the visual editor phase

---

## 2. Key Decisions (from brainstorm)

| Decision | Choice | Reasoning |
|---|---|---|
| Data persistence format | **JSON seed files in `data/seed/`** | Source of truth lives in git; DB becomes a cache. Safe re-imports on each DLC drop. |
| Initial vehicle scope | **"Super" class first, then widen** | Validates the full pipeline end-to-end on ~70 vehicles before scaling to ~600. Widening is a one-line filter flip. |
| Image storage | **Download + normalize to local `data/images/`** (WebP, 600px wide) | Self-contained, reviewable, no hotlinking. Migration to Supabase Storage is a trivial later step. |
| Tag strategy | **Curated tag list with derivation rules** | Short list of high-signal tags (Benny's, HSW, Imani Tech, Arena, Weaponized, Open Wheel, Drift, Lowrider). Rules defined in `tags.json`. |
| Frontend structure | **Single Next.js app with route groups** (`(marketing)`, `(app)`, `(auth)`) | Zero duplication, shared components and Supabase client, per-route static/dynamic compilation. Two-app split offers no real benefit for a solo project. |
| Nightclub/Office tiered upgrades | **Modelled as `property_upgrades` with per-upgrade capacity** | Matches how GTA actually works (levels are separate purchases), sums cleanly into total capacity. |
| Assignment model | **Vehicles store only `assigned_slot_id`** | Slot → upgrade → property is the chain. No denormalized duplication. |

---

## 3. Repo Structure

```
LS Garage Manager/
├── app/                               # Next.js 15 app router
│   ├── (marketing)/                   # public site: landing, about, pricing
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── (app)/                         # authenticated dashboard
│   │   ├── layout.tsx
│   │   └── dashboard/page.tsx
│   ├── (auth)/                        # login/signup
│   │   ├── layout.tsx
│   │   └── login/page.tsx
│   ├── globals.css
│   └── layout.tsx                     # root layout
├── components/
│   ├── ui/                            # shared primitives (shadcn later)
│   ├── marketing/
│   └── dashboard/
├── lib/
│   ├── supabase/                      # client setup (placeholder for now)
│   └── db/                            # typed DB helpers (later)
├── data/
│   ├── seed/                          # clean canonical output — committed
│   │   ├── vehicles.json
│   │   ├── properties.json
│   │   ├── tags.json
│   │   └── manufacturers.json
│   ├── images/
│   │   └── vehicles/                  # <slug>.webp, normalized 600px wide
│   └── raw/                           # untouched upstream dumps — gitignored
│       ├── durtyfree-vehicles.json
│       ├── mxamber-vehicles.json
│       └── fandom-cache/              # raw HTML, for debugging derivations
├── scripts/
│   ├── fetch-sources.ts               # network stage: pulls everything into data/raw/
│   ├── build-vehicles.ts              # raw → data/seed/vehicles.json + images
│   ├── build-properties.ts            # curated + Fandom enrichment
│   └── validate-seed.ts               # Zod schema + integrity checks
├── docs/
│   ├── plan.md                        # living plan / todo / test tracker
│   ├── specs/
│   │   └── 2026-04-15-data-seed-design.md
│   └── LS Garage Manager - Overview.txt
├── supabase/
│   └── migrations/                    # empty for now
├── public/                            # favicon, og images
├── .gitignore
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.mjs
├── tsconfig.json
└── package.json
```

**Why this shape:**
- `data/raw/` is gitignored: re-runnable cache, not a source of truth, can be large.
- `data/seed/` and `data/images/` are committed: they are the source of truth.
- `scripts/` are small single-purpose TS files runnable via `tsx`, not bundled with the Next app.
- Config files at root follow Next.js 15 conventions exactly so `npx next dev` just works once deps are installed.

---

## 4. Pipeline Architecture

### Sources (priority order)

| Source | Role | Why trusted |
|---|---|---|
| **DurtyFree/gta-v-data-dumps** | Canonical vehicle list (internal name, class, manufacturer, handling ID) | Dumped from game files, maintained to current DLC |
| **mxamber/gtavehicles** | "Is garage-storable" flag | Only source that tracks this explicitly |
| **GTA Fandom Wiki** | Display names, images, tag category membership | Human-curated, covers edge cases |
| **gtabase.com + Fandom** | Properties + upgrade capacities | Hand-curated seed, ~15 entries |

Every record in `vehicles.json` and `properties.json` carries a `_sources` field with the URLs it was derived from. Debuggability and audit trail are prioritized over compactness.

### Stages

1. **`fetch-sources.ts`** — The only stage that touches the network.
   - Downloads DurtyFree vehicles.json, classes.json, manufacturers.json
   - Downloads mxamber's dataset
   - For each storable vehicle in scope (see filter below): fetches its Fandom wiki page HTML and the linked infobox image
   - Writes everything to `data/raw/`
   - Re-running is safe: skips files already present unless `--force` passed

2. **`build-vehicles.ts`** — Pure function of `data/raw/`.
   - Reads DurtyFree as the base list
   - Filters to vehicles that (a) mxamber marks as storable, (b) match the class filter
   - Joins manufacturer display names
   - For each vehicle, parses the Fandom HTML to extract: display name, wiki categories (for tag derivation), image URL
   - Downloads and normalizes each image to 600px wide WebP via `sharp`, writes to `data/images/vehicles/<slug>.webp`
   - Applies tag derivation rules from `tags.json` against each vehicle's Fandom categories
   - Detects variants: if Fandom page links to a "base model" via a known pattern, sets `variant_of`
   - Writes the final `data/seed/vehicles.json`

3. **`build-properties.ts`** — Starts from a hand-curated TS source file.
   - Developer-maintained seed array of ~15 properties with their upgrades and capacities
   - Fetches Fandom images and normalizes them
   - Writes `data/seed/properties.json`
   - Smaller and more hand-curated than vehicles — the scraping value here is much lower, so we don't over-automate

4. **`validate-seed.ts`** — Pure validation, no network.
   - Runs Zod schemas against every seed file
   - Integrity checks: every `variant_of` references a real vehicle id; every `image_path` points to an existing file; no duplicate ids; every tag on a vehicle is defined in `tags.json`
   - Prints a report; exits non-zero on failure

### Scope filter

`build-vehicles.ts` has one top-of-file constant:

```ts
const CLASS_FILTER: string[] | null = ["Super"];
```

Initial pass: `["Super"]`. Validated pass: `null` (all classes). This is the only change required to widen scope.

---

## 5. JSON Schemas

All schemas are defined as Zod schemas in `scripts/schema.ts` and imported by both `build-*.ts` and `validate-seed.ts`.

### `vehicles.json` — array of:

```ts
{
  id: string;                  // kebab-case slug, e.g. "elegy-retro-custom"
  internal_name: string;       // DurtyFree game name, e.g. "elegy2"
  display_name: string;        // "Elegy Retro Custom"
  manufacturer_id: string;     // references manufacturers.json
  class: string;               // "Super", "Sports", etc.
  release_update: string | null;
  is_garage_storable: true;    // always true — non-storable filtered out
  variant_of: string | null;   // id of base vehicle, null if standalone
  tags: string[];              // ids from tags.json
  image_path: string;          // e.g. "data/images/vehicles/elegy-retro-custom.webp"
  _sources: {
    durtyfree: string;
    fandom: string;
  }
}
```

### `properties.json` — array of:

```ts
{
  id: string;                  // "nightclub"
  display_name: string;        // "Nightclub"
  property_type: "business" | "residence" | "garage" | "special";
  location: string | null;     // free text, nullable
  image_path: string;
  upgrades: [
    {
      id: string;              // "nightclub-garage-1"
      display_name: string;    // "Garage Level 1"
      tier: number | null;     // for tiered upgrades (1, 2, 3...) or null
      capacity: number;        // slot count this upgrade adds
      required_upgrade_id: string | null;  // dependency chain, if any
      notes: string | null;
    }
  ];
  _sources: {
    fandom: string | null;
    gtabase: string | null;
  }
}
```

### `tags.json` — object keyed by tag id:

```ts
{
  [tagId: string]: {
    display: string;           // "Benny's Original Motor Works"
    rule:
      | { type: "fandom_category"; category: string }
      | { type: "manual"; vehicle_ids: string[] };
  }
}
```

Initial curated tags: `bennys`, `hsw`, `imani_tech`, `arena`, `weaponized`, `open_wheel`, `drift`, `lowrider`.

### `manufacturers.json` — object keyed by manufacturer id:

```ts
{
  [manufacturerId: string]: {
    display: string;           // "Annis"
    country: string | null;
  }
}
```

---

## 6. Validation & Testing

### Automatic (via `validate-seed.ts`)

- Zod schema validation against every seed file
- Referential integrity: every `variant_of`, `manufacturer_id`, `tag`, `image_path` resolves
- No duplicate ids within a file
- Every `data/images/vehicles/*.webp` file is referenced by some vehicle (no orphans)
- `_sources` fields are present and non-empty

### Manual spot-checks (documented in `docs/plan.md` test checklist)

- Pick 5 random Super-class vehicles from the generated JSON and verify their display names, images, and tags against their Fandom pages
- Verify at least one Benny's vehicle, one HSW vehicle, and one Imani Tech vehicle are tagged correctly
- Verify variant detection: Elegy RH8 and Elegy Retro Custom should both exist as separate records, with Elegy Retro Custom's `variant_of` pointing to Elegy RH8's id
- Verify image normalization: open a few WebP files and confirm they're ~600px wide and reasonable file size

### CI / automation

None for this phase. Validation runs locally via `npm run validate`. CI comes later once there's actual app code to test.

---

## 7. Deliverables & Acceptance Criteria

This phase is **done** when:

1. ✅ Repo scaffold is in place per Section 3 (no npm install required yet — that's a separate user-initiated step)
2. ✅ `docs/plan.md` exists and is populated with the phase-by-phase plan and test checklist
3. ✅ This design doc exists and is approved by the user
4. ✅ All four scripts exist, documented, and runnable via `npm run <script>` after install
5. ✅ Running the pipeline end-to-end on the **Super class scope** produces:
   - `data/seed/vehicles.json` containing ~70 records
   - `data/seed/manufacturers.json` populated
   - `data/seed/tags.json` with 8 initial curated tags
   - `data/images/vehicles/` populated with matching WebP files
6. ✅ Running the properties builder produces `data/seed/properties.json` with all ~15 property types and their upgrades
7. ✅ `validate-seed.ts` exits cleanly with no errors
8. ✅ Manual spot-checks (Section 6) pass

**After this phase, the next phase is:** Supabase setup — create project, author schema migrations, write the import script that reads seed JSON and inserts into Postgres.

---

## 8. Risks & Open Questions

| Risk | Mitigation |
|---|---|
| Fandom HTML structure changes and breaks parser | `data/raw/fandom-cache/` preserves the snapshot; parser is isolated in one stage |
| DurtyFree + mxamber naming mismatches for the same vehicle | Join on `internal_name` (DurtyFree's modelName), fuzzy-match as fallback, log any unresolved cases in `validate-seed` report |
| Variant detection false negatives/positives | Initial pass is best-effort; spot-check report flags suspicious cases for manual review |
| Image licensing / ToS concerns for Fandom hotlinking | We download and store locally, which is far better than hotlinking but still worth revisiting before any public launch |
| `data/images/` repo growth when we widen to all classes | Estimate: ~600 vehicles × ~100KB each = ~60MB. Acceptable for git. Move to Supabase Storage before launch. |

---

## 9. Related Documents

- `docs/LS Garage Manager - Overview.txt` — original product spec
- `docs/plan.md` — living plan and progress tracker
