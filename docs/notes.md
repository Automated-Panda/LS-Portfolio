# LS Portfolio — Notes & Followups

Running working checklist of what's next. Tick items off as we go. Roughly ordered by priority but feel free to jump around.

---

## 🔥 Today's batch — 2026-05-28

Full-day session. Order: max-out → Vehicle Warehouse model → /my-businesses → Cargo Warehouses → vehicle image audit. Business upgrade audit captured separately as its own future session.

### ⚡ #1 Max-out button + faster upgrade toggles ✅
- [x] **Optimistic UI** for upgrade checkboxes in `PropertyDrawer` — toggles flip instantly via local optimistic state; rollback on server error.
- [x] **"Install all" / "Uninstall all" buttons** wired to new `setAllUpgradesInstalled` action (single round-trip insert/delete).
- [x] Both buttons cover storage AND non-storage upgrade sections (single bulk action across all upgrades).

### 🔧 #2 Fix Vehicle Warehouse model ✅
- [x] Moved 40-car storage from upgrade → `base_capacity` on all 9 Vehicle Warehouses.
- [x] Dropped the `vehicle-warehouse-*-storage` upgrade rows (9 orphans cleaned).
- [x] Extended `import-seed.ts` with orphan-property_upgrades cleanup so future seed restructures stay tidy.
- [ ] **Future:** add cosmetic Interior Style upgrades (Basic / Urban / Branded) — deferred to business upgrade audit session.

### 🏢 #3 Build the `/my-businesses` page ✅
- [x] `getOwnedPropertiesWithStorage` now takes a `scope: 'all' | 'properties' | 'businesses'` arg matching the browse split.
- [x] `/my-properties` passes `scope='properties'` — businesses no longer leak in.
- [x] `/my-businesses` is real: grid + drawer + empty state, reusing `PropertyDrawer` with all today's upgrade UX (optimistic toggles, install-all).
- [x] OwnedPropertyDetail now carries `property_type`.

### 📦 #4 Add Special Cargo Warehouses ✅
- [x] New seed file `scripts/data/cargo-warehouses-seed.ts` — 22 warehouses (canonical count) split 6/8/8 across Small/Medium/Large subtypes.
- [x] All 3 subtypes pool into one `cargo-warehouse` ownership group via `CARGO_WAREHOUSE_POOL` in import-seed.
- [x] Migration `0011_cargo_warehouse_ownership_group.sql` applied via MCP (cap=5).
- [x] Per-instance gtabase cover images for all 22.
- [x] Interior Style upgrade added per instance via business audit.
- [ ] **Future:** address audit on the 17 verify:true rows.

### 🖼️ #5 Vehicle image audit ✅
- [x] 8 no-image vehicles sourced from gtabase: Cargobob, Dinghy, Dodo, Maverick, Police Maverick, Sea Sparrow, Sparrow, Squalo.
- [x] 2 wrong-image vehicles replaced: Pegassi Speeder, Tug.
- [x] Dropped bogus `fbi` row (Fandom faction-page artifact, not an ownable vehicle).
- [x] Fixed manufacturer display: `Lcc` → `LCC` (and `Mtl` → `MTL`).
- [x] Validate: 0 errors, 0 warnings.

---

## 📋 Business upgrade audit ✅ — landed 2026-05-28

Cross-source audit (gtabase + Fandom) via 6 parallel agents. Functional/capacity-bearing upgrades added across 12 property types. Cosmetic-only items (lighting, hull colours, flags, etc.) intentionally deferred.

- [x] **Nightclub** — added Staff Upgrade
- [x] **CEO Office** — added Gun Locker, Safe, Accommodation
- [x] **Agency** — added Armory, Personal Quarters, Vehicle Workshop
- [x] **MC Clubhouse** — added Gun Locker, Custom Bike Shop; clarified base garage notes (10 personal + 7 member bikes)
- [x] **Bunker** — added Equipment, Staff, Security, Personal Quarters; **removed misclassified `vehicle-workshop`** (MOC is a separate vehicle, not a bunker upgrade)
- [x] **Facility** — added Orbital Cannon, Security Room, Lounge, Sleeping Quarters; clarified garage notes
- [x] **Arcade** — added Master Control Terminal, Drone Station, Personal Quarters, High Score Screens
- [x] **Auto Shop** — added Additional Car Lift, Staff 1, Staff 2 (requires Staff 1), Personal Quarters
- [x] **Salvage Yard** — added Wall Safe, Staff, Trade Rates; clarified tow-truck options
- [x] **Hangar** — added Aircraft Workshop
- [x] **Yacht** — fixed Orion/Pisces tier swap; removed `helipad` (built-in, not an upgrade)
- [x] **Cargo Warehouse** — added Interior Style upgrade per instance
- [x] **Biker Businesses** — notes refinements (no structural changes)

