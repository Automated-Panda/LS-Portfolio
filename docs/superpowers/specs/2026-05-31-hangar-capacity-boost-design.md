# Hangar Capacity Boost (McKenzie + GTA+) — Design

**Date:** 2026-05-31
**Status:** Approved design, ready for implementation plan
**Owner:** James

---

## 1. Purpose

Model the GTA Online mechanic where owning the **McKenzie Field Hangar** boosts the
player's regular **Hangar** aircraft capacity, and let users declare **GTA+**
membership (which changes the boost amount). Today our data model treats every
property's capacity as self-contained, so this cross-property, membership-dependent
bonus can't be represented — owning both a Hangar and McKenzie wrongly shows the
Hangar at 20 instead of 35/40.

### The confirmed mechanic

- A regular **Hangar** stores **20** aircraft. Only one Hangar is ownable
  (`hangar` ownership group, `max_owned = 1`).
- The **McKenzie Field Hangar** has **NO storage of its own** — it is purely an
  unlock. Owning it raises the Hangar's capacity:
  - **+15 → 35** for a normal player.
  - **+20 → 40** for a **GTA+** member.
- If the player owns McKenzie but **no Hangar**, it grants nothing (still ownable;
  its $1,475,000 still counts toward net worth).
- Order-independent: buying McKenzie-then-Hangar or Hangar-then-McKenzie both apply
  the boost.

### Success criteria

- A user who owns a Hangar + McKenzie sees the Hangar at **35** (or **40** with GTA+)
  everywhere capacity appears, and can actually park that many aircraft.
- A user who owns McKenzie but no Hangar sees no capacity change anywhere.
- Toggling GTA+ on `/profile` immediately changes the Hangar's shown + enforced
  capacity between 35 and 40.
- McKenzie is never shown as having storage of its own.

---

## 2. Restructure the Hangar's storage onto base_capacity (precedent: Vehicle Warehouse)

