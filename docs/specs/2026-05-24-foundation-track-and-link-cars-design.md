# Piece 1 — Foundation: Track & Link Owned Cars

**Status:** Design approved 2026-05-24. Ready for implementation plan.
**Brainstorm source:** [`docs/specs/2026-05-17-organize-owned-cars-brainstorm.md`](./2026-05-17-organize-owned-cars-brainstorm.md)
**Piece 2 (the AI organizer):** Out of scope — gets its own brainstorm after Piece 1 ships.

---

## Context

The app today browses the GTA catalogue and lets a user mark cars + properties as owned. That's it. There is no link between *which cars are stored where*, no per-instance ownership (you can't say "I own 3 Banshees"), no upgrade tracking per property (Phase 4c stub), and no onboarding flow to bootstrap a user's portfolio.

Piece 1 closes those gaps. It makes the app genuinely usable for tracking a real GTA fleet. The deliverable is "the good state where I can use the app" — Piece 2's organizer ("put my drift cars together") sits on top of this foundation.

---

## Goals

1. **Onboarding wizard** — first-time signups have a guided flow to log their owned properties and the cars stored at each.
2. **Per-instance vehicle ownership** — one user can own N copies of the same vehicle, each with its own storage, nickname, custom tags, and notes.
3. **Vehicle ↔ property storage link** — every owned vehicle can be assigned to a property (and a sub-garage when applicable). Capacity is enforced.
4. **`/my-properties` upgrade-tier UI (Phase 4c)** — owned properties' installed upgrades are user-managed. Storage upgrades and equipment/security/etc all live here.
5. **Trade-in flow** — when a new property purchase pushes a user over the in-game ownership limit, the app mirrors the GTA experience: pick which existing property to trade in, cars relocate automatically (with user input on excess).
6. **`/my-vehicles` upgraded** — storage location surfaced on each owned card, with a sortable table-view toggle, multi-select location filter, and an "Unassigned" bucket.
7. **Custom tags on owned vehicles** — text-array column, plain input, displayed alongside system tags, filterable.

---

