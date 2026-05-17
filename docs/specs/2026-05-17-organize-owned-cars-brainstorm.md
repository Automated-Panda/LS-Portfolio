# Track & Organize Owned Cars — Brainstorm Handoff (2026-05-17)

> **Status:** Brainstorm captured mid-flow — James wants to sleep. Resume tomorrow at "Next steps" below.
> **Brainstorming skill flow:** Steps 1–3 complete (context explored, clarifying questions asked, approach chosen). Steps 4–9 (present design sections → write spec → review → implementation plan) still to do.

---

## 🎯 What we're building

A two-piece feature that takes the app from "browse + toggle owned" to "I can actually use this to manage my GTA portfolio":

- **Piece 1 — Foundation (free tier).** Property-first onboarding wizard, marking properties + their installed upgrades, linking each owned car to a storage location, and a `/my-vehicles` view that surfaces storage + lets you filter by location. This is "the good state where I can use the app".
- **Piece 2 — Organizer (Pro tier).** Text-prompt → chained-displacement plan → checklist. The "I want all my drift cars in one place" feature.

These are decomposed into **two separate specs**. This doc covers the brainstorming context for both, but the next spec write-up is **Piece 1 only**.

---

## 🗺️ Where this fits in plan.md

This work *consumes* and *extends* what's in [`plan.md`](../plan.md):

- **Phase 4c** (`/my-properties` upgrade-tier UI) — currently queued as the next priority. Becomes part of Piece 1, because the organizer needs to know which sub-garages exist (e.g. L1/L2/L3 nightclub levels) before it can target them.
- **Phase 5** (Slot assignment / My Vehicles assign-to-property-slot) — currently "not started". Becomes the core of Piece 1.
- **Bulk-add UX / onboarding wizard** — currently deferred. Becomes part of Piece 1 and is the *primary* onboarding flow.
- **Pro tier / paywall** — `pro_tier` boolean + Stripe deferred to Phase 9 per existing decision. Piece 2 is built without the paywall gate for now; gate is wired up when Stripe lands.

---

## ✅ Decisions made tonight