**Today** the Hangar's 20 slots live on a `Hangar Storage` **upgrade**
(`hangar-<loc>-storage`, capacity 20, `included_on_purchase`), with
`properties.capacity = 0`. Per James's decision, restructure so the **Hangar's 20 is
its `base_capacity`** and the storage upgrade row is removed — exactly the change
already made for Vehicle Warehouses ("moved storage from upgrade → base_capacity,
dropped the `*-storage` rows, import-seed cleans orphans"; see `docs/notes.md`). This
makes the boost a simple addition to a property's base capacity rather than a
special-cased upgrade.

This part is a prerequisite restructure (Tasks early in the plan), separate from the
boost logic:

- Seed: set the 5 regular `hangar` rows' `capacity` to 20 and delete their
  `hangar-<loc>-storage` upgrade rows (keep the Aircraft Workshop upgrade).
- `import-seed.ts` already cleans orphaned `property_upgrades` not present in the seed,
  so a re-import drops the storage rows from the DB. `user_owned_vehicles.assigned_
  upgrade_id` is `ON DELETE SET NULL`, and **base storage is represented by
  `assigned_upgrade_id = null`** — so any aircraft currently parked in a hangar's
  storage upgrade automatically fall back to that hangar's base storage. No aircraft are
  un-stored from the property (`stored_in_property_id` is untouched); they remain in the
  hangar at base level. No manual re-linking needed.
- The hosted DB has curated columns preserved by `upsertPreservingCurated` (price,
  capacity, counts_as_garage). Because `capacity` is curated, the 0→20 change must be
  applied to the live DB directly (a one-off update, like the McKenzie fix), not relied
  on via re-import.

After the restructure, the boost adjusts the Hangar's **effective base capacity**, and
must be applied in **two independent layers that must agree**:

1. **Display layer** — capacity numbers on property cards, the property drawer storage
   block, and the dashboard capacity total.
2. **Enforcement layer** — `lib/capacity.ts` `capacityForStorageLocation`, which the
   server actions (`assignVehiclesToSubGarage`, `assignVehicleStorage`) use to decide
   whether an aircraft can be parked. If display says 35 but enforcement still says 20,
   the user sees "12/35" but gets rejected at 20. Both must use the same rule.

Because the boost now targets **base storage** (`assignedUpgradeId === null`) on a
Hangar, the rule keys off the **property** being a regular hangar
(`ownership_group = 'hangar'` / `subtype = 'hangar'`), not an upgrade id.

---

## 3. GTA+ membership

- New boolean column `gta_plus` on `public.profiles`, default `false`.
- A **"GTA+ member"** toggle (checkbox/switch) on the `/profile` page, in the Account
  card, persisted via the existing `updateProfileAction`.
- Account-wide and reusable: future GTA+-dependent perks can read the same flag.
- Helper copy under the toggle: e.g. "Unlocks GTA+ perks like the larger McKenzie
  hangar boost."

---

## 4. The boost rule (single source of truth)

Centralize the rule in one place so display and enforcement can't drift:

```
hangarBoost(ownsMckenzie: boolean, gtaPlus: boolean): number
  = ownsMckenzie ? (gtaPlus ? 20 : 15) : 0
```

It applies **only** to a regular Hangar's **base storage**. Identify the target by the
property: `ownership_group = 'hangar'` (equivalently `subtype = 'hangar'`), and the
base-storage location (`assignedUpgradeId === null`). It does NOT apply to McKenzie
itself, nor to other hangar upgrades (Aircraft Workshop). McKenzie is `subtype =
mckenzie-hangar`; "owns McKenzie" = the user has a `user_owned_properties` row for the
`mckenzie-field-hangar` catalogue id.

Because capacity computations happen both per-user (display, enforcement) we need, for
a given user:
- `ownsMckenzie` — does a `user_owned_properties` row exist for `mckenzie-field-hangar`?
- `gtaPlus` — `profiles.gta_plus` for that user.

These are looked up once per request and threaded into the capacity computations.

---

## 5. Components & data flow

### 5.0 Hangar storage restructure (prerequisite)
- Seed (`scripts/data/*` hangar seed + `data/seed/properties.json`): regular `hangar`
  rows get `capacity: 20`; remove their `hangar-<loc>-storage` upgrade objects.
- Live DB one-off: set `capacity = 20` on the 5 `hangar` rows and delete the
  `hangar-%-storage` `property_upgrades` (cascade sets parked aircraft to base via
  `assigned_upgrade_id` null). Mirrors the McKenzie one-off pattern.
- Verify `npm run validate` passes and the property drawer shows the 20 as base
  storage (not an upgrade row).

### 5.1 Migration
`supabase/migrations/0023_add_gta_plus.sql` — add `gta_plus boolean not null default false`
to `profiles`. Apply to hosted DB.

### 5.2 Profile (GTA+ toggle)
- `profile/page.tsx` — also select `gta_plus`, pass to `ProfileForm`.
- `profile-form.tsx` — add a labelled checkbox bound to a `gtaPlus` form field.
- `profile/actions.ts` — extend the zod schema + update to persist `gta_plus`
  (checkbox → boolean).

### 5.3 Boost helper (single source of truth)
- `lib/hangar-boost.ts` (new), pure (no DB) so both layers can use it:
  - `HANGAR_OWNERSHIP_GROUP = "hangar"` — the regular-hangar group.
  - `hangarBoostSlots(ownsMckenzie, gtaPlus)` → `0 | 15 | 20`.
  - `applyHangarBoost({ ownershipGroup, assignedUpgradeId, baseCapacity, ownsMckenzie, gtaPlus })`
    → effective capacity: adds the boost only when `ownershipGroup === "hangar"` AND
    `assignedUpgradeId == null` (base storage of a regular hangar). Otherwise returns
    `baseCapacity` unchanged.

### 5.4 Per-user context
- `lib/hangar-boost.ts` (server side) or a small query helper: given a `userId`,
  return `{ ownsMckenzie: boolean, gtaPlus: boolean }` (two cheap lookups). Call sites
  that already fetch the user/profile reuse those reads where possible.

### 5.5 Enforcement layer
- `lib/capacity.ts` `capacityForStorageLocation(ownedPropertyId, assignedUpgradeId)`:
  in the base-storage branch (`assignedUpgradeId === null`) it already reads the
  property's `capacity`; also select `ownership_group`, and if it's `hangar`, add
  `hangarBoostSlots(ownsMckenzie, gtaPlus)` for the **owning user**. It fetches the
  user's `{ownsMckenzie, gtaPlus}` internally (it has a Supabase client, and the
  owned-property row identifies the user) so call sites stay unchanged. Both
  `assignVehicleStorage` and `assignVehiclesToSubGarage` route through this, so fixing
  it here fixes enforcement everywhere.