## Decisions Locked

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | Vehicle ↔ property storage schema | Add nullable `stored_in_property_id` to `user_owned_vehicles`. Keep existing `assigned_upgrade_id`. Dual-link denormalized. | Less seed noise than synthetic "base storage" upgrade rows. ON DELETE SET NULL handles cleanup when a property is un-owned. Denormalized for query speed (no join through upgrades to reach the parent). |
| 2 | Wizard shape | Hybrid: **Hub (B) outside, Drawer (A-style) inside per property** | Hub is the same UI on first visit and 5th — natural re-entry without two layouts. Drill-in linear walkthrough delivers wizard-style guidance for one property at a time. |
| 3 | Wizard re-entry | First-visit only **until completed**. Completed = ≥1 property owned AND ≥1 vehicle linked. | Low bar, ensures bootstrap actually happens. After completion, additions flow through normal `/properties` and `/vehicles` browse. |
| 4 | Wizard drawer scope | Shows **full upgrade tree** (storage + equipment/security/etc.) — same component as `/my-properties` drawer. | One component, one mental model. Saves users going back and forth. |
| 5 | Drawer-skip rule for simple properties | Skip drawer entirely → open vehicle modal directly when property has **no sub-garage upgrade choices** | Stand-alone garages, apartments, Eclipse Blvd: storage is fixed, drawer adds zero value. Saves a click. |
| 6 | Vehicle picker per-sub-garage order | **One sub-garage at a time** (L1 → L2 → L3) | Matches how users think ("OK, what's in L1?"). Drag-to-assign is Piece 2 / Visual Garage Editor territory. |
| 7 | Skip whole onboarding | **Allowed at any time, no gate.** Wizard re-shows on next login until completed. | Hard-gating feels like a checkout. Full silent skip leaves an empty app. Soft completion threads the needle. |
| 8 | Upgrade UI shape | **Grouped by category, prereqs shown greyed-out with hint** | User can see the full upgrade tree without locking the unbuilt rows out of sight. |
| 9 | `/my-properties` card status overlay | **Upgrade progress overlay + cars-stored on separate line** | Cars are dynamic (day-to-day), upgrades are structural. Don't make them compete. |
| 10 | Empty `/my-properties` state | **Both CTAs: "Re-open wizard" + "Browse /properties"** | Two equally-valid entry points; let the user pick. |
| 11 | Un-own button location | **Inside the drawer, small red button** | Card-level un-own is too easy to mis-click. Drawer requires intent. |
| 12 | Trade-in is in Piece 1 | **Yes — wired in alongside manual un-own** | Reflects GTA reality (you trade in, not sell). Both flows share the same car-relocation primitive. |
| 13 | Cars don't fit in trade-in destination | **(c) Prompt user mid-flow to pick which N stay; excess become unassigned** | Mirrors in-game behaviour where excess cars are accessible "via the Mechanic" (≈ our unassigned bucket). User stays in control of which cars are temporarily disconnected. |
| 14 | Manual un-own button | **Keep it.** Same car-relocation prompt, but user picks the destination. | Mis-toggles happen. Cheap to keep, expensive to omit. |
| 15 | `/my-vehicles` default view | **Remember per user (localStorage)** | First-timers see cards (matches `/vehicles` familiarity); table-preferring users keep their choice. |
| 16 | Card sub-line format | `📍 Mission Row · L2` (compact) | Full property name + "Garage" suffix is too much weight on a card already showing 3 fields. |
| 17 | Unassigned cars UX | **Banner at top + per-card red CTA** | Two ways to discover the same fix; banner solves bulk, card CTA solves single. |
| 18 | Location filter | **Multi-select properties + dedicated "Unassigned" toggle** | Finding cars without storage shouldn't require deselecting every property. |
| 19 | Multi-instance ownership | **Refactored into Piece 1** — one card per instance | Schema already supports it (`user_owned_vehicles` has no `UNIQUE(user_id, vehicle_id)` and has `nickname`). Piece 2's organizer is broken without it. |
| 20 | Custom uploaded vehicle images | **Deferred to Piece 1.5** | Needs Supabase Storage bucket, RLS, upload UI, image processing. Not blocking core tracking utility. |
| 21 | Custom tags on owned vehicles | **In Piece 1 (MVP version)** | Tags directly feed Piece 2's organizer; without them, system tags miss the modded-out edge cases users care about most. MVP = `text[]` column, plain text input, chip display, filter extension. Chip-input editor with autocomplete deferred. |

---

## Schema Changes

Migrations land as `0004_vehicle_storage_link.sql` and `0005_property_ownership_groups.sql`. Both are additive — no breaking changes to existing tables.

### Migration 0004 — Vehicle storage + custom tags

```sql
-- Storage link
ALTER TABLE user_owned_vehicles
  ADD COLUMN stored_in_property_id uuid
    REFERENCES user_owned_properties(id) ON DELETE SET NULL;

CREATE INDEX idx_user_owned_vehicles_stored_property
  ON user_owned_vehicles(stored_in_property_id);

-- Custom tags
ALTER TABLE user_owned_vehicles
  ADD COLUMN custom_tags text[] NOT NULL DEFAULT '{}';

CREATE INDEX idx_user_owned_vehicles_custom_tags
  ON user_owned_vehicles USING gin(custom_tags);
```

**The dual-link rule** (enforced in app code, not as a DB CHECK):

| State | `stored_in_property_id` | `assigned_upgrade_id` | Meaning |
|---|---|---|---|
| Unassigned | NULL | NULL | Owned but storage not set |
| At a simple property | set | NULL | Stand-alone garage, apartment, etc. |
| In a sub-garage | set | set | Both set; storage is the upgrade, parent property denormalised for query speed |

If `assigned_upgrade_id` is set, `stored_in_property_id` MUST be set and point at the upgrade's parent. Server actions validate this.

