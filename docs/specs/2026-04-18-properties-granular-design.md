# Phase 4b — Granular Properties Data Model

**Status:** Design approved 2026-04-18 (late night). Implementation deferred to next session.
**Pilot:** Nightclubs (10 locations × ~6 upgrade rows each) — chosen because they exercise both the per-instance property AND the per-instance upgrade flow.

---

## Context

The existing properties dataset is 15 **category-level** rows (e.g., "High-End Apartment", "Stand-Alone Garage", "Nightclub") with nested upgrade tiers. James's vision for the product is a full asset tracker where **every individual in-game property is its own entry** — every specific apartment address, every specific garage location, every individual nightclub. Roughly 300-400 rows total.

The current 15-row model can't support this — it conflates *type* with *instance*. A user owning "High-End Apartment" means nothing; they own *4 Integrity Way, Apt 30*.

This doc locks the design. Next session: implement nightclub pilot end-to-end (schema migration → data → image → UI for browse + upgrade selection).

---

## Decisions (from 2026-04-18 brainstorm)

| Decision | Choice | Rationale |
|---|---|---|
| Granularity | Every individual property instance | User ownership only means something at the address level. Long-term the right foundation for portfolio features (income totals, map view, etc.). |
| Data source | LLM draft sourced from Fandom list pages (verify flags for uncertain rows) | James can't fact-check 300 addresses from memory; Fandom's list pages are canonical. I pull from there + use domain knowledge as backfill. Flagged rows get user review. |
| Images — pilot | Type-level image (all instances of same subtype share one image) | 300+ per-property images is a separate project. Type-level gives visual identity at a glance and is fast. Per-property images land in a later phase. |
| Scope tonight | Design only | Time-boxed — actual implementation is tomorrow. |
| Pilot type | Nightclubs | Covers both the per-instance property pattern AND the per-instance upgrade pattern (nightclubs have garage floors + equipment upgrades), so we validate the whole flow in one type before scaling. |

---

## Schema Changes

Additive to the existing `properties` + `property_upgrades` schema. No table renames.

### `properties` table — new columns

| Column | Type | Notes |
|---|---|---|
| `subtype` | `text NOT NULL` | Kebab-case identifier: `nightclub`, `high-end-apartment`, `stand-alone-garage`, `bunker`, `ceo-office`, `mc-clubhouse`, `vehicle-warehouse`, `arcade`, `auto-shop`, `agency`, `salvage-yard`, `facility`, `hangar`, `yacht`, `biker-business-coke`, `biker-business-meth`, `biker-business-weed`, `biker-business-cash`, `biker-business-forgery`. Filters use this. |
| `subtype_display` | `text NOT NULL` | Human label: "Nightclub", "High-End Apartment", etc. Redundant w/ subtype but simpler at read time. |
| `neighborhood` | `text` (nullable) | "La Mesa", "East Vinewood", "Paleto Bay", etc. For map/group filtering. Nullable because some properties (yachts) don't have one. |
| `capacity` | `int NOT NULL default 0` | Baseline vehicle capacity. E.g., High-End Apartment = 10, Stand-Alone Garage (specific size) = 2/6/10, Nightclub = 0 (capacity comes from upgrades), Vehicle Warehouse = 40. |

**Kept as-is:**
- `id` — remains text PK. New id convention: `{subtype}-{slugified-address-or-area}` e.g., `nightclub-la-mesa`, `high-end-apt-4-integrity-way`, `stand-alone-garage-0112-south-rockford-drive`.
- `display_name` — now the property's address or location-specific name (e.g., `"La Mesa Nightclub"` or `"4 Integrity Way, Apt 30"`).
- `property_type` — existing enum (`residence`/`garage`/`business`/`special`) stays as the top-level classifier. Subtype is the fine-grained classifier *within* a type.
- `location` — keep, but now holds the address string (was "Various" in old model).
- `counts_as_garage`, `image_path`, `source_fandom`, `source_gtabase`, `created_at` — unchanged.

### `property_upgrades` — unchanged schema, new scale

Same columns. Rows now attach to **specific property instances** rather than types. E.g., each of the 10 Nightclubs has its own 6 upgrade rows (Garage L1/L2/L3 + Equipment + Security + Dry Ice Machine). Multiplies the total upgrade row count by property-instance count, but that's the right model — owning upgrades is per-instance.

### Migration strategy

Pre-launch, only James has owned rows, so a clean reset is safe:
1. Write migration `0002_granular_properties.sql` adding the new columns (with permissive defaults or temporary nullability).
2. `TRUNCATE properties CASCADE` — cascades through `property_upgrades`, `user_owned_properties`, `user_owned_property_upgrades`. James loses any test ownership state.
3. Re-import new granular seed via `npm run db:import`.
4. If desired, a follow-up migration tightens `subtype NOT NULL` etc. after data lands.

Image path convention: same as vehicles (`data/images/properties/<subtype>.webp`). For type-level images, every instance of `subtype=nightclub` shares `data/images/properties/nightclub.webp`. `scripts/publish-images.mjs` extends to publish this folder → `public/properties/`.

---

## Data Strategy

### Source of truth lives in code, not JSON

Unlike vehicles (auto-generated from DurtyFree), properties have always been a hand-curated seed (`scripts/data/properties-seed.ts`). Keep that pattern. Each property type gets its own section in the seed file or a sibling file, imported and flattened in `build-properties.ts`.

### Per-property data template

```ts
{
  id: "nightclub-la-mesa",
  subtype: "nightclub",
  subtype_display: "Nightclub",
  property_type: "business",
  display_name: "La Mesa Nightclub",
  location: "1618 Popular St, La Mesa",
  neighborhood: "La Mesa",
  capacity: 0,                         // nightclub itself stores 0; upgrades add capacity
  counts_as_garage: true,              // garage floors hold personal cars
  upgrades: [ /* see below */ ],
  sources: { fandom: "...", gtabase: null },
}
```