| # | Question | James's answer | Implication |
|---|---|---|---|
| 1 | MVP scope | "Different scope" → described as: pick owned properties → pick owned cars → link them → text-prompt organizer that walks you through moves | Confirms the two-piece decomposition. Pro paywall is the organizer. |
| 2 | Storage granularity | **Property + sub-garage** | Use existing `user_owned_vehicles.assigned_upgrade_id` (references `property_upgrades.id`). No schema migration needed for the link itself. For simple properties (e.g. stand-alone garages with no upgrades), need a fallback — likely a synthetic "base" upgrade row, OR add `stored_in_property_id` as a sibling column. **Decision deferred — discuss in Piece 1 design.** |
| 3 | Onboarding approach | **Onboarding wizard (property-first walkthrough)** | When user signs in fresh: "pick a property you own → multi-select the vehicles stored inside → repeat per property". Solves bulk-add AND linking in one flow. |
| 4 | Organizer planning depth | **Smart — chained displacement** | When target is full, app computes a multi-step plan: displace existing cars to valid alternative slots, then place new cars in freed target. One plan, not multiple alternatives. |
| 5 | Plan delivery format | **Checklist only** (player uses GTA's interact menu to relocate; no need for step-by-step driving coach) | Simplifies the UX massively. Output is `[(vehicle, from, to), …]` ordered so each row is valid at execution time. User ticks them off as they relocate via interact menu in-game. |

### 🔑 The key insight (saved as a constraint on Piece 2)

> Players relocate vehicles via the **in-game interact menu**, instantly. The app doesn't need to model driving routes, fuel, or proximity — only slot accounting and dependency order. This makes the planning algorithm tractable: it's a constraint-satisfaction / topological-sort problem, not a routing problem.

---

## 🏗️ Approach chosen: **🅰️ Two-spec phased build**

1. **Now → tomorrow:** Brainstorm + ship **Piece 1 (Foundation)** as its own spec. ~2-3 implementation sessions.
2. **After Piece 1 is live:** Open a fresh brainstorm for **Piece 2 (Organizer)**. ~1-2 implementation sessions.

Why split:
- James can start using the app for tracking after Piece 1 ships, without waiting for the organizer.
- The organizer design benefits from being able to reason about James's *real* ownership data (post Piece 1).
- Each spec stays small and focused.

Rejected alternatives:
- 🅱️ One mega-spec: design too long, organizer decisions made too early.
- 🅲️ Skip wizard polish, organizer first: onboarding "edit 200 dropdowns" defeats the wizard's purpose; Phase 4c work still needed regardless.

---

## 🧱 What we already have (relevant to Piece 1)

From exploring the repo tonight:

- **Schema** (`supabase/migrations/0001_init.sql`):
  - `user_owned_properties (id, user_id, property_id, custom_name)` — already exists, ownership is a simple toggle.
  - `user_owned_property_upgrades (id, user_owned_property_id, property_upgrade_id)` — already exists, supports per-instance upgrade tracking. **No UI yet** (this is Phase 4c).
  - `user_owned_vehicles (id, user_id, vehicle_id, nickname, notes, assigned_upgrade_id)` — `assigned_upgrade_id` is the storage link. **Nullable, currently always null** because no UI sets it.
- **`/my-vehicles`** (`app/(app)/my-vehicles/page.tsx`) — currently just re-uses `<VehiclesBrowser>` with `mode="owned"` and filters to owned. No storage column, no location filter.
- **`/my-properties`** — exists as stub.
- **Property data** (Phase 4b complete) — 166 canonical property instances across 23 subtypes, all with images. Nightclubs/CEO offices/MC clubhouses have upgrade rows defining their stackable sub-garages.

---

## 🔓 Open questions to resolve at the start of tomorrow's design session

These need ~5 minutes of Q&A before we present the Piece 1 design:

1. **Slot accounting for properties without upgrades.** A stand-alone 6-car garage has no `property_upgrade` row — capacity is on the property itself (`properties.capacity`). For `assigned_upgrade_id` to work as the single FK, we either (a) add synthetic "base storage" upgrade rows for every garage-only property at seed time, or (b) add a nullable `stored_in_property_id` column to `user_owned_vehicles` and accept that storage = property-OR-upgrade. Probably (b) — less schema churn, less seed noise. **Discuss tomorrow.**
2. **Wizard re-entry.** After initial onboarding, what's the wizard's path back in? Is it a permanent CTA on `/my-vehicles` ("Add cars to a property"), or only shown on first visit? My take: permanent button, since people buy new properties + cars over time.
3. **Phase 4c upgrade UI shape.** When the user clicks an owned property in `/my-properties`, what's the checkbox list look like? Vertical list of all upgrade rows for that property, grouped by category (Garage / Equipment / Security)? Show prerequisites visually (greyed-out until parent checked)?
4. **Multi-select vehicle picker in wizard.** Re-use the existing `<VehiclesBrowser>` with a "selection mode" prop, or build a separate dedicated picker component? Existing browser has filters + URL state — would be a shame to rebuild.
5. **What does `/my-vehicles` show per row when storage is set?** A small "Stored at: Mission Row Nightclub · L2 Garage" line under the card? Or a dedicated table-view toggle? Cards stay visual; table is better for "where is everything" scanning.

---

## ▶️ Next steps when we resume (tomorrow)

1. **Re-read this doc + plan.md "Where we left off" section.** ~2 minutes.
2. **Resolve the 5 open questions above** via one-at-a-time AskUserQuestion. ~10 minutes.
3. **Present Piece 1 design in sections** (per brainstorming skill):
   - Section A: Schema changes (mostly none, but the synthetic-upgrade-vs-nullable-property-fk decision lands here).
   - Section B: Onboarding wizard flow (steps, props, state).
   - Section C: `/my-properties` upgrade-tier UI (Phase 4c).
   - Section D: `/my-vehicles` storage column + location filter.
   - Section E: Server actions (link/unlink vehicle, install/uninstall upgrade).
   - Get section-by-section approval.
4. **Write the formal Piece 1 design doc** → `docs/specs/2026-05-18-foundation-track-and-link-cars-design.md`.
5. **Spec self-review** + James reviews the written spec.
6. **Invoke writing-plans skill** to produce the implementation plan.
7. **Execute the plan** in subsequent sessions.

---

## 💡 Implementation hints for the future organizer spec (Piece 2)

Capturing these now while fresh, so the Piece 2 brainstorm has them on the table:

- **LLM scope.** Use Claude (`claude-haiku-4-5` likely sufficient) for *intent parsing only* — turning "put all my drift cars in one place" into a structured query like `{ criterion: { tag: "drift" }, target: "user-chosen or auto-pick" }`. The *plan computation* (chained displacement) is deterministic — constraint satisfaction is what computers are good at; LLMs aren't.
- **Algorithm sketch.** Given (criterion, target):
  1. Resolve criterion → set of vehicles V to move.
  2. Compute free capacity at target T. If `|V| ≤ free(T)`, output direct moves and done.
  3. Else: need to displace `|V| - free(T)` existing cars from T. Pick which to displace (heuristic: prefer cars not matching criterion). Find valid target slot(s) for each displaced car (anywhere with free space, ideally same-class or low-value targets). Recurse if displacement-of-displacement needed.
  4. Output as ordered list: all displacements first, then placements.
- **Conflict cases.** Insufficient total capacity → fail gracefully, suggest "you need ~N more slots; here are properties you don't own that would fit".
- **Pro paywall.** Build the feature unguarded. When Stripe lands in Phase 9, wrap the chat input in a `<RequiresPro>` boundary. Free users see a teaser ("Upgrade to Pro to organize with AI").
- **Cost.** Intent parsing is ~200 tokens in / ~50 out per query. Even on Sonnet, sub-cent per query. Prompt caching on the system prompt (vehicle taxonomy, property list) keeps it cheap.

---

## 📦 Files to commit (when ready)

- This brainstorm doc: `docs/specs/2026-05-17-organize-owned-cars-brainstorm.md`
- A `plan.md` "Where we left off" entry pointing here.

(Not committing tonight — review in the morning first.)

---

📄 **One file written, not committed.** Pick up tomorrow at "Next steps when we resume". 👉 Goodnight, James!
