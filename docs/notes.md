# LS Portfolio — Notes & Followups

Running working checklist of what's next. Tick items off as we go. Roughly ordered by priority but feel free to jump around.

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
- [ ] **You verify:** apply migration 0010 in Studio + visit `/properties?subtype=mansion` + `/wizard` picker shows them under "Mansion" group

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

## 🔮 Deferred (revisit later)

- Phase 9 — Stripe, Pro tier paywall (`<RequiresPro>`), domain, analytics, full launch polish
- Piece 2.1+ — distribution-mode planner, auto-target-picking, plan history pagination, stale `pending` cleanup
- `custom_only` flag baked into `tags.json` (avoid post-pass script)
- `DISPLAY_NAME_OVERRIDES` map in `build-vehicles.ts` (survive rebuilds)
