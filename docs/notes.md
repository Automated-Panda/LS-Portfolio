# GT Vault — Notes & Followups

Running working checklist of what's next. Tick items off as we go. Roughly ordered by priority but feel free to jump around.

> ⚠️ **ACTION NEEDED — James: add 2 vehicle images (2026-06-05).** The catalog Sanchez fix is done but two photos are still missing:
> - **Plain Sanchez** (no livery, street-only) → drop into `docs/temp-images/sanchez.png` (currently still showing the livery photo)
> - **Sanchez 2** ($8k buyable) → drop into `docs/temp-images/sanchez2.png` (no image yet)
>
> Then ping me and I'll run `normalize-temp-images` + `images:publish` + push. (Same in-game look, so one photo can serve both if easier.)

---

## ✅ Session — 2026-06-05 (Favourites · Duplicates · Property page)

Shipped (migration 0035): boolean favourites, a duplicates view, and a dedicated detail page for **both properties and businesses** + the onboarding wizard — the old right-side `PropertyDrawer` is fully deleted.

### ⭐ Favourite cars — DONE (boolean model)
- [x] Migration `0035_vehicle_favourites.sql`: `user_owned_vehicles.is_favourite boolean not null default false` (applied to hosted GT Vault DB). Threaded through `OwnedVehicleInstance` + both instance queries.
- [x] Reusable `FavouriteStar` component (optimistic flip + rollback) + `setFavourite(instanceId, bool)` action. ⭐ on `/vehicles` owned popover rows, InstanceDrawer header, and `/my-vehicles` cards. "⭐ Favourites (N)" filter chip on `/my-vehicles`.
- [x] **Organizer wiring (the goal):** `favourites?: boolean` on `VehicleFilter`; ★ marker + note in `portfolio-context.ts`; `favourites` in `parse_intent` schema + behaviour note; honoured in `filter-vehicles.ts` (AND-across). New `filter-vehicles.test.ts` (4 cases). "organize my favourite cars into my mansions" now works.

### 👯 Duplicates — DONE
- [x] "👯 Duplicates (N)" chip on `/my-vehicles` — instances where you own 2+ of the same `vehicle_id` (client-side derive). URL-synced `?duplicates=1` (mirrors `?unassigned=1`).
- [x] Dashboard **NeedsAttention** stat "N duplicate vehicles (own 2+ of)" deep-linking to `/my-vehicles?duplicates=1`.

### 🏠 Dedicated detail page — DONE (PropertyDrawer fully deleted)
- [x] Shared **`components/portfolio/property-detail.tsx`** (`PropertyDetail`): header + **sections per storage area** (base + each installed storage upgrade / garage floor), each a **card grid** + an "+ Add" card → existing `VehiclePickerModal`. Cards carry ⭐ + manage (`InstanceDrawer`) + unassign. Upgrades checklist via new `usePropertyUpgrades` hook.
- [x] Routes `/my-properties/[id]` + `/my-businesses/[id]` (keyed by owned-property id). Owned-card clicks on `/my-properties`, `/my-businesses`, and the `/properties` + `/businesses` browse grids navigate here; `?open=<catalogueId>` redirects through the list grids.
- [x] **Onboarding wizard** renders `PropertyDetail` inline in a `Dialog` (`embedded` mode — no nav, `onRemoved` closes). `tagLookup` threaded through `OnboardingWizard`.
- [x] **`components/portfolio/property-drawer.tsx` DELETED** — businesses + onboarding migrated to the shared component, so the old right-side drawer is fully retired. (`PropertyDetail` props: `embedded?`, `backHref?`, `onRemoved?`.)
- [x] Verified: `tsc` clean, 104 tests green, `next build` compiles `/my-properties/[id]` + `/my-businesses/[id]` with no RSC errors.

---

## 💰 Session — 2026-06-01 (Monetization — credits + Stripe, end-to-end)

Shipped the **entire credit monetization system** in one session: pricing locked → Stripe set up → 3 plans built, merged to `main`, and pushed. Full purchase loop verified live with the Stripe CLI. Specs/plans in `docs/superpowers/`.