**Hosted DB:** 459 property_upgrades (up from 258), 33 dependency chains. 12 orphan rows auto-cleaned by import-seed.

**Deferred follow-ups** (cosmetic, not blocking):
- [ ] Interior Style options on Vehicle Warehouses (Basic/Urban/Branded)
- [ ] Hangar cosmetics (lighting, floor graphics, office furniture, living quarters)
- [ ] Yacht cosmetics (fittings, lighting, hull colour, flag, name)
- [ ] Arcade machines (14 individual machines — model as one combined entry or skip)
- [ ] Salvage Yard "Beater" tow truck variant (currently bundled into one entry)

---

## 🚨 New TODOs — added 2026-05-27

Soon-ish work batch. Group these together when picking next pieces.

### 🔐 Auth — username signin ✅
- [x] Allow login by `username` in addition to `email`. Today `/login` only accepts email.
- [x] Update `signInAction` to detect input shape (contains `@` = email, else username) and look up the email from `profiles.username` before calling `signInWithPassword`. (Uses service-role admin client since `auth.users` isn't publicly readable.)
- [x] Update label / placeholder on `/login` to read "Email or username".
- ⚠️ **Vercel deploy:** confirm `SUPABASE_SERVICE_ROLE_KEY` is set in Vercel env vars or username signin will fail in prod.

### 📩 Invite flow is broken
- [ ] **Bug repro:** invite email lands on signup/signin instead of an invite-acceptance page. Signup says "account with that email exists"; sign-in won't work because the invited user has no password yet.
- [ ] Investigate: is this Supabase's built-in `inviteUserByEmail` flow, or a custom invite path? (likely the Auth one — `supabase/templates/invite.html` already exists)
- [ ] The invite email link should redirect to a "set your password" page (uses the invite token, sets password, signs the user in). Currently it appears to drop them on `/signup`.
- [ ] Likely fix: the invite email's `{{ .ConfirmationURL }}` should point at `/auth/callback?next=/reset-password` (or a new `/auth/accept-invite` route) — verify and patch the template + the callback handler.

### 🧙 Onboarding wizard — needs UX rework
- [ ] **Soft-steer users to garage-bearing properties first** — highlight residential / garage options, dim or warn on non-garage picks (don't hard-block, but make it obvious which path leads to "can store cars")
- [ ] **Replace the click-the-row hub interaction with explicit buttons.** Today after picking properties, clicking a row in the hub list to open upgrades/cars is non-obvious. Add visible CTAs per row like "Pick upgrades" + "Add cars" buttons.
- [ ] Smoother flow from property → upgrades → cars (the current state-machine works but feels clunky)

### 🅿️ Storage picker — hide non-garage properties ✅
- [x] When assigning a vehicle to storage (`InstanceDrawer` → "Stored at"), filter the property dropdown to only owned properties where `counts_as_garage = true`. No more hangars / yachts / businesses-without-garages in the car-storage dropdown.
- [ ] **Future:** also filter by asset class so hangars only show when storing aircraft, yachts only for boats, etc. Separate, bigger question — deferred.

### 🏠 PropertyDrawer — show + remove assigned cars ✅
- [x] Under each storage upgrade (and base storage), the assigned vehicles render in a list with their nickname (and base display name if different) plus a ✕ button per row.
- [x] ✕ click un-assigns via existing `assignVehicleStorage(..., null, null)`. Vehicle stays owned, just becomes unassigned.
- [x] Threaded `instances: OwnedVehicleInstance[]` prop through MyPropertiesGrid + PropertyHubList + OnboardingWizard from the page-level fetches.

### ➕ Vehicle browse — add a "-" alongside "+" ✅
- [x] Owned-count chip on `/vehicles` cards is now a popover trigger. Popover shows the user's instances of that vehicle (nickname or "#N" with storage location) — each row has a `-` button to remove that specific instance. Popover also has an `Add` button for adding another.
- [x] Lazy-loaded via new `getOwnedInstancesForVehicle(vehicleId)` action so the 800-vehicle browse doesn't pre-fetch.
- [x] Optimistic count updates + rollback on error.

### 🏷️ InstanceDrawer rename + collapse-to-buttons ✅
- [x] Rename **Nickname** → **Custom Name**
- [x] Rename **Custom Tags** → **Highlight features**
- [x] Empty fields render as `+ Custom Name` / `+ Highlights` / `+ Notes` pill buttons in a row under the storage section.
- [x] Click a pill → expands the input inline with auto-focus.
- [x] Fields with existing values auto-expand on drawer open.
- [x] Each expanded field has an X to clear-and-collapse.
- [x] Storage location stays always-visible (functional core).

### 🧹 Bulk removal — clear-category + nuclear reset ✅
- [x] **Remove-all-by-category** buttons in a new "Danger zone" card on `/profile`:
  - Vehicles: Remove all cars + bikes / Remove all aircraft / Remove all boats
  - Properties: Remove all residences / mansions / garages / businesses
- [x] Each button has a confirm dialog before firing.
- [x] Server actions: `removeAllVehiclesByCategory(category)` and `removeAllPropertiesByGroup(group)` in `app/(app)/profile/danger-zone-actions.ts`.
- [x] **Nuclear reset** button — two-click arming (click once arms with toast warning, click again within 5s to commit). Wipes owned vehicles + properties + organizer plans (profile + auth user untouched).

---

## ✅ Vehicle Warehouses — all 9 landed 2026-05-27

- [x] **LSIA Vehicle Warehouse** — first miss James flagged
- [x] **LSIA Vehicle Warehouse 2** — second LSIA location
- [x] **El Burro Heights Vehicle Warehouse**
- [x] **Elysian Island Vehicle Warehouse**
- [x] All 4 added with per-instance gtabase cover images
- [x] Rebuild + db:import → 199 properties / 267 upgrades on hosted

> Seed now matches gtabase canonical count (9 total: Murrieta Heights, La Mesa, La Puerta, Davis, Cypress Flats, LSIA, LSIA 2, El Burro Heights, Elysian Island).

---

## 🧪 AI Organizer — acceptance walkthrough (Piece 2)

> Code is merged but the end-to-end manual test never happened. Worth running through before building on top of it so we know what (if anything) needs polish.

- [ ] `/organize` page loads, sidebar entry highlighted, example pills render
- [ ] Type a simple intent ("put all my sports cars in Eclipse Towers") → spinner → plan renders
- [ ] **Apply now** path: plan applies, undo banner appears with live countdown, sidebar counts update
- [ ] **Undo** within the 1hr window restores the previous state
- [ ] **Checklist-only** path: per-step checkboxes work, progress bar tracks
- [ ] Ambiguous prompt triggers clarification pills + multi-turn refinement
- [ ] Insufficient-capacity / impossible request gets a friendly failure message
- [ ] Recent Plans list shows history + re-run works
- [ ] Plan re-runs against the **current** portfolio (not stale snapshot)

---

## 📊 Phase 6 — Dashboard ✅

> Shipped to main 2026-05-26. C1 story-stacked layout: totals → quick actions → needs-attention → breakdown → capacity + catalog → recent activity. Empty-state onboarding for brand-new accounts. Spec: `docs/specs/2026-05-26-dashboard-design.md` · Plan: `docs/plans/2026-05-26-dashboard.md`.

- [x] Brainstorm scope (locked in: stats-led with secondary CTAs, equal weight for new vs returning users, all 4 widget groups)
- [x] Lock layout (C1 — story-stacked with quick actions near top)
- [x] Approach C data fetching — page-level Promise.all + derive in page + presentational widgets
- [x] 7 widget components in `components/dashboard/`
- [x] Replace stub `/dashboard` page (parallel fetch + derive + branch)
- [x] Empty-state UX (`empty-dashboard.tsx` with wizard CTA + 3 secondary cards + disabled-with-tooltip organizer)
- [x] Mobile responsive (3-col → 1-col stack)
- [x] Piggyback: URL-driven `?unassigned=1` on `/my-vehicles` so NeedsAttention can deep-link

---

## 🏰 Add the three mansions ✅

> "A Safehouse in the Hills" update mansions — landed 2026-05-27.

- [x] Confirm the 3 mansions — Tongva Estate / The Vinewood Residence / Richman Villa
- [x] Subtype `mansion` + own `mansion` ownership group, cap 3 (can own all)
- [x] `scripts/data/mansions-seed.ts` + properties-seed index update
- [x] Migration `0010_mansion_ownership_group.sql` (still needs paste into hosted Studio)
- [x] Per-instance cover images from gtabase + normalize-temp-images workflow
- [x] `npm run db:import` ran — 195 properties / 261 upgrades on hosted
- [x] **You verify:** apply migration 0010 in Studio + visit `/properties?subtype=mansion` + `/wizard` picker shows them under "Mansion" group

---

## 🏰 Mansion polish — Piece 1.6 follow-ups

> Mansion data is in but the rich per-mansion UX needs more work. Both items need schema + UI changes.

### Slot typing within the 20

Each mansion holds 20 cars total. Inside that 20, the user can designate:
- **Driveway** — 1 or 2 of the slots, free choice
- **Podium** — 1 slot, only available if the Car Podium upgrade is installed
- **Garage** — everything else (17 or 18 depending on driveway count)

- [ ] Migration: add `mansion_slot_type text` (nullable, check constraint `in ('driveway', 'podium')`) to `user_owned_vehicles`, or a small lookup table for property-specific slot kinds
- [ ] Capacity validation: enforce driveway ≤ 2 and podium ≤ 1 per `stored_in_property_id` when assigning a slot type
- [ ] Capacity validation: podium can only be set if `user_owned_property_upgrades` has the corresponding `mansion-*-podium` row
- [ ] UI: when storing a vehicle in a mansion via `InstanceDrawer`, show a slot-kind picker (Garage / Driveway / Podium) with availability based on the rules above
- [ ] `PropertyDrawer` / `/my-properties` mansion detail: show breakdown like `Garage 8/17 · Driveway 1/2 · Podium 1/1`

### AI Assistant choice (Angel / Haviland / OG)

Per-mansion config — user picks which of the 3 in-game AI assistants they have. Cosmetic but tracked.

- [ ] Migration: add `mansion_ai_assistant text` (nullable, check constraint `in ('angel', 'haviland', 'og')`) to `user_owned_properties`
- [ ] UI: dropdown / radio in `PropertyDrawer` when the property's subtype is `mansion`
- [ ] Server action: `setMansionAiAssistant(ownedPropertyId, assistant)`
- [ ] Render the chosen assistant on the mansion detail card

---

## 🖼️ Missing / incorrect images

- [x] **Casino Penthouse** — sourced from gtabase, dropped into `data/images/properties/casino-penthouse.webp` (2026-05-27). All 196 properties now have cover images (0 no-image, 165 unique, 31 subtype fallback).
- [ ] **Vehicle image audit** — list the vehicles with missing / wrong images
  - [ ] Walk through `/vehicles` and note the offenders
  - [ ] Drop replacements into `docs/temp-images/<name>.<ext>`
  - [ ] Run `npx tsx scripts/normalize-temp-images.ts` to convert + move
  - [ ] `npm run images:publish` → redeploy
- [ ] (Optional) 6 stand-alone-garage Unit-X variants + Warehouse arcade — currently using subtype fallback, would be nicer with unique covers

---

## 🌐 Phase 7 — Marketing site (soon)

> Currently only the hero is updated. Needs the rest before public launch.

- [ ] Brainstorm sections (hero, features, screenshots, pricing teaser, FAQ, footer)
- [ ] Decide: waitlist gate or open signups?
- [ ] Build feature/section components
- [ ] Screenshots of the app (vehicles, properties, organizer, dashboard once built)
- [ ] FAQ + about
- [ ] Footer with legal links (privacy, terms — even placeholder)
- [ ] SEO meta tags + Open Graph image
- [ ] Mobile pass

---

## 📤 Custom vehicle image uploads (unlocks visual editor)

> Blocker for the Visual Garage Editor. Was deferred in Piece 1.5.

- [ ] Spin up Supabase Storage bucket (RLS-scoped per user)
- [ ] Upload UI on the vehicle instance drawer
- [ ] Server-side image processing (resize to 600w, webp, strip metadata)
- [ ] Store `custom_image_path` on `user_owned_vehicles`
- [ ] `vehicleImageUrl()` falls back: custom → canonical → placeholder
- [ ] Cleanup on instance delete

---

## 🏗️ Phase 8 — Visual Garage Editor (after image uploads)

> The wow feature. Top-down grid, click-to-assign.

- [ ] Brainstorm: per-property layout? Generic grid? Tied to upgrade tiers?
- [ ] Design data model for slot positions (x/y on a grid per upgrade)
- [ ] Build the editor canvas + drag interactions
- [ ] Wire assign/unassign actions
- [ ] Visual indicator for empty vs filled slots

---

## 🌟 Bigger future features (longer-term)

- **Drag vehicles into My Properties** — drag from the vehicle list, when dragging the `/my-properties` page opens automatically, then drop onto the destination property to assign it. Cross-page drag interaction; needs careful HTML5-drag-and-drop handling or a lib.
- **Voice-to-text on the AI Organizer** — mic button on `/organize` chat input that uses Web Speech API to dictate the prompt. Probably gated to browsers that support it.
- **Demo video** — record a polished walkthrough specifically showcasing the AI Organizer (chat → plan → apply → undo flow). Lives on the marketing site landing page.

---

## 🔮 Deferred (revisit later)

- Phase 9 — Stripe, Pro tier paywall (`<RequiresPro>`), domain, analytics, full launch polish
- Piece 2.1+ — distribution-mode planner, auto-target-picking, plan history pagination, stale `pending` cleanup
- `custom_only` flag baked into `tags.json` (avoid post-pass script)
- `DISPLAY_NAME_OVERRIDES` map in `build-vehicles.ts` (survive rebuilds)