### 5.6 Display layer
The owned-property shape comes from `getOwnedPropertiesWithStorage`
(`lib/queries/my-properties.ts`), which sets each row's `base_capacity`. Apply the
boost to the Hangar's `base_capacity` (and the derived `total_cars`/capacity sums) at
this query boundary, so every consumer — `/my-properties` grid, `/my-businesses` grid,
property drawer storage block, wizard hub, dashboard capacity total — shows the boosted
number without each needing its own logic.
- `getOwnedPropertiesWithStorage` takes the user id already; fetch
  `{ownsMckenzie, gtaPlus}` once and, for rows with `ownership_group === "hangar"`, set
  `base_capacity = applyHangarBoost(...)` in the mapped result.
- Dashboard capacity total (`dashboard/page.tsx`) sums `p.base_capacity` plus installed
  upgrade capacities — it consumes the same boosted query, so it's covered
  automatically.
- Property drawer's `baseStorageCars` / base-storage block reads `property.base_capacity`
  — boosted value flows through.

### 5.7 McKenzie presentation
- McKenzie stays an ownable property (already corrected: 0 own storage, $1,475,000,
  `counts_as_garage: false`, no storage upgrade).
- On its card/drawer, show it as an unlock, not storage: a short line like
  "Boosts your Hangar by +15 aircraft (+20 with GTA+)" instead of a "0 / 0 stored"
  capacity row. The capacity-stored line is already hidden when total capacity is 0
  (the grids guard `totalCapacity > 0`), so no "0 aircraft stored" shows — we add the
  informational line for McKenzie specifically (by subtype `mckenzie-hangar`).

---

## 6. Edge cases

- **McKenzie owned, no Hangar:** boost computes against no Hangar Storage upgrade →
  nothing changes. McKenzie still owned + counted in net worth. ✓
- **Hangar owned, no McKenzie:** boost = 0 → Hangar stays 20. ✓
- **GTA+ toggled while owning both:** 35 ↔ 40 everywhere on next render
  (`updateProfileAction` already `revalidatePath("/", "layout")`). ✓
- **Aircraft already parked beyond a reduced cap:** if a user turns GTA+ off (40 → 35)
  while holding 38 aircraft, display shows 38/35. We do NOT auto-evict. Enforcement only
  blocks *new* assignments while over; this matches existing over-capacity tolerance
  (the codebase already shows e.g. trade-in over-cap states). No special handling.
- **Only one Hangar is ownable**, so "which hangar gets boosted" is unambiguous.

---

## 7. Testing / verification

No unit-test runner exists in this repo (verification = `npm run typecheck`,
`npm run build`, `npm run validate`, and manual checks). The boost helper
(`lib/hangar-boost.ts`) is pure and simple; verify by:
- `npm run typecheck` + `npm run build` clean.
- Manual: with a Hangar owned, toggle McKenzie ownership and GTA+, confirm the Hangar
  shows 20 / 35 / 40 across the property drawer, `/my-businesses` card, and dashboard
  capacity — and that parking aircraft is actually allowed up to the shown number
  (enforcement agrees with display).
- Manual: own McKenzie without a Hangar → no capacity anywhere; McKenzie shows the
  "boosts your Hangar" line, not storage.

---

## 8. Out of scope

- Any other cross-property capacity perks (this introduces the pattern but only wires
  the McKenzie→Hangar case).
- Vinewood Club Storage / GTA+ vehicle storage perks.
- Auto-eviction when capacity shrinks below current occupancy.
- A general "derived capacity rule engine" — we keep it to the one documented case via
  a small, focused helper, not a framework (YAGNI).

---

## 9. Open items for implementation

- Confirm all 5 regular-hangar rows use `subtype = "hangar"` / `ownership_group =
  "hangar"` and that only their `hangar-<loc>-storage` upgrade (not Aircraft Workshop)
  is removed in the restructure.
- The hosted DB's `capacity` is a curated column (preserved by import-seed), so the
  Hangar 0→20 base-capacity change and the storage-upgrade deletion are applied to the
  live DB via a one-off script (like the McKenzie fix), in addition to the seed edit.
