# LS Portfolio — Plan & Progress

> **Product vision:** A full GTA V asset-portfolio tracker. Starts with vehicles + properties (Phases 3–6) and grows to cover businesses, aircraft, boats, weapons, clothing, and anything else players own. The "garage" is just the first asset class.

> Living document. Update as work progresses. This is the single source of truth for "where are we, what's next, what needs testing."

**Current phase:** 🟡 Phase 4 — Property Management (browse/select done; owned views + upgrade selection next)
**Last updated:** 2026-04-18 (late night)

---

## 🧭 Where we left off (tomorrow's jumping-off point)

**Phase 4 browse/select is live.** `/properties` mirrors `/vehicles`: 15-card grid, type/location/search filters, one-click ownership toggle. Sidebar was restructured into **Browse** and **My Portfolio** sections with **Dashboard** pinned, sticky on desktop. Owned counts split into `vehicles`, `properties` (residence + garage), and `businesses` (business type). `/my-businesses` exists as a stub.

**What else landed tonight:**
- Brand theming: GTA V forest green (`HSL 142 65% 38%`) on `--accent` + `--secondary`; emerald retained for owned-state so ownership reads distinct from brand chrome.
- Card chrome: class → top-left image overlay; fixed-height tag row (22px) with `+N` overflow chip (tooltip lists the rest). Cards now uniform height without awkward empty bodies.
- 9 vehicle image touch-ups (cruiser, intruder, monster/liberator, stromberg, tulip, vortex, blazer, caracara2, banshee) — `scripts/normalize-temp-images.ts` handles the drop-zone workflow (`docs/temp-images/<name>.{png|jpg|webp}`).
- Vapid Monster renamed to **Liberator** (display_name only; internal_name `monster` unchanged).
- Benny's tag cleanup: **customs-only rule** — base vehicles lose `bennys` if a variant of them also carries it (`scripts/fix-bennys-custom-only.ts`), plus 8 manual corrections (`fix-bennys-corrections.ts`) and Youga Custom manufacturer fix (Vapid → Bravado).
- Tag displays shortened: "Benny's Original Motor Works" → "Benny's", "HSW Upgrade" → "HSW".
- Infra: shifted local Supabase ports 5432X → 5442X to dodge Windows Hyper-V TCP reservations (saved in memory as reference).

**What's next for Phase 4 (Phase 4b — Granular Properties):**

Brainstormed 2026-04-18 late night. Design locked in [`docs/specs/2026-04-18-properties-granular-design.md`](./specs/2026-04-18-properties-granular-design.md). TL;DR: existing 15 category-level properties become ~300-400 per-instance properties (every individual apartment, garage, nightclub, etc.). Schema adds `subtype`, `subtype_display`, `neighborhood`, `capacity` columns. Upgrades attach to instances, not types.

1. **Pilot: Nightclubs** (next session) — 10 locations × 6 upgrade rows each. Validates schema + data + upgrade UI end-to-end before scaling.
2. **Fan-out to all property types** — apartments, garages, bunkers, offices, MC clubhouses, biker businesses, warehouses, etc. Across multiple sessions.
3. **`/my-properties`** + **`/my-businesses`** owned views with upgrade-tier selection (Phase 4c).
4. This unblocks **Phase 5** (vehicle→slot assignment), which is where the tracker becomes genuinely useful.

**Smaller followups:**
- Optional: bake the `custom_only` flag properly into `tags.json` + `scripts/lib/tags.ts` so future `npm run build:vehicles` runs don't need the post-pass script.
- Optional: add a `DISPLAY_NAME_OVERRIDES` map to `build-vehicles.ts` so renames like Monster→Liberator survive a rebuild.

---

## 🗺️ Phase Overview