### ⚠️ Verify flag convention

For rows where I'm not fully confident (typical: exact addresses, prices, some upgrade-cost trivia), add `verify: true` at the row level in the seed. Build script logs a summary: `"12 properties flagged for James to verify"`. James spot-checks those; the flag gets removed as each is confirmed.

### Nightclub pilot data

All 10 Nightclub locations:

| ID | Name | Neighborhood |
|---|---|---|
| `nightclub-la-mesa` | La Mesa Nightclub | La Mesa |
| `nightclub-mission-row` | Mission Row Nightclub | Mission Row |
| `nightclub-del-perro` | Del Perro Nightclub | Del Perro |
| `nightclub-downtown-vinewood` | Downtown Vinewood Nightclub | Downtown Vinewood |
| `nightclub-strawberry` | Strawberry Nightclub | Strawberry |
| `nightclub-vespucci-canals` | Vespucci Canals Nightclub | Vespucci Canals |
| `nightclub-west-vinewood` | West Vinewood Nightclub | West Vinewood |
| `nightclub-elysian-island` | Elysian Island Nightclub | Elysian Island |
| `nightclub-cypress-flats` | Cypress Flats Nightclub | Cypress Flats |
| `nightclub-la-puerta` | La Puerta Nightclub | La Puerta |

Each has the following upgrades (same template per location):

| Upgrade ID suffix | Display | Tier | Capacity | Requires | Notes |
|---|---|---|---|---|---|
| `-garage-1` | Storage Garage Level 1 | 1 | 10 | — | First floor (+10 car) |
| `-garage-2` | Storage Garage Level 2 | 2 | 10 | `-garage-1` | Second floor (+10 car) |
| `-garage-3` | Storage Garage Level 3 | 3 | 10 | `-garage-2` | Third floor (+10 car) |
| `-equipment` | Equipment Upgrade | — | 0 | — | Boosts nightclub income |
| `-security` | Security Upgrade | — | 0 | — | Reduces raid frequency |
| `-dry-ice` | Dry Ice Machine | — | 0 | — | Cosmetic / perk |

(Capacity field on the upgrade already exists in schema.)

---

## UI Impact

### `/properties` browse page — incremental changes

- **Filter bar additions:** Subtype pill group (below the existing Type pills) — shows all subtypes present in the filtered set. E.g., filtering Type=Business shows subtype pills Nightclub / Bunker / MC Clubhouse / etc. Clears gracefully between Type changes.
- **Neighborhood dropdown** — replaces the current Location dropdown, populated from distinct `neighborhood` values. (`location` was "Various" everywhere and not useful.)
- **Card:** add small subtype line below `display_name` (muted), e.g., `"La Mesa Nightclub"` / `"Nightclub · Business"` in the muted sub-line.
- No change to ownership toggle.

### `/my-properties` — new work

Not in the current pilot; current page is a stub. Upgrade selection UI to be designed next session. Rough shape:
- List of owned properties
- Click one → expandable detail or `/my-properties/[id]` page with upgrade checkboxes
- Enforce `required_upgrade_id` chains (can't check L2 without L1)
- Writes to `user_owned_property_upgrades` table (already exists in schema)

### `/my-businesses` — stays stub for now

Nightclubs are businesses so they'll show up here eventually. Same upgrade pattern as `/my-properties`.

---

## What to build next session (in order)

1. **Migration `0002_granular_properties.sql`** — add `subtype`, `subtype_display`, `neighborhood`, `capacity` columns. Keep old data for now (don't truncate yet).
2. **Rewrite `scripts/data/properties-seed.ts`** — start with nightclubs (10 rows × 6 upgrades = 60 upgrade rows). Keep old data disabled/commented for easy revert.
3. **Sharp script to build a single type-level nightclub image** — user drops a `nightclub.webp` into `docs/temp-images/`, normalize-temp-images picks it up. Extend that script to also route to `data/images/properties/` when filename matches a property subtype.
4. **Truncate + reimport** — once pilot looks good, truncate properties and re-import.
5. **Update `lib/properties.ts` + `lib/queries/properties.ts`** — pull new columns; expose distinct subtype + neighborhood in filter options.
6. **Update `/properties` filter bar + card** — add subtype pills, swap location dropdown for neighborhood.
7. **Validate in browser** — verify 10 nightclubs appear, filter works, ownership toggle works.
8. **Stretch:** design `/my-properties` detail view + upgrade checkboxes. Ship if time.
9. **Fan out to remaining property types** (apartments, garages, bunkers, offices, MC clubhouses, businesses, vehicle warehouses, arcades, auto shops, agencies, salvage yards, facilities, hangars, yachts) — separate sessions, per-type.

---

## Open questions (park for next session)

- **Upgrade selection UI** — expandable row vs dedicated `/my-properties/[id]` page. Lean: dedicated page, feels cleaner for 6-10 upgrade checkboxes per property.
- **Business-specific features (income, supplies)** — not designed yet. Comes later; nothing in this doc blocks it.
- **Per-property images** — parked. Pick a type that would benefit visually and source images in a follow-up session.
- **Map integration** — user might eventually want a map view of owned properties. `neighborhood` gives us the hook; actual map rendering is way later.

---

## Decision log impact (add to plan.md on implementation)

- 2026-04-19: Property data model shifts from 15 type-level rows to ~300-400 per-instance rows. Type-level info collapses into a `subtype` field.
- 2026-04-19: Upgrades attach to property *instances*, not types. Duplicates upgrade rows across same-subtype properties but matches real ownership semantics.
