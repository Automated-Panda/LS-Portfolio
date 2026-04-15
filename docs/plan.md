# LS Garage Manager — Plan & Progress

> Living document. Update as work progresses. This is the single source of truth for "where are we, what's next, what needs testing."

**Current phase:** ✅ Phase 0 — Repo Foundation & Data Seed (complete)
**Last updated:** 2026-04-15

---

## 🗺️ Phase Overview

| Phase | Status | Description |
|---|---|---|
| **0. Foundation & Data Seed** | ✅ Complete | Repo scaffold + vehicle/property JSON datasets |
| **1. Supabase Setup** | 🟡 Scripts ready, awaiting project | Schema migrations + import script written; needs Supabase project + keys to run |
| 2. Auth & User Shell | ⚪ Not started | Supabase auth, profile table, basic dashboard layout |
| 3. Vehicle Browser | ⚪ Not started | All Vehicles page + filtering + ownership toggling |
| 4. Property Management | ⚪ Not started | My Properties page + upgrade selection |
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

**Final Phase 0 stats:**
- 777 storable vehicles across 19 classes (Sport 123, Muscle 96, Off-Road 70, Super 63, ...)
- 60 manufacturers
- 15 property types with tiered upgrades
- 266 variants auto-detected
- Tag distribution: Imani Tech 170, Weaponized 55, Benny's 53, Arena 46, HSW 27, Lowrider 26, Open Wheel 7
- 33 MB of normalized WebP images (768 of 777 vehicles have images)
- 9 vehicles missing images: `faction2`, `feltzer3`, `stockade3`, `stockade4`, `stratum`, `streiter`, `stretch`, `stromberg`, `stryder` (Fandom 403s, can be patched manually later)

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

#### User-run steps (requires Supabase project)
- [ ] **User action:** Create Supabase project in the dashboard
- [ ] **User action:** Copy `.env.local.example` → `.env.local` and fill in real URL + anon key + service role key
- [ ] **User action:** Apply `supabase/migrations/0001_init.sql` (via SQL Editor in Supabase dashboard, or supabase CLI)
- [ ] **User action:** Run `npm run db:import` to seed reference data
- [ ] Verify in Supabase dashboard that `vehicles`, `properties`, `manufacturers`, `vehicle_tags`, `property_upgrades`, `vehicle_tag_links` all populated
- [ ] Verify RLS: query a user table without auth and confirm empty result

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