| Phase | Status | Description |
|---|---|---|
| **0. Foundation & Data Seed** | ✅ Complete | Repo scaffold + vehicle/property JSON datasets |
| **1. Supabase Setup** | ✅ Complete (local) | Local Supabase stack running via Docker; schema + seed imported; hosted project deferred to Phase 9 |
| 2. Auth & User Shell | ✅ Code complete (full smoke test deferred to Phase 9) | Supabase auth, profile table, basic dashboard layout |
| 3. Vehicle Browser | ✅ Feature complete (image-quality polish ongoing) | All Vehicles page + filtering + ownership toggling |
| **4. Property Management** | 🟡 In progress | `/properties` browse + ownership ✅ · `/my-properties` owned view + upgrade selection ⚪ · `/my-businesses` owned view ⚪ |
| 5. Slot Assignment | ⚪ Not started | My Vehicles page + assign to property/upgrade/slot |
| 6. Dashboard | ⚪ Not started | Totals, capacity, unassigned counts |
| 7. Marketing Site | ⚪ Not started | Landing page, about, pricing (if applicable) |
| 8. Visual Garage Editor | ⚪ Not started | Top-down grid view, click-to-assign |
| 9. Polish & Launch | ⚪ Not started | SEO, analytics, hosting, domain |

Design for Phase 0: [`docs/specs/2026-04-15-data-seed-design.md`](./specs/2026-04-15-data-seed-design.md)

---

## 📋 Phase 0 — Foundation & Data Seed

### Checklist

#### Scaffolding
- [x] Write design doc (`docs/specs/2026-04-15-data-seed-design.md`)
- [x] Create `docs/plan.md` (this file)
- [x] Create folder skeleton (`app/`, `components/`, `lib/`, `data/`, `scripts/`, `supabase/migrations/`, `public/`)
- [x] Create `package.json` with intended dependencies
- [x] Create `tsconfig.json`
- [x] Create `.gitignore`
- [x] Create Next.js config files (`next.config.ts`, `tailwind.config.ts`, `postcss.config.mjs`)
- [x] Create root `app/layout.tsx` + `globals.css`
- [x] Create route group placeholder pages (`(marketing)`, `(app)`, `(auth)`)
- [x] Create Supabase client placeholder (`lib/supabase/client.ts`)
- [ ] **User action:** run `npm install` to pull dependencies
- [ ] Verify `npm run dev` starts a working Next.js dev server with placeholder pages rendering

#### Data Pipeline
- [x] Write `scripts/schema.ts` with Zod schemas for all seed files
- [x] Write `scripts/fetch-sources.ts` — pulls DurtyFree + Fandom HTML into `data/raw/`
- [x] Write `scripts/build-vehicles.ts` — reads raw, produces `data/seed/vehicles.json` + images
- [x] Write `scripts/build-properties.ts` — hand-curated seed → `data/seed/properties.json`
- [x] Write `scripts/validate-seed.ts` — Zod + integrity checks
- [x] Author hand-curated `tags.json` with 8 initial tags
- [x] Author hand-curated property seed array (15 property types)

#### Run & Validate (Super class first)
- [x] Run `npm run fetch` — DurtyFree dumps + 63 Super Fandom pages
- [x] Run `npm run build:vehicles` — 63 records with all fields populated
- [x] Run `npm run build:properties` — 15 properties written
- [x] Run `npm run validate` — clean on Super class

#### Test Checklist (manual spot-checks)
- [ ] Pick 5 random vehicles from `vehicles.json`; verify display name, image, tags against their Fandom pages
- [ ] Verify at least one Benny's vehicle is tagged `bennys`
- [ ] Verify at least one HSW vehicle is tagged `hsw`
- [ ] Verify at least one Imani Tech vehicle is tagged `imani_tech`
- [ ] Verify Elegy RH8 and Elegy Retro Custom both exist as separate records with correct `variant_of`
- [ ] Open 3 generated `.webp` files and confirm they are ~600px wide and reasonable file size
- [ ] Confirm no orphan images in `data/images/vehicles/`

#### Widen Scope
- [x] Flip `CLASS_FILTER` to `null` in both scripts + add `STORABLE_TYPES` filter
- [x] Switch ids to internal-name basis to avoid display-name collisions
- [x] Re-run pipeline (fetch → build → validate) — **777 vehicles, 60 manufacturers, 266 variants detected**
- [x] Full dataset validates clean (0 errors, 9 warnings for Fandom 403s)