### 💬 Pricing strategy — LOCKED
- [x] Settled on **credit-based AI usage + a monthly subscription** (dropped the flat one-time unlock — the future open-ended GTA knowledge assistant is Sonnet-priced & unbounded, so credits future-proof cost + give recurring revenue/FOMO).
- [x] **App stays free; only AI costs credits.** Charge at plan *generation* (not apply); `messageCost = max(1, planCost)` where `planCost = 5 + 2×(extra intents)`, tweak/clarify/floor = 1. Free tier = **20 signup bonus + 10/month** refill (subscribers get no free refill). Spec: `docs/superpowers/specs/2026-06-01-pro-credit-pricing-design.md`.

### 💳 Stripe account + products
- [x] New **GT Vault** Stripe account (acct `…LlSdyTNuZP`), branded (logo/colors `#22A050`/`#18181B`, statement descriptor `GTVAULT.APP`, SaaS/personal). Custom domain skipped ($10/mo, not worth it yet).
- [x] 3 products live in **test & live** (Starter 50/$4.99 · Plus 150/$9.99 · Pro sub 250/mo $9.99) via idempotent `npm run stripe:setup` (`-- --live` for live). App resolves by `lookup_key` so test/live both work.
- [x] ⚠️ Learned: use the account's **test mode**, NOT the **Sandbox** (a stray env where the first setup run misfired). See `reference_stripe_golive` memory.

### 🏗️ Plan 1 — Credit ledger foundation (migration 0025)
- [x] `user_credits` (free/sub/purchased buckets) + append-only `credit_transactions` audit; signup grant via `handle_new_user`; Vitest-tested pure logic (`lib/credits/logic.ts`) + server module (getBalance/spendCredits CAS/grantCredits). Added **Vitest** to the project.

### 🚦 Plan 2 — Organizer credit gating
- [x] AI Organizer now **charges credits** (pre-check ≥1 before any LLM call; spend at generation; out-of-credits wall; balance in the input footer). **Owner (`james@automatedpanda.com`) = unlimited** via `lib/credits/access.ts` (ADMIN_EMAIL). Apply/undo free. App is now friend-launch-safe (free credits cap API spend).

### 🛒 Plan 3 — Stripe purchasing (migration 0026)
- [x] `/credits` page (tier cards + balance + portal link); `createCheckoutSession`/`createPortalSession` actions; **webhook** `app/api/stripe/webhook/route.ts` (signature-verified; packs on `checkout.session.completed`, subs on `invoice.paid`, cancel on `customer.subscription.deleted`); **atomic, service-role-only `grant_credits` RPC**; wall/footer → `/credits`.
- [x] Installed **Stripe CLI**; verified the **full loop live**: pack (+150), sub (+250 + flags), cancel (clears sub, keeps purchased), portal, idempotency.
- [x] 🐛 Fixed: auth middleware was **307-redirecting `/api/stripe/webhook`** to `/login` → events never landed. Exempted it (it verifies its own Stripe signature).

### 🚀 Shipped
- [x] All 3 plans **merged to `main` and pushed** (31 commits). Production build passes.
- [x] Documented the **8 Vercel env vars** + live-webhook setup; James configured them. Live webhook endpoint → `https://gtvault.app/api/stripe/webhook` (events: checkout.session.completed, invoice.paid, customer.subscription.deleted).

---

## ✅ Session — 2026-05-31 / 06-01

Big multi-part session. Highlights:

### 🌐 Marketing site — BUILT & live
- [x] Full landing page shipped (path-based on `gtvault.app/`, app stays at `/dashboard` etc.; logged-in users redirect to dashboard). Sections: hero ("Track your entire GTA V empire") → stat bar → features → **AI Organizer "Pro · Coming soon"** → screenshot showcase → pricing teaser → FAQ → final CTA → footer (Rockstar disclaimer).
- [x] Real app **screenshots** captured + normalized to webp (dashboard/vehicles/property/organizer) + a 1200×630 **OG share image**. Regen via `scripts/place-marketing-shots.mjs` + `scripts/make-og-image.mjs`; source PNGs in `docs/temp-images/`.
- [x] Spec/plan in `docs/superpowers/`. Built subagent-driven.