### Migration 0005 — Property ownership groups + limits

```sql
ALTER TABLE properties
  ADD COLUMN ownership_group text;

-- Backfill: default each property's group to its subtype
UPDATE properties SET ownership_group = subtype;

-- Groupings that share a pool.
-- Apartments + stand-alone garages share the 10-property residential cap
-- post-Criminal Enterprises update. Stilt houses are tagged subtype='high-end-apartment'
-- in the seed (per neighborhood='Vinewood Hills'), so they're covered by that bucket.
UPDATE properties SET ownership_group = 'residential'
  WHERE subtype IN (
    'high-end-apartment', 'mid-end-apartment', 'low-end-apartment',
    'stand-alone-garage'
  );

-- Make it NOT NULL after backfill
ALTER TABLE properties
  ALTER COLUMN ownership_group SET NOT NULL;

CREATE TABLE property_ownership_limits (
  ownership_group text PRIMARY KEY,
  max_owned int NOT NULL
);

-- Eclipse Blvd Garage: doesn't count toward any cap. We model this by NOT inserting
-- a row for its group ('eclipse-blvd-garages'). Server-action checks treat
-- "no row in property_ownership_limits" as unlimited.

INSERT INTO property_ownership_limits (ownership_group, max_owned) VALUES
  ('residential', 10),              -- apartments + stand-alone garages (combined cap)
  ('casino-penthouse', 1),          -- see Open/Verify item 5
  ('nightclub', 1),
  ('ceo-office', 1),
  ('mc-clubhouse', 1),
  ('bunker', 1),
  ('hangar', 1),
  ('facility', 1),
  ('arcade', 1),
  ('auto-shop', 1),                 -- verify (Open item 1)
  ('agency', 1),                    -- verify (Open item 1)
  ('salvage-yard', 1),              -- verify (Open item 1)
  ('vehicle-warehouse', 1),
  ('super-yacht', 1),
  ('biker-business-coke', 1),
  ('biker-business-meth', 1),
  ('biker-business-weed', 1),
  ('biker-business-cash', 1),
  ('biker-business-forgery', 1);
```

---

## GTA Ownership Limits — Research (May 2026 current)

Sources cited inline.