**Final Phase 0 stats (as of 2026-04-18):**
- **720** visible vehicles across 19 classes — which roll up to **~697 cards** after drift collapse (was 777):
  - –2: `fbi`/`fbi2` dropped as faction-page junk (pointed at the FIB wiki page, not a vehicle)
  - –55: `variant_of` rows pruned via `npm run vehicles:prune-variants` in two passes:
    - Pass A (50): variants whose `display_name` matched their base (bison2/bison3, boxville2–4, burrito3–5, mule2/3/5, tornado2–4, towtruck2–4, caddy2/3, emperor2/3, mesa2/3, police2/3, utillitruck2/3, and others)
    - Pass B (5): variants sharing a `display_name` with *each other* but not the base (dune5 "Ramp Buggy", sentinel3 "Sentinel", speedo5 "Speedo Custom", tractor3 "Fieldmaster", youga5 "Youga Custom")
  - Drift variants (~23) are kept in the DB as distinct `user_owned_vehicles`-eligible rows but collapsed in the UI — they show as a `Drift` sub-toggle on the base card instead of their own card
- 60 manufacturers
- 15 property types with tiered upgrades
- 266 variants auto-detected
- Tag distribution: Imani Tech 170, Weaponized 55, Benny's 53, Arena 46, HSW 27, Lowrider 26, Open Wheel 7
- **All remaining rows (720 visible + ~23 drift siblings in DB) have real (non-placeholder) images.** Image pipeline iterated over three passes on 2026-04-18:
  - Pass 1: 9 original null `image_path` values — all patched.
  - Pass 2: 52 vehicles had been downloading the Fandom "Site-community-image" placeholder because their plain-name Fandom pages were disambiguation pages. Parser now rejects that placeholder (`scripts/lib/fandom.ts`), and `npm run images:fetch-missing` retries those via `_(HD_Universe)` variant URLs.
  - Pass 3: 1 portrait-ratio image (`dukes`) re-sourced. Fetcher now also treats any image with width/height ratio < 1.1 as suspect and re-attempts.
- URL overrides for individual mismatches live in `FANDOM_URL_OVERRIDES` in `scripts/fetch-missing-images.ts`: `faction2` → `/Faction_Custom`, `feltzer3` → `/Stirling_GT`, `blade` → `/Blade_(car)`, `vigilante` → `/Vigilante_(car)`, `dukes` → `/Dukes_(car)`.
- Image-quality followup list for next session lives in [`docs/notes.md`](./notes.md).

---

---

## 📋 Phase 1 — Supabase Setup

### Checklist

#### Written (awaiting user-run)
- [x] Add `counts_as_garage` flag to property schema + seed; rebuild + validate
- [x] `supabase/migrations/0001_init.sql` — reference tables, user tables, RLS, auth trigger
- [x] `scripts/import-seed.ts` — idempotent upsert of all seed data via service role
- [x] `.env.local.example` — template for Supabase env vars
- [x] `lib/supabase/{client,server,middleware}.ts` — real browser + server clients via `@supabase/ssr`
- [x] `middleware.ts` at repo root — refreshes session on every request
- [x] `npm run db:import` script wired up (uses `tsx --env-file=.env.local`)
- [x] `npm run typecheck` — clean

#### Local run (via Docker + `npx supabase start`)
- [x] Installed Docker Desktop (James, 2026-04-15)
- [x] `npx supabase start` — pulled images, stack running on 127.0.0.1:54321/54322/54323
- [x] Migration `0001_init.sql` auto-applied on first start (all 10 tables created)
- [x] `.env.local` created with local URL + legacy anon/service-role JWTs (sourced from `supabase status -o env`)
- [x] Fixed bugs in `scripts/import-seed.ts`:
  - Second-pass variant_of + required_upgrade_id changed from `upsert` → `update` (upsert was nulling NOT NULL columns)
  - `upsert` helper now takes an `onConflict` arg so `vehicle_tag_links` can use its composite PK
- [x] `npm run db:import` — clean, imported: 60 manufacturers, 8 tags, 777 vehicles, 266 variant links, 384 vehicle_tag_links, 15 properties, 21 property_upgrades, 4 upgrade requirements
- [x] Verified row counts match seed JSON
- [x] Verified RLS: query `user_owned_vehicles` as `authenticated` role with no JWT returns 0 rows

#### Hosted Supabase project (deferred to Phase 9 / launch)
- [ ] Create hosted Supabase project
- [ ] `supabase link` + `supabase db push` to apply migration
- [ ] Re-run `npm run db:import` against hosted URL/keys

---

## 📋 Phase 2 — Auth & User Shell

**Scope chosen:** signup, login, logout, password reset, profile page, dashboard shell with sidebar. Email confirmation **off** for now. No tests this phase (solo hobby project).