### 🧠 AI Organizer — chat/assistant redesign
- [x] Rebuilt `/organize` as a two-panel ChatGPT-style UI: thread rail + conversation with iMessage-style bubbles, animated thinking state, fills the page.
- [x] **Persisted, continuable threads** — new `conversations` table (migration `0024_organizer_conversations`), `organizer_plans.conversation_id`. Transcript rebuilt from plan rows.
- [x] **Pending-plan refinement** ("actually not the Zentorno") — refines the on-screen plan vs live portfolio; resets on apply/cancel/new.
- [x] **Rename + delete** chats (rail hover controls); **smarter auto-titles** from parsed intent ("Drift cars → Mission Row"), no extra API cost.
- [x] Plan list **no longer caps at 8** — shows all steps in a scrollable list.
- [x] Spec/plan in `docs/superpowers/`.

### ✈️ Hangar capacity boost (McKenzie + GTA+)
- [x] Regular Hangar's 20 slots moved to `base_capacity` (storage upgrade dropped). McKenzie has NO own storage — owning it boosts a Hangar 20→35 (40 for GTA+).
- [x] `lib/hangar-boost.ts` applies the boost in BOTH display + enforcement layers. `profiles.gta_plus` flag (migration `0023_add_gta_plus`) + a GTA+ toggle on `/profile`.

### 🛠️ Fixes
- [x] Dashboard Vehicles KPI counts **bikes** separately (was lumping motorcycles as cars — class is `MOTORCYCLE`→"Motorcycle"). Shared `isBikeClass` helper.
- [x] Storage UI shows asset-correct nouns (aircraft/boats/vehicles, not always "cars") on property cards/grids/picker.
- [x] McKenzie Field Hangar reclassified to its GTA Online reality (price $1,475,000).
- [x] Dashboard Businesses KPI split into **MC / Executive / Other**; Properties KPI no longer counts businesses.
- [x] Organizer delete-chat button fixed (confirm dialog was awaited inside `startTransition`).

---

## 🗓️ TOMORROW — next session priorities

1. ✅ **DONE 2026-06-01** — Pro pricing strategy + credit gating + Stripe purchasing (all 3 plans merged & pushed; see the Monetization session above).
2. **Verify live Stripe in prod** (after the Vercel deploy): confirm **migration 0026 is applied to the prod Supabase** project; send a test webhook event → expect 200; do one real low-stakes purchase ($4.99) → credits land (refund after); owner shows "Unlimited ⚡". (Steps in `reference_stripe_golive` memory.)
3. **Price filtering** — add a price filter (range/min-max) on `/vehicles`, `/properties`, and `/businesses`.
4. **Marketing copy** — bulk up / improve the text across the marketing site. Now that credits are live, also **update the landing "Pro · Coming soon" framing + pricing teaser** to match the credit model and link to `/credits`.

---

## 💡 Idea backlog (James brain-dump 2026-06-01 — discuss/scope later)

