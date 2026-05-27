# LS Portfolio — Notes & Followups

Running working checklist of what's next. Tick items off as we go. Roughly ordered by priority but feel free to jump around.

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

### 🏠 PropertyDrawer — show + remove assigned cars
- [ ] In `PropertyDrawer` (used by wizard hub + `/my-properties`), under each storage upgrade, list the currently-assigned vehicles with a remove (✕) button per row.
- [ ] Removing here calls `assignVehicleStorage(vehicleInstanceId, null, null)` (un-assigns but keeps the vehicle owned).

### ➕ Vehicle browse — add a "-" alongside "+"
- [ ] On `/vehicles` cards, today clicking the card / + button adds one more instance via `addVehicleInstance`. Add a way to decrement directly from the browse page — likely a small counter widget (`- N +`) on owned cards.
- [ ] **Confirmed UX:** clicking "-" opens a small picker of owned instances (nicknames if set, otherwise "#1", "#2"…). User picks which to remove. Safer for instances with custom metadata.

### 🏷️ InstanceDrawer rename + collapse-to-buttons (partial ✅)
- [x] Rename **Nickname** → **Custom Name**
- [x] Rename **Custom Tags** → **Highlight features**
- [ ] **Still TODO:** replace always-visible input boxes with collapsed "+" buttons:
  - `+ Custom Name` — click reveals text input (or shows the current value with edit pencil if already set)
  - `+ Highlights` — click reveals the tag chip-input
  - `+ Notes` — click reveals the textarea
- [ ] Buttons live in a row under the vehicle header; clicking expands the field inline.

### 🧹 Bulk removal — clear-category + nuclear reset
- [ ] **Remove-all-by-category** buttons:
  - "Remove all planes"
  - "Remove all boats"
  - "Remove all businesses"
  - "Remove all residences" / "Remove all garages"
  - etc.
- [ ] Each shows a confirm dialog with the count (e.g. "Remove 8 aircraft?") before firing
- [ ] Server actions: `removeAllVehiclesInCategory(category)` and `removeAllPropertiesInGroup(ownershipGroup)`
- [ ] **Nuclear reset** button on `/profile` or a settings page: "Reset portfolio" — unowns everything (vehicles + properties + businesses + organizer plans). Two-step confirm with typing "RESET" to enable.

---

## 🔜 LSIA Vehicle Warehouse — missing from DB (first thing tomorrow)

> The LSIA (Los Santos International Airport) Vehicle Warehouse is missing from the seed. Current seed has 5 vehicle-warehouse instances; should be 6.

- [ ] Confirm canonical name + location via gtabase / Fandom
- [ ] Add row to `scripts/data/vehicle-warehouses-seed.ts`
- [ ] Source cover image (gtabase fetcher or manual drop)
- [ ] `npm run build:properties` → `npm run db:import`
- [ ] Verify on `/businesses?subtype=vehicle-warehouse`

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

- [ ] **Casino Penthouse** — source cover image (gtabase uses `igallery/` URL pattern; either extend fetcher or drop manually into `data/images/properties/casino-penthouse.webp`)
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