### Checklist

#### Dependencies & theming
- [x] Install shadcn/ui deps (`class-variance-authority`, `clsx`, `tailwind-merge`, `tailwindcss-animate`, `lucide-react`, `sonner`, Radix primitives)
- [x] `components.json` + `lib/utils.ts` (`cn()` helper)
- [x] Update `tailwind.config.ts` with shadcn tokens + `tailwindcss-animate` plugin
- [x] Update `app/globals.css` with zinc theme CSS variables (light + dark)
- [x] Add shadcn primitives: `button`, `input`, `label`, `card`, `separator`, `avatar`, `dropdown-menu`, `sonner`, `alert`
- [x] Root layout: enable `className="dark"`, mount `<Toaster />`

#### Auth flow
- [x] Middleware route protection: unauthenticated → `/login?next=...`; authenticated on `/login|/signup|/forgot-password` → `/dashboard`
- [x] `/login` — email + password form, `useActionState` errors, honors `?next=` param
- [x] `/signup` — email + password + username, Zod validation, pre-check username uniqueness, post-signup `profiles.update({ username })`
- [x] `/forgot-password` — `resetPasswordForEmail` with `redirectTo=/auth/callback?next=/reset-password`, "check your email" state
- [x] `/reset-password` — `auth.updateUser({ password })` form
- [x] `/auth/callback` — PKCE code exchange via `exchangeCodeForSession`
- [x] `logOutAction` in `lib/auth/actions.ts` → `signOut()` → redirect `/`

#### App shell
- [x] `(app)/layout.tsx` — fetches user + profile, renders `<AppShell>`
- [x] `components/app-shell/app-shell.tsx` — responsive sidebar + mobile drawer + top bar
- [x] `components/app-shell/sidebar-nav.tsx` — active-state highlighting, 5 nav items
- [x] `components/app-shell/user-menu.tsx` — avatar + dropdown (Profile, Sign out)
- [x] Placeholder pages for future phases: `/vehicles`, `/my-vehicles`, `/my-properties`, `/garage`

#### Profile
- [x] `/profile` — view email (read-only), edit username + display_name, toast on save
- [x] `updateProfileAction` — Zod validation, unique-constraint handling, `revalidatePath("/", "layout")`

#### Marketing home
- [x] `/` — minimal CTAs to `/signup` and `/login` (full build in Phase 7)

### Smoke test status
- Basic flows (marketing home, page navigation) confirmed working on `localhost:3000` on 2026-04-18.
- **Full smoke test (signup, profile edit, forgot-password → Mailpit → reset) deferred until hosted Supabase upgrade (Phase 9).** Code is in place; will verify on the hosted environment with real email delivery.

---

## 📋 Phase 3 — Vehicle Browser  ✅ Feature complete

**Scope chosen:** card grid of all ~697 unique base vehicles, filterable by class / manufacturer / tags / search, one-click ownership toggle, separate Drift sub-toggle. Sidebar shows owned counts on *My Vehicles* and *My Properties*.

### Checklist

#### Data layer & server
- [x] `scripts/publish-images.mjs` + `npm run images:publish` — syncs `data/images/vehicles/` → `public/vehicles/`. `/public/vehicles/` is gitignored.
- [x] `scripts/fetch-missing-images.ts` + `npm run images:fetch-missing` — re-sources images for any vehicle with `image_path=null`, a placeholder-hash image, or a portrait-ratio image. `FANDOM_URL_OVERRIDES` handles edge-case page names. Tries `_(HD_Universe)` variant first to escape disambig pages.
- [x] `scripts/prune-redundant-variants.ts` + `npm run vehicles:prune-variants` — drops `variant_of` rows visually indistinguishable from siblings. Two passes: (A) variants matching their base's `display_name`, (B) variants sharing a `display_name` with each other.
- [x] `scripts/fix-manufacturer-display.ts` + `npm run mfr:fix-acronyms` — patches manufacturer acronyms (BF, HVY, LCC, MTL) in seed + DB.
- [x] `lib/queries/vehicles.ts` — `getVehiclesBrowserData(userId)` fetches vehicles + joins + owned set in parallel, folds drift variants into their base under `drift_variant: { id, owned }`, filters drift rows out of the returned list. `getOwnedCounts(userId)` for sidebar.
- [x] `lib/vehicles.ts` — client-safe types + `vehicleImageUrl()` + `formatClass()` (normalizes `SPORT_CLASSIC` → `Sport Classic`, `MUSCLE` → `Muscle`).
- [x] `app/(app)/vehicles/actions.ts` — `toggleVehicleOwnership(vehicleId)` server action; works for base AND drift IDs. Revalidates the app layout so sidebar counts refresh.