| Group | Max | Confidence | Source |
|---|---|---|---|
| `residential` (apts + stand-alone garages + stilt houses, combined) | **10** | High | [Sportskeeda — How many properties can you own](https://www.sportskeeda.com/gta/how-many-properties-can-gta-online-criminal-enterprises) — post-1.61 Criminal Enterprises cap |
| Eclipse Blvd Garage | **Unlimited / doesn't count** | High | Sportskeeda — explicitly noted as not counting toward the 10-property cap |
| `nightclub` | **1** | High | [GTA Wiki — Nightclubs](https://gta.fandom.com/wiki/Nightclubs); confirmed multiple sources |
| `ceo-office` | **1** | High | Office Garages stack on top (up to 3 per office), but only 1 office | 
| `mc-clubhouse` | **1** | Medium-High | Required to register as MC President; community consensus is 1 |
| `bunker` | **1** | High | Sportskeeda specialist-properties guidance |
| `hangar` | **1** | High | Same |
| `facility` | **1** | High | Same |
| `arcade` | **1** | Medium | Not explicitly stated in search but consistent with specialist-property pattern |
| `auto-shop` | **1** | Medium — VERIFY | "Choose from 5 locations" but ownership limit unclear in sources |
| `agency` | **1** | Medium — VERIFY | Specialist-property pattern; not explicit in sources |
| `salvage-yard` | **1** | Medium — VERIFY | Same |
| `vehicle-warehouse` | **1** | High | Tied to CEO operations |
| `super-yacht` | **1** | High | Single owned yacht at a time |
| Each `biker-business-*` (5 types) | **1 each** | High | [GTA Boom Bikers Guide](https://www.gtaboom.com/gta-online-bikers-business-profit-chart-and-guide-e0af) — one of each of the five MC business types |
| `casino-penthouse` | **1** | High | Single in-game property |

**Verify-flagged items** (auto-shop, agency, salvage-yard) — implementation plan will spawn a focused subagent to confirm before seed lands. If any of them allow multiple, update the seed and remove the limit row.

Sources used for this research:
- [Sportskeeda — Properties limit in Criminal Enterprises](https://www.sportskeeda.com/gta/how-many-properties-can-gta-online-criminal-enterprises)
- [GTA Fandom Wiki — Nightclubs](https://gta.fandom.com/wiki/Nightclubs)
- [GTA Fandom Wiki — Garages in GTA Online](https://gta.fandom.com/wiki/Garages_in_GTA_Online)
- [GTA Boom — Bikers Profit Guide](https://www.gtaboom.com/gta-online-bikers-business-profit-chart-and-guide-e0af)
- [Steam Discussion — Multiple Auto Shops](https://steamcommunity.com/app/271590/discussions/0/3061869473065880325/)

---

## UX Surfaces

### Surface A — Onboarding Wizard

**Trigger:** first login after signup AND not-yet-completed (no owned properties OR no owned vehicles with storage). Re-shows on subsequent logins until completed.

**Step 1 — Pick properties.** Re-uses `<PropertiesBrowser>` with a `selectionMode="multi"` prop. Multi-select grid; user clicks the tile of each property they own. "Skip for now" button always visible. "Continue with N selected" button enables once ≥1 selected (or always for skip case).

**Step 2 — Hub.** Property checklist UI. One row per owned property, each with:
- Property image (small) + name + subtype + neighborhood
- Status pill: `Empty` / `In progress (8 of ~30)` / `✓ Complete (N cars)`
- Click anywhere on row → opens drawer for that property

Footer: "Finish later" (closes wizard, will re-appear next login if not completed) + "Done" (closes wizard regardless).

**Step 3a — Drill-in drawer (complex properties only).** Slides in from right; hub remains visible behind. Sections:
- **Storage upgrades** — checkboxes for sub-garage tiers (e.g., Garage L1/L2/L3), with prereqs greyed-out and shown
- **Equipment & security** — checkboxes for non-storage upgrades (Equipment, Security, Dry Ice, etc.)
- **Your storage (click to manage cars)** — one row per *installed* storage location (the base property if no sub-garages, or each installed sub-garage). Each row shows `Name · N/Capacity cars`. Click → opens vehicle modal.
- **"Un-own / trade in this property"** button at bottom (small, red).

**Step 3b — Drawer-skip for simple properties.** When a property has no sub-garage upgrade choices (stand-alone garage, apartment, Eclipse Blvd, etc.), clicking the hub row skips the drawer entirely and opens the vehicle modal directly.

**Step 4 — Vehicle modal.** Built on `<VehiclesBrowser>` with `selectionMode="multi-count"` (each tile shows a `+/-` counter for instance count, not a binary toggle). Header shows target context: *"Adding cars to Mission Row Nightclub · L2 Garage"*. Footer: live capacity (`3 selected · 7 slots free`) + Save / Cancel. Save → creates N new `user_owned_vehicles` rows with storage set → returns to drawer with updated counts.

### Surface B — `/my-properties` (Phase 4c)

Card grid mirroring `/properties` browse, filtered to owned. Each card shows:
- Property image + name + subtype + neighborhood
- Status overlay (top-right of image): `✓ Fully built` / `2/3 upgrades` / `No upgrades`
- Cars-stored line under the type: `🚗 18 / 31 cars stored`

Filter bar: search + subtype dropdown (subtypes user owns).

Click card → opens the same drawer as Surface A's Step 3a. Behaviour identical, just standalone instead of mid-wizard.

**Empty state** (user owns 0 properties): both CTAs side-by-side — *"Open onboarding wizard"* and *"Browse /properties"*.

### Surface C — `/my-vehicles` upgraded

Card grid (existing), with new pieces:

- **View toggle in header:** `▦ Cards | ☰ Table` (default = user's last choice, localStorage; first-timer = Cards)
- **Sub-line on each card:** `📍 Mission Row · L2` (or `📍 Not stored →` red CTA for unassigned)
- **Banner above grid** (shown only when N > 0 unassigned cars): *"3 cars need a home → [Set up storage]"* — click opens the wizard hub
- **Location filter** in `<FilterBar>`: multi-select dropdown of owned properties + dedicated "Unassigned only" toggle
- **Owned ×N counter** on `/vehicles` browse cards when user owns multiple instances

**Table view** (toggle alternate):
- Columns: Vehicle / Class / Manufacturer / Property / Sub-garage / Tags
- Sortable on all columns; sort by Property groups everything at one location
- Click row → opens the instance drawer (Surface D)

### Surface D — Instance Drawer (NEW)

Per-vehicle editor. Triggered by clicking a card in `/my-vehicles` (card or row). Sections:
- Header: vehicle image + canonical name (e.g., "Banshee — Bravado")
- **Nickname** input (e.g., "Pearl Black Banshee")
- **Storage location** — property dropdown (owned properties) + sub-garage dropdown (only enabled if property has upgrades; only shows installed sub-garages)
- **Custom tags** — plain text input, comma-separated. Server normalises to lowercase + trim + dedupe on save.
- **Notes** — multi-line textarea
- **Remove this instance** — small red button at bottom

Links bidirectionally with Property Drawer: clicking "Mission Row Nightclub" in the storage line opens the Property Drawer.

---

## Trade-In Flow

### Auto-detected at `/properties` browse

When user clicks "Own" on a property at `/properties`:

1. `togglePropertyOwnership(propertyId)` server action runs.
2. Server checks the property's `ownership_group`, counts user's current owned in that group, looks up `max_owned`.
3. **Under limit:** normal ownership toggle (current behaviour).
4. **At limit:** returns `{ needsTradeIn: { group, currentlyOwned: Property[] } }` — client renders the trade-in modal.

### Trade-in modal

**Variant A — single-max group (1 of 1).** Shows the one currently-owned property to be traded, lists its cars, capacity check:
- If new property has capacity ≥ current cars: *"All N cars will move to [new property]"*. One-click confirm.
- If new property has less capacity: prompts user to pick which N cars stay (rest become unassigned). Counter shows `N selected · ⚠️ M will become unassigned`.

**Variant B — N-max group (e.g., residential 10/10).** Shows radio list of currently-owned properties in this group with their car counts. User picks which to trade. Same capacity-check pattern.

Confirm → `tradeInProperty()` action runs: cars relocate (or move to unassigned per user choice), old property un-owned, new property owned. Atomic transaction.

### Manual un-own from drawer

The drawer's red "Un-own / trade in this property" button. Same destination-picker flow but user explicitly chooses where cars go (dropdown of OTHER owned properties + "Leave unassigned" radio). Used for data corrections.

### Eclipse Blvd Garage exception

Doesn't count toward any group limit (no row in `property_ownership_limits`). When user clicks "Own", the server check sees no limit row → permits unconditional add. No trade-in flow ever triggers for it.

---

## Server Actions Surface

Full API for Piece 1. New actions explicitly marked.

### `app/(app)/properties/actions.ts`

```ts
// EXISTING — semantics extended for trade-in awareness
togglePropertyOwnership(propertyId: string)
  → { ok: true }
  | { needsTradeIn: { group: string; currentlyOwned: Array<{
        id: string; display_name: string; car_count: number;
      }>; newProperty: { id: string; capacity: number } } }
  | { error: string }

// NEW
tradeInProperty(opts: {
  newPropertyId: string;
  tradeInPropertyId: string;
  carDestinations: Array<
    | { ownedVehicleId: string; action: "move" }       // → new property
    | { ownedVehicleId: string; action: "unassign" }   // → null storage
  >;
})
  → { ok: true } | { error: string }

// NEW — manual un-own (data correction path)
unownProperty(opts: {
  ownedPropertyId: string;
  carDestinations: Array<{
    ownedVehicleId: string;
    destinationPropertyId: string | null;   // null = unassign
  }>;
})
  → { ok: true } | { error: string }
```

### `app/(app)/my-properties/actions.ts` (new file)

```ts
toggleUpgradeInstalled(ownedPropertyId: string, upgradeId: string)
  → { ok: true } | { error: string }
// Server enforces required_upgrade_id chains:
// - install: requires parent upgrade already installed
// - uninstall: cascades to dependent upgrades (or rejects with error if any are installed)
```

### `app/(app)/my-vehicles/actions.ts` (new file)

```ts
assignVehicleStorage(opts: {
  ownedVehicleId: string;
  ownedPropertyId: string | null;
  assignedUpgradeId: string | null;
})
  → { ok: true }
  | { capacityExceeded: { capacity: number; current: number } }
  | { error: string }

// Bulk version used by the wizard's vehicle modal
assignVehiclesToSubGarage(opts: {
  ownedPropertyId: string;
  assignedUpgradeId: string | null;
  vehicleIds: string[];   // creates N new user_owned_vehicles rows
})
  → { ok: true; createdInstanceIds: string[] }
  | { capacityExceeded: { capacity: number; wouldBeAfter: number } }
  | { error: string }

updateVehicleInstance(opts: {
  ownedVehicleId: string;
  nickname?: string | null;
  notes?: string | null;
  customTags?: string[];   // normalised server-side: lowercase, trim, dedupe
})
  → { ok: true } | { error: string }

removeVehicleInstance(ownedVehicleId: string)
  → { ok: true } | { error: string }
```

### `app/(app)/vehicles/actions.ts` (modified semantics)

```ts
// EXISTING — semantics change for multi-instance
// Old: toggleVehicleOwnership(vehicleId) — binary toggle
// New: addVehicleInstance(vehicleId) — always adds +1 instance
addVehicleInstance(vehicleId: string)
  → { ok: true; createdInstanceId: string } | { error: string }
// Removal NO LONGER happens from /vehicles. Use removeVehicleInstance in /my-vehicles.
```

### `lib/queries/` additions

- `getOwnedPropertiesWithStorage(userId)` — properties + installed upgrades + nested car-count per sub-garage. One query, multiple joins. Powers `/my-properties` cards.
- `getOwnedVehicleInstances(userId)` — instances + joined vehicle reference data + storage location names + custom_tags. Powers `/my-vehicles`.
- `getOwnershipGroupStatus(userId, group)` — returns `{ owned: Property[]; max: number; atLimit: boolean }`. Used by trade-in check.

### Capacity enforcement helper

`lib/capacity.ts`:

```ts
capacityForStorageLocation(
  ownedPropertyId: string,
  assignedUpgradeId: string | null
): Promise<number>
// Handles upgrade-stacked nightclubs and bare-property garages uniformly.
// - assignedUpgradeId set → returns that upgrade's capacity column
// - assignedUpgradeId null → returns the property's base capacity column
```

Server actions call this before any assignment to compute remaining slots. Client also calls it pre-flight to disable the Save button when over-capacity, but the server is the source of truth.

### Wizard state — derived, not stored

No `wizard_state` table. The wizard is a client state machine over already-persisted data:

- `wizardCompleted` = `owned_properties >= 1 AND owned_vehicle_instances_with_storage >= 1` (computed in `lib/queries/wizard.ts`)
- Per-property "In progress" status = property owned + 0 vehicles linked to it
- Hub is just a query over `user_owned_properties` + per-property car count

Layout-level loader in `(app)/layout.tsx` fetches `wizardCompleted` and conditionally redirects first-login users to `/wizard`.

---

## Components

| Component | Purpose | New? |
|---|---|---|
| `<OnboardingWizard>` | Step machine: property picker → hub → drawer ⇄ vehicle modal | New |
| `<PropertyHubList>` | Hub checklist; one row per owned property with status pill | New |
| `<PropertyDrawer>` | Drawer for managing one property's upgrades + storage list | New (shared by wizard + /my-properties) |
| `<VehiclePickerModal>` | Multi-count vehicle picker bound to one sub-garage | New |
| `<InstanceDrawer>` | Per-vehicle editor: nickname, tags, notes, storage assignment | New |
| `<TradeInModal>` | Variant A/B trade-in chooser + car-destination picker | New |
| `<MyPropertiesGrid>` | Owned properties card grid (Phase 4c implementation) | New |
| `<MyVehiclesGrid>` | Owned vehicles grid (existing — modified to show sub-line, unassigned banner) | Modified |
| `<MyVehiclesTable>` | Sortable table view alternate | New |
| `<LocationFilter>` | Multi-select property filter + Unassigned toggle | New |
| `<CustomTagsInput>` | Plain text comma-separated input + chip display | New (MVP) |
| `<PropertiesBrowser>` (selection mode) | Existing — extended with `selectionMode="multi"` prop | Modified |
| `<VehiclesBrowser>` (selection mode) | Existing — extended with `selectionMode="multi-count"` prop | Modified |

---

## Multi-instance ownership — implications across the app

| Surface | Today | Piece 1 |
|---|---|---|
| `/vehicles` browse card | Toggle: Own/Owned (binary) | "+ Add to portfolio" button (always +1). `Owned ×N` chip if N>0. Removal not exposed here. |
| `/my-vehicles` cards | One per vehicle | One per instance. Cards show nickname if set, fall back to canonical name + instance suffix (e.g., "Banshee #2") |
| Wizard vehicle modal | N/A | Each tile shows current count for THIS sub-garage. Counter `+/-` per tile. Sub-garage capacity enforces ceiling. |
| Storage drawer car list | N/A | Lists per-instance, shows nickname or "Banshee #1 / #2 / #3" |
| Drift sub-toggle on `/vehicles` card | Toggles which vehicle_id is referenced when ownership is added | Same — with drift toggled, "+ Add to portfolio" creates an instance of the drift-variant vehicle_id (e.g., `drift_banshee`). The `Owned ×N` chip sums base + drift instances under the one collapsed card. Each instance row is still tied to its actual vehicle_id. |
| `assigned_upgrade_id` / `stored_in_property_id` | One value per vehicle | One value per instance |

Database: zero schema changes for multi-instance — `user_owned_vehicles` already has no `UNIQUE(user_id, vehicle_id)` and has the `nickname` field. The original schema anticipated this; we just never built UI for it.

---

## Custom Tags (MVP)

**In scope:**
- `custom_tags text[]` column on `user_owned_vehicles` (added in migration 0004)
- Plain comma-separated text input in `<InstanceDrawer>` (e.g., `"drift, gymkhana, F1 wheels"`)
- Server normalises on save: lowercase, trim each, dedupe (preserves order)
- Render as chips in `<VehicleCard>` and `<MyVehiclesTable>`, after system tags, with a subtle visual difference (e.g., outlined vs filled)
- Extend `<FilterBar>` tag selector to include the union of system tags + all custom tags across user's fleet
- GIN index on `custom_tags` for fast filter queries

**Out of scope (Piece 1.5+):**
- Chip-input editor (vs plain text)
- Autocomplete from existing tags
- Tag-rename / merge / delete operations
- Tag co-occurrence suggestions
- Org-wide tag dictionary

---

## Deferred — Explicit Future Work

These come AFTER Piece 1 ships. Named so the spec is unambiguous about scope.

| Deferred item | Target |
|---|---|
| Custom uploaded vehicle images | Piece 1.5 |
| Chip-input tag editor + autocomplete | Piece 1.5 |
| Auto-detected ownership-limit trade-in for Eclipse Blvd Garage variants if more than one is ever added | Piece 1.5 |
| Pro tier paywall (Stripe + `pro_tier` boolean) | Phase 9 |
| AI organizer ("put my drift cars in one place") | Piece 2 |
| Per-slot x/y positions in a property | Phase 8 (Visual Garage Editor) |
| Move-history audit log | Piece 2 if needed |

---

## Open / Verify Items

These need confirmation during or after implementation:

1. **Auto-shop, agency, salvage-yard ownership limits** — set to 1 in migration 0005 with `verify` flagged. Implementation plan should spawn a subagent to confirm; update if wrong.
2. **MC Clubhouse limit** — research says 1, community consensus says 1, but I haven't seen Rockstar Support state it explicitly. Currently set to 1.
3. **Office Garage slots stacked on a CEO Office** — the office itself caps at 1, but a single office can have up to 3 stacked office garages installed. This is correctly modelled as 3 `property_upgrades` on the single CEO Office row. Verify the seed has these as upgrade rows.
4. **Stilt house grouping** — currently coded into `subtype='high-end-apartment'` per the seed. The migration backfill assigns the entire `high-end-apartment` subtype to the `residential` group, which is correct — stilt houses share the apartments pool in-game.
5. **Casino Penthouse counting toward the residential pool** — research is ambiguous. Currently set to `casino-penthouse` group with cap 1 (independent of residential). If it does count toward the 10-property residential cap, fold it into `residential` group instead.

---

## Acceptance Criteria

Piece 1 is "done" when:

1. A brand-new signup is redirected to `/wizard`, picks ≥1 property, clicks into it, marks installed upgrades (if any), assigns ≥1 vehicle instance to a storage location, and lands on a `/my-vehicles` page showing that car with its `📍 Storage` sub-line.
2. The same user can open `/my-properties`, click an owned property, manage its full upgrade tree (including non-storage upgrades), and see car counts update live.
3. The same user can own multiple instances of the same vehicle, each with distinct nickname / tags / storage.
4. Trying to "Own" a new nightclub when one is already owned triggers the trade-in modal, and confirming relocates the old nightclub's cars to the new one.
5. Manual un-own from the drawer prompts for car destinations and atomic-relocates them.
6. `/my-vehicles` filter shows only the cars at selected properties, and the "Unassigned" toggle shows only unassigned ones.
7. View toggle switches between cards and table; choice persists across sessions.
8. Custom tags can be added to an instance and used to filter.
9. Wizard does not re-appear on subsequent logins once user has ≥1 property AND ≥1 vehicle linked.

---

## Files Affected — Summary

**New migrations:**
- `supabase/migrations/0004_vehicle_storage_link.sql`
- `supabase/migrations/0005_property_ownership_groups.sql`

**New pages:**
- `app/(app)/wizard/page.tsx`
- `app/(app)/wizard/actions.ts` (thin — most logic is in shared per-feature action files)

**New action files:**
- `app/(app)/my-properties/actions.ts`
- `app/(app)/my-vehicles/actions.ts`

**Modified action files:**
- `app/(app)/properties/actions.ts` (extends `togglePropertyOwnership`, adds `tradeInProperty`, `unownProperty`)
- `app/(app)/vehicles/actions.ts` (semantic shift to `addVehicleInstance`)

**New + modified components** — listed in the Components table above (10 new, 3 modified).

**Modified pages:**
- `app/(app)/my-properties/page.tsx` (stub → real implementation)
- `app/(app)/my-vehicles/page.tsx` (existing — wired to new components)
- `app/(app)/vehicles/page.tsx` (FilterBar gains nothing new; cards gain `Owned ×N` chip)
- `app/(app)/layout.tsx` (wizard-redirect logic for first-login users)

**New library code:**
- `lib/queries/wizard.ts`
- `lib/queries/my-properties.ts`
- `lib/queries/my-vehicles.ts` (rewrite of existing)
- `lib/capacity.ts`

---

📄 **End of design spec.** Implementation plan to follow via the `writing-plans` skill.