- **Suggestion / bug ticket submissions** — let users submit suggestions or bug reports from within the app.
- **Editor roles** — trusted people get limited edit access (see admin items below). Not full admin.
- **Better admin dashboard** — easier to use; **add/remove records** (James/owner only).
- **Editors editing existing data** — let trusted editors edit existing prices etc. (not add/delete records — that stays owner-only).
- **On-screen tour / "How it Works" doc** — new users have asked "how do I add another business?" / "how do I put cars in a business?". The onboarding wizard is okay but discovery is weak. Options: an interactive on-screen tour for new users, and/or an in-app reference doc ("How it Works"). Discuss approach later.
- _(More to come — James notes he's "exploding with thoughts", so expect additions.)_

---

## 🏁 Rebrand: LS Portfolio → GT Vault — 2026-05-30

Name locked and **`gtvault.app` purchased** ✅. "GT" reads as *Grand Tourer* (deniable, on-theme) with the GTA wink for fans — legally clean. Make the GTA connection in taglines/marketing (nominative fair use), never in the brand name itself.

- [ ] 🎨 **Design / create a logo** — *James* (GT-badge / vault motif)
- [x] ✍️ **Rename to GT Vault** across the app (2026-05-30) — swept every code/config/asset string: page title + metadata, sidebar + email logo wordmarks (interim `GT ★★★★★ VAULT`, awaiting real badge), favicon (`app/icon.svg`), `public/logo*.svg`, 6 email templates + `config.toml` subjects, `package.json`/`package-lock.json` name, admin export filename, profile/dashboard/intent-parser copy, seed comments. Historical docs (plan/specs/plans) left as a dated record. typecheck green.
- [ ] ▲ **Set up `gtvault.app` domain on Vercel** (add domain + DNS, set as primary, update any hardcoded URLs / `NEXT_PUBLIC_*` base URLs)
- [ ] 🌐 **Marketing site** — kick off once the above land (James: "we can start pretty soon!")

---

## 🗂️ Catalog data, filters & admin editor — 2026-05-29

Big session: catalog corrections, two new data dimensions (availability + vendor), UX fixes, and a self-serve admin editor.

### 🧰 Admin catalog editor (`/admin`) ✅
- [x] Email-gated `/admin` (`ADMIN_EMAIL` env, checked in layout + every server action). Writes via service-role server actions; catalog RLS stays read-only for everyone else.
- [x] Inline-editable tabs: **Vehicles** (name/price/availability/vendors), **Properties & Businesses** (name/price/capacity/counts-as-garage/subtype/neighborhood), **Upgrades** (grouped by property: name/capacity/price).
- [x] **DB is source of truth** for curated fields. `import-seed` made non-destructive (preserves curated columns on existing rows; new rows seed in full) so re-imports/rebuilds never clobber admin edits.
- [x] **⬇ Export backup** route downloads a JSON snapshot of all curated values to commit to git.
- [ ] ⚠️ **James TODO:** set `ADMIN_EMAIL` (= your app login email) + `SUPABASE_SERVICE_ROLE_KEY` in Vercel env, then redeploy — admin won't work live until then.
- 🔭 Deferred: add/delete records, edit upgrade structure (sub-slots/mutex/new upgrades), tag management, audit log.

### 🏷️ Vehicle availability — 5 statuses ✅
- [x] Migrations 0019 + 0020: `availability` (available / discontinued / unobtainable / blacklisted / seasonal). Sidecar `vehicle-availability.json` + build overlay + `npm run availability:apply`.
- [x] Status badge on cards + availability filter on `/vehicles`.
- [x] Seeded **182 discontinued** (Fandom "removed in San Andreas Mercenaries" June-2023 category), **9 blacklisted** (police/sheriff/ambulance dev vehicles), **3 seasonal** (Franken Stange / Lurcher / Sanctus).
- [ ] ⚠️ Discontinued list is June-2023 — some have since returned (Z-Type already fixed); prune as noticed (admin makes this easy now).

### 🛒 Vehicle vendor — multi-value ✅
- [x] Migrations 0021 + 0022: `vendors text[]`, auto-derived from cached Fandom "purchasable from X" categories into `vehicle-vendors.json`.
- [x] 7 storefronts (Southern San Andreas, Legendary Motorsport, Elitás Travel, Warstock, Dock Tease, Pedal & Metal, Benny's). A car lists all its stores (e.g. Comet → SSA + Legendary + Benny's). Vendor shown on the card maker line + vendor filter on `/vehicles`.
- Excluded Luxury Autos + Premium Deluxe Motorsport (weekly rotation, not worth maintaining).

### 🏠 Property storage data fixes ✅
- [x] Bail Office 3 → 2 (3rd bay is the included van); Higgins Helitours → no personal storage; Garment Factory → 10-car garage (counts_as_garage); Salvage Yard tow truck → 0 (mission vehicle, not a slot); McKenzie Hangar → aircraft not cars.
- [x] **Added Arena Workshop** (Arena War) — $995k, 10-car base garage + B1/B2 floors (30 max) + styles/quarters/Benny's mechanic/weapons expert. ⚠️ no image yet (gtabase 403s scripted fetch).

### 🔧 Manufacturers + search ✅
- [x] Merged duplicate manufacturers: Benefac → Benefactor, Lampada → Lampadati; renamed Dewbauch → Dewbauchee (build-pipeline guard prevents re-introduction).
- [x] **Accent-insensitive catalog search** — "franken" now finds "Fränken Stange" (it was never missing, just unsearchable).

### 🚗 Storage-aware picker + filters ✅
- [x] Property "Add cars" picker filters by storage type (garages → land, hangars → aircraft, yachts → boats); wording follows. InstanceDrawer location dropdown is category-aware + lists only garage-capable properties.
- [x] Picker name-wrap fix (3-col, no truncation) + drift-variant dedupe (one "Cypher").
- [x] Net-worth card: "N items missing a price" expands to list the actual unpriced owned items.
- [x] My Vehicles **Locations filter**: hides non-garage places; multi-level properties expand to per-level checkboxes (occupied levels only).
- [x] Z-Type price 10M → 950k (10M was the story-mode price).
- [x] **Bug fix:** editing a vehicle's tags no longer fails when its garage is full (capacity check now excludes the vehicle itself when re-saving in place).

---

## 💰 Portfolio pricing + Net Worth ✅ — landed 2026-05-28 (late)

End-of-day push to add canonical pricing data so we can show users their portfolio value.

### Phase A ✅ — Schema + extract existing upgrade prices
- [x] Migration `0012_add_price_columns.sql` — nullable bigint price column on vehicles / properties / property_upgrades.
- [x] Zod schemas + import-seed pipeline thread the price field through.
- [x] `scripts/extract-upgrade-prices.ts` parses `$N` / `$1.75M` / `$320K` patterns out of existing upgrade notes — 212 upgrade prices extracted automatically from the business audit's notes strings.

### Phase B ✅ — Vehicle prices
- [x] **732 / 807 vehicles priced (100% of purchasable)**. The 75 unpriced are intentionally non-purchasable (police/emergency, military, service, mission-only, removed-and-no-longer-buyable).
- [x] Sourced from Fandom infoboxes (bulk MediaWiki API) + gtabase for disambiguation cases.
- [x] Sidecar `data/seed/vehicle-prices.json` overlays prices during `npm run build:vehicles` so future raw-data rebuilds don't lose the data.

### Phase C ✅ — Property prices
- [x] **214 / 221 properties priced (100% of purchasable)**. The 7 unpriced are apartment-tower parent containers (capacity 0, not directly purchasable).
- [x] Sourced from gtabase property-type guides + the data we'd already pulled this session for mansions, vehicle warehouses, cargo warehouses.
- [x] Sidecar `data/seed/property-prices.json` overlayed in `build-properties.ts`.

### Phase D ✅ — Net Worth dashboard widget
- [x] `components/dashboard/net-worth-card.tsx` — hero card with compact USD formatting (e.g. `$87.4M`), per-category breakdown (Vehicles · Properties · Upgrades).
- [x] Page-level derivation sums prices over owned items; null prices counted separately as `unpricedItems` and surfaced in a footnote so users know it might be an underestimate.

---

## 🛠️ Session refinements — 2026-05-28 (late)

Cross-cutting polish on catalog data + management UX. A lot of small wins.

### 🏰 Mansion / included-on-purchase data
- [x] Fixed Mansion Garage capacity bug (a stray `replace_all` had set the new "Mansion Garage" upgrade's capacity to 0 → the storage block was being filtered out and users saw "No storage available yet").
- [x] Hid `included_on_purchase: true` upgrades from the **Upgrades tab checklist** — auto-installed perks aren't user choices. They still render in the **Garage tab** when they hold cars. `Install all` / `Uninstall all` and the `N / M upgrades` card badges now also exclude them so the counts match what the user sees.
- [x] Research-driven flag pass (gta.fandom.com + gtabase.com): marked **Agency Garage** (×4), **Clubhouse Garage** (×12), **Hangar Storage** (×5), **McKenzie + Higgins storage** as `included_on_purchase`. All 23 now hidden from checklists; existing owners' upgrades already installed so no backfill needed.
- [x] Fixed Vinewood Car Club base price ($50K → $0 — it's a GTA+ perk, not an in-game cost).

### 📊 Dashboard catalog widget
- [x] Split the Catalog widget into **Vehicles / Properties / Businesses** (was Vehicles / Properties).
- [x] **Cap-based scoring** for Properties + Businesses — denominator is the in-game ownership cap (10 apartments, 1 nightclub, etc.) instead of the catalogue total. James was right that "% of unique catalog" was misleading.
- [x] **Expandable "Show details"** per scope shows each ownership group's progress + either ✓ Complete, "Pick N more from M options" (open-pool groups like residential), or "Missing: A, B, C" (specific-choice groups like mansions, hangars, agencies).
- [x] Removed the "Properties by type" row from Portfolio breakdown (Arcade was leaking into the property section).
- [x] DB: `dashboard_catalog_group_rows` RPC + cap fallback to ownable-count (migrations 0016 + 0017; safe to drop the RPC later — no longer called from app code).

### 🏛️ Bail Office data fixes
- [x] **Mutex'd the 3 interior styles** per office (`mutex_group`) — picking one auto-uninstalls siblings (same mechanism as yacht models).
- [x] **Capped ownership at 1** (migration 0018) — buying a different bail office sells the current one in-game. Businesses cap dropped 32 → 28.

### 🛞 Vehicle management UX
- [x] **Gear icon on `/vehicles` owned cards** — sibling of the green ✓×N chip in the top-right cluster (mirrors PropertyCard). Opens InstanceDrawer directly for 1-instance vehicles, opens the picker popover for multi-instance vehicles.
- [x] Always-fresh instance list — gear refetches on click so it doesn't see a stale cache after `+ Add`.
- [x] **InstanceDrawer storage dropdown** — only shows "Base storage" when `base_capacity > 0`; hides the dropdown entirely when there's only one viable storage area (e.g. Mansion's Mansion Garage auto-selected). No more phantom "Base storage" on properties whose storage lives on an upgrade.
- [x] **Per-car gear icon** inside PropertyDrawer storage blocks — manage nickname / tags / notes / storage without leaving the property drawer.
- [x] **Custom-tag filter** (multi-select chip, AND match) on `/my-vehicles` next to the Locations filter. Auto-hides when the user has no custom tags.

### 🔁 In-place management drawer on browse pages
- [x] `/properties` + `/businesses` cards: settings icon (and clicking an owned card) now open the management drawer **in place** instead of routing to `/my-properties` / `/my-businesses`. The "+ Add cars" toast action also stays in place. PropertyCard now takes an optional `onOpenManagement` prop with a router-push fallback for legacy callers.

### 🖼️ Aviation images
- [x] Sourced + saved **Higgins Helitours** + **McKenzie Field Hangar** from Fandom via `static.wikia.nocookie.net`, normalized to 600w webp/q85 via the existing sharp pipeline. Cards no longer show "No image".

### ⚠️ Out-of-scope / flagged for follow-up
- [x] **McKenzie Field Hangar** — ✅ **Resolved 2026-05-31.** Corrected to its GTA Online reality: it has NO storage of its own; owning it **boosts a regular Hangar 20→35 (40 for GTA+)**. Hangar's 20 slots moved to `base_capacity` (storage upgrade dropped, Vehicle-Warehouse pattern). Boost modeled via `lib/hangar-boost.ts`, applied in both display (`getOwnedPropertiesWithStorage`) and enforcement (`capacityForStorageLocation`). Added `profiles.gta_plus` (migration 0023) + a GTA+ toggle on `/profile`. Spec/plan in `docs/superpowers/`.
- [ ] Style mutex coverage — only Bail Office has multi-row styles in our data today. If we add multi-style options later for other properties (Agency / Auto Shop / Hangar / Nightclub / Master Penthouse interior themes), each new group needs its own `mutex_group`.

---

## 🪦 Phase E — Discontinued vehicles list (next session)

> Surfaces vehicles that can no longer be purchased (excluding Simeon Premium Deluxe + LS Car Meet stock — those rotate weekly).

- [ ] Migration: add `availability` enum to `vehicles`: `in_store` / `discontinued` / `rotating` / `mission_only` / `unobtainable`
- [ ] Add `availability_updated_at` timestamp so we can date the snapshot
- [ ] Source the discontinued list — GTA Wiki "Discontinued Vehicles" page lists them DLC-by-DLC; gtabase tags some as "Removed" / "Unobtainable"
- [ ] **Explicitly exclude:** Simeon Premium Deluxe stock + LS Car Meet (rotating, not discontinued) — model as `rotating`
- [ ] UI: filter on `/vehicles` (e.g. `?availability=discontinued`); new chip near the existing filters
- [ ] Dashboard widget? A "grail count" stat — "you own 4 / 27 discontinued vehicles"

**Estimated effort:** 3-4 hours research + verification. Data goes stale on Rockstar updates so the workflow needs a "rebuild from latest patch" path.

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