#### UI primitives
- [x] Install `@radix-ui/react-popover`, `@radix-ui/react-select`, `cmdk`
- [x] Add shadcn primitives: `popover`, `command`, `select`, `badge`

#### Components
- [x] `VehicleCard` (memoized) — image + display name + manufacturer + class + tag badges; whole card toggles base ownership; optional `Drift` pill in the badge row toggles drift ownership independently. Emerald ring + check icon when base is owned; green `Drift` pill when drift is owned. Optimistic `useTransition` flip with toast on error.
- [x] `FilterBar` — Search input (debounced 200 ms), Class `Select`, Manufacturer searchable `Popover` + `Command` combobox, Tag chip toggles, Clear button. All state in URL params (`?q=&class=&mfr=&tags=`).
- [x] `VehiclesBrowser` — reads URL params, memoizes filtered list, renders header + `FilterBar` + responsive grid (2/3/4/5/6 cols).
- [x] `app/(app)/vehicles/page.tsx` — server component fetches data, passes to `VehiclesBrowser`.

#### Sidebar
- [x] `NavItem.badgeKey: 'vehicles' | 'properties'` — optional key; sidebar looks up `counts[key]`, renders a pill on that row.
- [x] `(app)/layout.tsx` fetches `getOwnedCounts` alongside profile, passes to `AppShell`.

### Data cleanups completed
- 777 → 720 visible (+ ~23 drift siblings hidden behind their base's Drift toggle)
- 0 display-name collisions remaining (verified)
- All image paths point at real vehicle shots (spot-checked by hash dedup + aspect-ratio sweep)
- Manufacturer acronyms rendered correctly (BF, HVY, LCC, MTL)

### Known followups (not blocking)
- [x] **Image-quality polish** — 9 vehicles re-sourced on 2026-04-18 via the `docs/temp-images/` drop-zone + `scripts/normalize-temp-images.ts`. Further requests go through the same workflow.

### Smoke test status
Basic flows confirmed working interactively on `localhost:3000` on 2026-04-18 (browse, filter, search, toggle ownership, toggle drift, sidebar count updates). No automated tests this phase.

---

## 📋 Phase 4 — Property Management  🟡 In progress

**Scope chosen:** mirror the `/vehicles` pattern for properties (browse + ownership toggle), then add owned views (`/my-properties`, `/my-businesses`) with per-property upgrade-tier selection. Businesses split out from general properties in the sidebar since they're a distinct asset class with business-specific mechanics (income, supplies) to come.

### Completed this phase (2026-04-18)

#### Sidebar restructure
- [x] `nav-items.ts` — sections model: pinned `Dashboard`, then `Browse` (All Vehicles, All Properties, Visual Garage) and `My Portfolio` (My Vehicles, My Properties, My Businesses).
- [x] `sidebar-nav.tsx` — renders section headers (small uppercase muted labels).
- [x] `app-shell.tsx` — desktop aside is `sticky top-0 h-screen` with internal scroll.
- [x] `getOwnedCounts` splits `properties` (residence + garage) vs `businesses` (business type) via inner join to `properties.property_type`.

#### `/properties` browse page (mirrors `/vehicles`)
- [x] `lib/properties.ts` — client-safe types + `propertyImageUrl()` + `formatPropertyType()`.
- [x] `lib/queries/properties.ts` — `getPropertiesBrowserData(userId)` fetches properties + upgrades + owned set.
- [x] `app/(app)/properties/page.tsx` — server component, auth + data fetch.
- [x] `properties-browser.tsx` — URL-driven filters, responsive grid.
- [x] `filter-bar.tsx` — type pills (All / Residences / Garages / Businesses / Special), location dropdown, debounced search.
- [x] `property-card.tsx` — image, name, type overlay, location (MapPin), capacity chip, own/unown toggle with optimistic updates.
- [x] `actions.ts` — `togglePropertyOwnership(propertyId)` server action.

#### Theming & card chrome (2026-04-18 late night)
- [x] GTA V forest green (`HSL 142 65% 38%`) on `--accent` + `--secondary`, light + dark. Emerald-500 retained for owned-state.
- [x] Class badge → top-left image overlay (`bg-black/70 backdrop-blur`). Property type badge same treatment.
- [x] Tag row fixed to 22px height with `+N` overflow chip (tooltip lists hidden tags). Tag chips use `shrink-0` to prevent compression.
- [x] Shortened tag display labels: "Benny's Original Motor Works" → "Benny's", "HSW Upgrade" → "HSW".

#### Data cleanups (2026-04-18)
- [x] `scripts/normalize-temp-images.ts` — drop-zone workflow: files into `docs/temp-images/<name>.<ext>`, `npx tsx scripts/normalize-temp-images.ts` converts to 600w webp and moves to `data/images/vehicles/<id>.webp`. `NAME_OVERRIDES` handles display↔id mismatches (e.g. `liberator` → `monster`, `caracara4x4` → `caracara2`).
- [x] 9 vehicles re-sourced via this workflow.
- [x] Vapid Monster renamed to **Liberator** in seed + DB. Internal id stays `monster`.
- [x] `scripts/fix-bennys-custom-only.ts` — applies **customs-only rule**: for each base tagged `bennys`, if a variant also has `bennys`, strip the tag from the base. 14 bases cleaned.
- [x] `scripts/fix-bennys-corrections.ts` — 8 manual corrections from James's review (6 removes, 2 adds) + Youga Custom manufacturer fix (Vapid → Bravado).

### Still to do

- [ ] **`/my-properties`** — real owned view (currently a stub). Show owned residences + garages, allow picking upgrade tiers per property (e.g., Stand-Alone Garage → 2/6/10-car).
- [ ] **`/my-businesses`** — real owned view. Show owned businesses, allow picking upgrade tiers.
- [ ] (Optional) Bake `custom_only` flag into `tags.json` + `scripts/lib/tags.ts` so the post-pass script isn't needed after future rebuilds.
- [ ] (Optional) Add `DISPLAY_NAME_OVERRIDES` to `build-vehicles.ts` so Liberator rename survives a full rebuild.

### Infrastructure notes (2026-04-18)

- Local Supabase ports shifted 5432X → 5442X to avoid Windows Hyper-V reserved port range 54274-54373. New ports: API 54421, DB 54422, Studio 54423, Mailpit 54424, Analytics 54427, Pooler 54429, Shadow DB 54420. See memory `reference_supabase_ports.md` for full context.

---

## 📝 Decisions Log

Short-form record of decisions made during brainstorming. See the design doc for full reasoning.

| Date | Decision | Rationale summary |
|---|---|---|
| 2026-04-15 | JSON seed files are source of truth; DB is a cache | Safe re-imports on DLC updates; seed is git-diffable |
| 2026-04-15 | Start with "Super" class only, then widen via filter flip | Validates pipeline end-to-end cheaply before scaling |
| 2026-04-15 | Images downloaded locally as normalized WebP | Self-contained; trivially migratable to Supabase Storage later |
| 2026-04-15 | Curated tag list with Fandom category derivation rules | High signal, low noise, easy to extend |
| 2026-04-15 | Single Next.js app with route groups, not split into `website/` + `dashboard/` | Zero duplication of config, components, clients; same perf per-route |
| 2026-04-15 | Tiered upgrades model `property_upgrades` with per-upgrade capacity | Matches actual GTA mechanics (nightclub levels are separate purchases) |
| 2026-04-15 | Vehicle assignment stores only `assigned_slot_id` | Slot → upgrade → property chain avoids denormalized drift |
| 2026-04-17 | Email confirmation off (for now) | Solo hobby project; one-user flow, easier to iterate. Re-evaluate at Phase 9 before public launch. |
| 2026-04-17 | Username collected at signup, not deferred | Avoids a "profile-incomplete" state and onboarding gate; one form, one step. |
| 2026-04-17 | shadcn/ui with zinc theme, dark mode default | Clean modern aesthetic, tree-shakes well, no runtime lib dep. |
| 2026-04-17 | Server actions + `useActionState`, no `react-hook-form` | Keep the form stack minimal; Zod validates on the server. |
| 2026-04-17 | Skip formal design docs for this project | Solo build — Q&A alignment is sufficient, written specs add friction. |
| 2026-04-18 | Product rebrand: LS Portfolio (was LS Garage Manager) | Broader vision — a full GTA V asset tracker (vehicles, properties, businesses, aircraft, boats…), not just garages. |
| 2026-04-18 | Monetization: freemium + one-time ~$7.99 Pro unlock | Free tier must remain genuinely useful, not a demo. Low-priority; revisit at Phase 9 with Stripe + `pro_tier` boolean. |
| 2026-04-18 | Phase 3: client-side filtering over 777 vehicles | 777 items is small enough to load once and filter in JS; avoids SQL filter plumbing and lets URL state drive instant updates. |
| 2026-04-18 | Vehicle images live in `public/vehicles/`, not `data/images/` | Next only serves static from `public/`. `data/images/` stays the pipeline output; `npm run images:publish` syncs. `public/vehicles/` is gitignored. |
| 2026-04-18 | Ownership is a binary toggle in Phase 3 | Multiple-instance ownership (several copies of the same vehicle) deferred to Phase 5 where slot assignment actually needs it. |
| 2026-04-18 | Drift variants collapse into the base card with a sub-toggle | 23 drift-prefixed vehicles visually duplicate their base. One card per base + a separate Drift pill is less noise and reads cleanly. DB still stores base + drift as separate `user_owned_vehicles`-eligible rows. |
| 2026-04-18 | Mission-only / faction-named entries removed from seed | `fbi` + `fbi2` were labeled "Federal Investigation Bureau" and pointed at the FIB wiki faction page — not ownable vehicles. If more slip through later, drop into `BOGUS_IDS` in `scripts/fetch-missing-images.ts` and re-run. |
| 2026-04-18 | Class names normalized in display layer only | `formatClass()` runs once in `getVehiclesBrowserData`; the raw DurtyFree value (`MUSCLE`, `SPORT_CLASSIC`) stays in the DB for deterministic re-imports. |
| 2026-04-18 | Sidebar: Dashboard pinned + Browse / My Portfolio sections, sticky on desktop | Product now spans multiple asset types (vehicles, properties, businesses, aircraft, boats to come); a flat nav list doesn't scale, and splitting public catalogue from owned portfolio maps to how users actually think. |
| 2026-04-18 | Businesses separate from Properties in nav (but same DB table) | Businesses share structure with properties (one `properties` table) but have distinct mechanics (income, supplies). Splitting them in nav lets the owned view diverge later without another data migration. Browse page keeps them together with a Type filter. |
| 2026-04-18 | Brand chrome uses GTA V forest green (HSL 142 65% 38%); owned-state stays emerald-500 | Two greens sit ~18° apart in hue with different saturation, so they read as distinct signals. Brand = "this is an LS Portfolio thing"; emerald = "you own this". |
| 2026-04-18 | Benny's tag rule: customs-only | Filter should surface the vehicles that *are* Benny's upgrades, not every vehicle that *can be taken to* Benny's. Base vehicles that are in Fandom's Benny's category get the tag stripped if any variant of them also has it. Standalone customs (no variants) keep theirs. |
| 2026-04-18 | Class as image overlay + fixed-height tag row with `+N` overflow | Keeps all cards uniform height without wrap-jitter or empty bodies. Class is always visible without competing for space with tags. |
| 2026-04-18 | Local Supabase ports 5432X → 5442X | Windows Hyper-V dynamic port reservations include 54274-54373 on James's machine, which blocks the default Supabase range. Shifted into the 54374-54480 gap. |

---

## 🔮 Deferred / Future Considerations

Things we deliberately are NOT building yet:

- Auto-organize engine
- Drag-and-drop garage UI
- 3D garage models
- Mobile native app
- Social features
- Screenshot import
- Per-slot x/y positions (until visual editor phase)
- Custom user tags

---

## 🚧 Open Questions

- **Property images:** do we want a cover image per property, per upgrade, or both? Currently designed as one cover per property — revisit if the upgrade detail UI needs it.
- **Hosting:** Vercel vs self-hosted vs Cloudflare Pages? Decide before Phase 9.
- **Domain:** not registered yet.
- **Public vs gated marketing site:** does the landing page need a waitlist / beta signup, or go straight to live signups? Decide in Phase 7.
