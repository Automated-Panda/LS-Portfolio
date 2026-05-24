# Piece 1 — Foundation: Track & Link Owned Cars (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the wizard + multi-instance ownership + storage linking + Phase 4c upgrade UI + trade-in flow + custom tags + `/my-vehicles` upgrade. Makes the app genuinely usable for tracking a real GTA fleet — the foundation Piece 2's organizer will sit on top of.

**Architecture:** Two additive migrations (`0004` storage + custom_tags, `0005` ownership groups). Two reusable drawer components (`PropertyDrawer`, `InstanceDrawer`) and one reusable modal (`VehiclePickerModal`) are shared between the wizard and the always-available `/my-properties` + `/my-vehicles` pages. Vehicle ownership shifts from binary toggle to per-instance rows (schema already supports it). Trade-in flow auto-triggers when a new property purchase pushes a user over the in-game ownership cap; manual un-own uses the same car-relocation primitive.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Supabase (hosted, MCP plugin) · Zod · shadcn/ui · Tailwind · sonner · lucide-react

**Verification approach (project-specific):** This project has no automated test framework — Phases 0–4b relied on `npm run typecheck`, `npm run validate`, MCP `execute_sql` for row counts, and manual browser smoke-tests on `localhost:3000`. **Do not introduce a test framework as part of this work.** Every task in this plan ends with either a typecheck + manual smoke-test or a `mcp__plugin_supabase_supabase__execute_sql` row-count verification.

**Reference spec:** [`docs/specs/2026-05-24-foundation-track-and-link-cars-design.md`](../specs/2026-05-24-foundation-track-and-link-cars-design.md)

---

## File Structure

**Created:**
- `supabase/migrations/0004_vehicle_storage_and_custom_tags.sql`
- `supabase/migrations/0005_property_ownership_groups.sql`
- `lib/capacity.ts` — `capacityForStorageLocation()` helper (server-side)
- `lib/queries/wizard.ts` — wizard-completion check + hub data
- `lib/queries/my-properties.ts` — owned properties + nested upgrades + car-count
- `lib/queries/my-vehicles.ts` — owned vehicle *instances* with joined storage + tags
- `lib/queries/ownership.ts` — `getOwnershipGroupStatus()` for trade-in trigger
- `app/(app)/my-properties/actions.ts` — `toggleUpgradeInstalled()`
- `app/(app)/my-vehicles/actions.ts` — `assignVehicleStorage()`, `assignVehiclesToSubGarage()`, `updateVehicleInstance()`, `removeVehicleInstance()`
- `app/(app)/wizard/page.tsx` — onboarding entry route
- `app/(app)/wizard/onboarding-wizard.tsx` — client state machine
- `app/(app)/wizard/property-hub-list.tsx`
- `components/portfolio/property-drawer.tsx` — shared drawer (wizard + /my-properties)
- `components/portfolio/vehicle-picker-modal.tsx`
- `components/portfolio/instance-drawer.tsx` — per-vehicle editor
- `components/portfolio/trade-in-modal.tsx`
- `components/portfolio/custom-tags-input.tsx`
- `components/portfolio/location-filter.tsx`
- `app/(app)/my-vehicles/my-vehicles-grid.tsx`
- `app/(app)/my-vehicles/my-vehicles-table.tsx`
- `app/(app)/my-vehicles/unassigned-banner.tsx`
- `app/(app)/my-properties/my-properties-grid.tsx`
- `app/(app)/my-properties/empty-state.tsx`

**Modified:**
- `supabase/migrations/0001_init.sql` (read-only reference — DO NOT EDIT; semantics evolved by 0004/0005)
- `app/(app)/properties/actions.ts` — extend `togglePropertyOwnership()` for trade-in detection, add `tradeInProperty()`, `unownProperty()`
- `app/(app)/vehicles/actions.ts` — rename `toggleVehicleOwnership()` → `addVehicleInstance()` and remove the delete branch (delete moves to `removeVehicleInstance` in my-vehicles)
- `app/(app)/vehicles/vehicle-card.tsx` — `Owned ×N` chip, "+ Add to portfolio" semantics (no longer a toggle)
- `app/(app)/vehicles/vehicles-browser.tsx` — accept optional `selectionMode` prop for wizard usage
- `app/(app)/properties/properties-browser.tsx` — accept optional `selectionMode` prop
- `app/(app)/my-vehicles/page.tsx` — full rewrite, wired to new components
- `app/(app)/my-properties/page.tsx` — stub → real implementation
- `app/(app)/properties/property-card.tsx` — handle trade-in modal trigger from `togglePropertyOwnership` response
- `app/(app)/layout.tsx` — wizard-redirect check for first-login users
- `lib/queries/vehicles.ts` — `getOwnedCounts()` updated to count *instances* not vehicles
- `lib/vehicles.ts` — `VehicleSummary` adds `owned_count: number`
- `scripts/data/*-seed.ts` (apartments + standalone garages + nightclubs + etc.) — already define `subtype`; ownership_group is derived in the migration's UPDATE step, no seed change required
- `scripts/build-properties.ts` — no change (ownership_group is migration-derived)
- `docs/plan.md` — Phase 5 entry for "Piece 1 foundation landed"

---

## Pre-flight checks

Before starting, confirm with James:

- [ ] He's OK with the hosted DB schema mutation (0004 + 0005 will run via MCP plugin).
- [ ] `.env.local` is currently pointing at **hosted** Supabase (default per memory).
- [ ] Working tree is clean (`git status`).
- [ ] Branch strategy: implement on `main` directly (matches prior phases' workflow) unless James requests a feature branch.

---

## Task 1: Migration 0004 — vehicle storage link + custom tags

**Files:**
- Create: `supabase/migrations/0004_vehicle_storage_and_custom_tags.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Piece 1: vehicle storage link to property + custom tags per instance.

-- 1. Link each owned vehicle to a specific owned property (nullable).
--    Denormalised alongside the existing assigned_upgrade_id so queries
--    can reach the parent property without joining through property_upgrades.
alter table public.user_owned_vehicles
  add column if not exists stored_in_property_id uuid
    references public.user_owned_properties(id) on delete set null;

create index if not exists user_owned_vehicles_stored_property_idx
  on public.user_owned_vehicles(stored_in_property_id);

-- 2. Custom user-defined tags on each owned vehicle instance.
--    text[] keeps schema flat; GIN index makes filter queries cheap.
alter table public.user_owned_vehicles
  add column if not exists custom_tags text[] not null default '{}';

create index if not exists user_owned_vehicles_custom_tags_idx
  on public.user_owned_vehicles using gin(custom_tags);
```

- [ ] **Step 2: Apply via MCP plugin**

Use `mcp__plugin_supabase_supabase__apply_migration` with name `0004_vehicle_storage_and_custom_tags` and the SQL body above.

- [ ] **Step 3: Verify columns exist**

Use `mcp__plugin_supabase_supabase__execute_sql`:

```sql
select column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_name = 'user_owned_vehicles'
  and column_name in ('stored_in_property_id', 'custom_tags');
```

Expected: 2 rows. `stored_in_property_id` is `uuid` nullable; `custom_tags` is `ARRAY` NOT NULL with default `'{}'`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0004_vehicle_storage_and_custom_tags.sql
git commit -m "Phase 5: migration 0004 — vehicle storage link + custom_tags"
```

---

## Task 2: Migration 0005 — ownership groups + limits table

**Files:**
- Create: `supabase/migrations/0005_property_ownership_groups.sql`

- [ ] **Step 1: Write the migration SQL**

```sql
-- Piece 1: per-subtype ownership caps + group pooling.
-- Apartments + stand-alone garages share a 10-property cap post-Criminal
-- Enterprises (1.61). Specialist businesses cap at 1 each.

alter table public.properties
  add column if not exists ownership_group text;

-- Backfill: every property's group defaults to its subtype.
update public.properties set ownership_group = subtype where ownership_group is null;

-- Then collapse apartments + standalone garages into the residential pool.
-- Stilt houses are tagged subtype='high-end-apartment' (per Vinewood Hills
-- neighborhood) in the seed, so they're covered by that bucket.
update public.properties
  set ownership_group = 'residential'
  where subtype in (
    'high-end-apartment', 'mid-end-apartment', 'low-end-apartment',
    'stand-alone-garage'
  );

alter table public.properties
  alter column ownership_group set not null;

create index if not exists properties_ownership_group_idx
  on public.properties(ownership_group);

create table if not exists public.property_ownership_limits (
  ownership_group text primary key,
  max_owned       int not null check (max_owned > 0)
);

-- Eclipse Blvd Garage: no row inserted; server treats "no row" as unlimited.

insert into public.property_ownership_limits (ownership_group, max_owned) values
  ('residential',              10),
  ('casino-penthouse',          1),
  ('nightclub',                 1),
  ('ceo-office',                1),
  ('mc-clubhouse',              1),
  ('bunker',                    1),
  ('hangar',                    1),
  ('facility',                  1),
  ('arcade',                    1),
  ('auto-shop',                 1),  -- verify
  ('agency',                    1),  -- verify
  ('salvage-yard',              1),  -- verify
  ('vehicle-warehouse',         1),
  ('super-yacht',               1),
  ('biker-business-coke',       1),
  ('biker-business-meth',       1),
  ('biker-business-weed',       1),
  ('biker-business-cash',       1),
  ('biker-business-forgery',    1)
on conflict (ownership_group) do nothing;

-- Reference table: readable by everyone, writable by service role.
alter table public.property_ownership_limits enable row level security;

create policy "Ownership limits are readable by everyone"
  on public.property_ownership_limits for select using (true);
```

- [ ] **Step 2: Apply via MCP plugin**

Use `mcp__plugin_supabase_supabase__apply_migration` with name `0005_property_ownership_groups`.

- [ ] **Step 3: Verify ownership_group backfill**

```sql
select ownership_group, count(*) as n
from public.properties
group by ownership_group
order by n desc;
```

Expected: a row for `residential` (apartments + stand-alone garages combined: 40 high-end apt + 13 mid + 10 low + 27 standalone = ~90), then one row per business subtype, etc.

- [ ] **Step 4: Verify limits row count**

```sql
select count(*) from public.property_ownership_limits;
```

Expected: 19 rows.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0005_property_ownership_groups.sql
git commit -m "Phase 5: migration 0005 — property ownership groups + per-group limits"
```

---

## Task 3: Verify-flag research (auto-shop, agency, salvage-yard)

**Why this task:** The spec flags 3 ownership-limit rows as "verify" because primary sources were ambiguous. Confirming now is cheaper than discovering later that the trade-in flow blocks a legal purchase.

- [ ] **Step 1: Dispatch a focused subagent**

Use the `Agent` tool with `subagent_type=general-purpose`. Prompt:

> Research GTA Online ownership limits, May 2026 current, for these property types: (1) Auto Shop (Los Santos Tuners DLC), (2) The Agency (Contract DLC), (3) Salvage Yard (San Andreas Mercenaries DLC). For each: can a player own more than one simultaneously? Use Fandom, gtabase, Sportskeeda, Rockstar Support. Cite sources. Report in under 200 words: a verdict per property + confidence + the strongest source link.

- [ ] **Step 2: Update migration 0005 if any verdict differs from "1 max"**

If the subagent says (for example) Salvage Yards allow 3 owned simultaneously, write an idempotent fixup migration `0006_fixup_ownership_limits.sql`:

```sql
update public.property_ownership_limits
  set max_owned = 3
  where ownership_group = 'salvage-yard';
```

Apply via MCP. If all three subagent verdicts are "1 max", **no fixup migration needed** — just remove the `-- verify` comments in the spec's GTA-limits table (separate task; do at end during plan.md update).

- [ ] **Step 3: Record findings in plan.md "Where we left off" section** (this happens in Task 23).

---

## Task 4: Capacity helper

**Files:**
- Create: `lib/capacity.ts`

**Purpose:** Single source of truth for "how many cars fit in this storage location?" Handles both bare-property (apartment / standalone garage) and upgrade-stacked (nightclub sub-garage) cases. Called server-side by every assignment action.

- [ ] **Step 1: Write the helper**

```ts
// lib/capacity.ts
import { createClient } from "@/lib/supabase/server";

/**
 * Returns the maximum number of vehicles that can be stored at the given
 * location. assignedUpgradeId === null means storage is the bare property
 * (e.g. apartment, standalone garage). Otherwise capacity is the upgrade's
 * own capacity column.
 */
export async function capacityForStorageLocation(
  ownedPropertyId: string,
  assignedUpgradeId: string | null,
): Promise<number> {
  const supabase = await createClient();

  if (assignedUpgradeId === null) {
    const { data, error } = await supabase
      .from("user_owned_properties")
      .select("properties!inner(capacity)")
      .eq("id", ownedPropertyId)
      .maybeSingle();

    if (error) throw error;
    const p = Array.isArray(data?.properties)
      ? data?.properties[0]
      : data?.properties;
    return p?.capacity ?? 0;
  }

  const { data, error } = await supabase
    .from("property_upgrades")
    .select("capacity")
    .eq("id", assignedUpgradeId)
    .maybeSingle();

  if (error) throw error;
  return data?.capacity ?? 0;
}

/**
 * Returns current car count at a storage location (for unassigned-check before
 * assignVehicleStorage).
 */
export async function currentCarCountAt(
  ownedPropertyId: string,
  assignedUpgradeId: string | null,
): Promise<number> {
  const supabase = await createClient();

  const q = supabase
    .from("user_owned_vehicles")
    .select("id", { count: "exact", head: true })
    .eq("stored_in_property_id", ownedPropertyId);

  const { count, error } =
    assignedUpgradeId === null
      ? await q.is("assigned_upgrade_id", null)
      : await q.eq("assigned_upgrade_id", assignedUpgradeId);

  if (error) throw error;
  return count ?? 0;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/capacity.ts
git commit -m "Phase 5: lib/capacity.ts — slot accounting for storage locations"
```

---

## Task 5: Query — `lib/queries/wizard.ts`

**Files:**
- Create: `lib/queries/wizard.ts`

**Purpose:** Computes wizard-completion status (no `wizard_state` table — derived from owned data). Used by `(app)/layout.tsx` to gate the redirect.

- [ ] **Step 1: Write the query**

```ts
// lib/queries/wizard.ts
import { createClient } from "@/lib/supabase/server";

/**
 * Wizard is "complete" when the user owns ≥1 property AND has ≥1 vehicle
 * instance linked to storage. Both bars must be cleared.
 */
export async function isWizardCompleted(userId: string): Promise<boolean> {
  const supabase = await createClient();

  const [{ count: propCount }, { count: vehCount }] = await Promise.all([
    supabase
      .from("user_owned_properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId),
    supabase
      .from("user_owned_vehicles")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("stored_in_property_id", "is", null),
  ]);

  return (propCount ?? 0) >= 1 && (vehCount ?? 0) >= 1;
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add lib/queries/wizard.ts
git commit -m "Phase 5: lib/queries/wizard.ts — derived completion check"
```

---

## Task 6: Query — `lib/queries/my-properties.ts`

**Files:**
- Create: `lib/queries/my-properties.ts`

**Purpose:** Powers `/my-properties` cards (status overlay + car-count) and the `PropertyDrawer` (full upgrade tree + per-sub-garage car counts). One round-trip with joins.

- [ ] **Step 1: Write the query**

```ts
// lib/queries/my-properties.ts
import { createClient } from "@/lib/supabase/server";

export type OwnedPropertyDetail = {
  id: string;                 // user_owned_properties.id (uuid)
  property_id: string;        // properties.id (text)
  display_name: string;
  subtype: string;
  subtype_display: string;
  neighborhood: string | null;
  image_path: string | null;
  base_capacity: number;
  ownership_group: string;
  total_upgrades: number;
  installed_upgrades: number;
  total_cars: number;         // sum across base + all sub-garages
  upgrades: Array<{
    id: string;
    display_name: string;
    capacity: number;
    required_upgrade_id: string | null;
    sort_order: number;
    is_installed: boolean;
    cars_here: number;        // only meaningful for storage-capacity upgrades
  }>;
};

export async function getOwnedPropertiesWithStorage(
  userId: string,
): Promise<OwnedPropertyDetail[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_owned_properties")
    .select(`
      id,
      property_id,
      properties!inner (
        display_name, subtype, subtype_display, neighborhood, image_path,
        capacity, ownership_group,
        property_upgrades ( id, display_name, capacity, required_upgrade_id, sort_order )
      ),
      user_owned_property_upgrades ( property_upgrade_id ),
      user_owned_vehicles!stored_in_property_id (
        id, assigned_upgrade_id
      )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  type Row = NonNullable<typeof data>[number];

  return (data ?? []).map((row: Row) => {
    const p = Array.isArray(row.properties) ? row.properties[0] : row.properties;
    const allUpgrades = (p?.property_upgrades ?? []) as Array<{
      id: string; display_name: string; capacity: number;
      required_upgrade_id: string | null; sort_order: number;
    }>;
    const installedIds = new Set(
      (row.user_owned_property_upgrades ?? []).map(
        (u: { property_upgrade_id: string }) => u.property_upgrade_id,
      ),
    );
    const cars = (row.user_owned_vehicles ?? []) as Array<{
      id: string; assigned_upgrade_id: string | null;
    }>;
    const carsByUpgrade = new Map<string | null, number>();
    for (const c of cars) {
      carsByUpgrade.set(
        c.assigned_upgrade_id,
        (carsByUpgrade.get(c.assigned_upgrade_id) ?? 0) + 1,
      );
    }

    return {
      id: row.id,
      property_id: row.property_id,
      display_name: p?.display_name ?? "",
      subtype: p?.subtype ?? "",
      subtype_display: p?.subtype_display ?? "",
      neighborhood: p?.neighborhood ?? null,
      image_path: p?.image_path ?? null,
      base_capacity: p?.capacity ?? 0,
      ownership_group: p?.ownership_group ?? "",
      total_upgrades: allUpgrades.length,
      installed_upgrades: allUpgrades.filter((u) => installedIds.has(u.id))
        .length,
      total_cars: cars.length,
      upgrades: allUpgrades
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((u) => ({
          ...u,
          is_installed: installedIds.has(u.id),
          cars_here: carsByUpgrade.get(u.id) ?? 0,
        })),
    };
  });
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add lib/queries/my-properties.ts
git commit -m "Phase 5: lib/queries/my-properties.ts — owned properties with nested upgrades + car counts"
```

---

## Task 7: Query — rewrite `lib/queries/my-vehicles.ts` (instance-based)

**Files:**
- Create: `lib/queries/my-vehicles.ts` (does not exist today — existing /my-vehicles re-uses `getVehiclesBrowserData`)
- Modify: `lib/vehicles.ts` (add `owned_count` to summary type)

- [ ] **Step 1: Add `owned_count` to `VehicleSummary`**

In `lib/vehicles.ts`, find the `VehicleSummary` type and add:

```ts
export type VehicleSummary = {
  // ... existing fields ...
  owned_count: number;        // 0 if user owns no instances, N if N instances
};
```

- [ ] **Step 2: Update `getVehiclesBrowserData` to populate `owned_count`**

In `lib/queries/vehicles.ts`, after the existing `ownedSet`:

```ts
const ownedCount = new Map<string, number>();
for (const r of ownedRows ?? []) {
  ownedCount.set(r.vehicle_id, (ownedCount.get(r.vehicle_id) ?? 0) + 1);
}
```

Then in the `.map(...)` that builds `vehicles`, populate `owned_count: ownedCount.get(v.id) ?? 0`.

Also update the existing drift collapse: `drift_variant.owned` becomes implied — if the drift variant has any instances, `owned_count` covers it. The `drift_variant` field stays as `{ id, owned: boolean }` for backward-compat with VehicleCard's drift sub-toggle logic (Task 13 refactors VehicleCard).

- [ ] **Step 3: Create `lib/queries/my-vehicles.ts`**

```ts
// lib/queries/my-vehicles.ts
import { createClient } from "@/lib/supabase/server";
import { formatClass } from "@/lib/vehicles";

export type OwnedVehicleInstance = {
  id: string;                            // user_owned_vehicles.id (uuid)
  vehicle_id: string;
  display_name: string;
  class: string;
  manufacturer_display: string;
  image_path: string | null;
  nickname: string | null;
  notes: string | null;
  custom_tags: string[];
  tag_ids: string[];                     // system tags from vehicle_tag_links
  storage: {
    owned_property_id: string;
    property_display_name: string;
    property_subtype_display: string;
    assigned_upgrade_id: string | null;
    upgrade_display_name: string | null;
  } | null;
};

export async function getOwnedVehicleInstances(
  userId: string,
): Promise<OwnedVehicleInstance[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("user_owned_vehicles")
    .select(`
      id, vehicle_id, nickname, notes, custom_tags,
      stored_in_property_id, assigned_upgrade_id,
      vehicles!inner (
        display_name, class, image_path, manufacturer_id,
        manufacturers ( display ),
        vehicle_tag_links ( tag_id )
      ),
      user_owned_properties!stored_in_property_id (
        properties!inner ( display_name, subtype_display )
      ),
      property_upgrades!assigned_upgrade_id ( display_name )
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  type Row = NonNullable<typeof data>[number];

  return (data ?? []).map((row: Row) => {
    const v = Array.isArray(row.vehicles) ? row.vehicles[0] : row.vehicles;
    const mfr = Array.isArray(v?.manufacturers)
      ? v?.manufacturers[0]
      : v?.manufacturers;
    const op = Array.isArray(row.user_owned_properties)
      ? row.user_owned_properties[0]
      : row.user_owned_properties;
    const opP = op
      ? Array.isArray(op.properties)
        ? op.properties[0]
        : op.properties
      : null;
    const up = Array.isArray(row.property_upgrades)
      ? row.property_upgrades[0]
      : row.property_upgrades;

    return {
      id: row.id,
      vehicle_id: row.vehicle_id,
      display_name: v?.display_name ?? "",
      class: formatClass(v?.class ?? ""),
      manufacturer_display: mfr?.display ?? "",
      image_path: v?.image_path ?? null,
      nickname: row.nickname,
      notes: row.notes,
      custom_tags: row.custom_tags ?? [],
      tag_ids: (v?.vehicle_tag_links ?? []).map(
        (l: { tag_id: string }) => l.tag_id,
      ),
      storage: row.stored_in_property_id
        ? {
            owned_property_id: row.stored_in_property_id,
            property_display_name: opP?.display_name ?? "",
            property_subtype_display: opP?.subtype_display ?? "",
            assigned_upgrade_id: row.assigned_upgrade_id,
            upgrade_display_name: up?.display_name ?? null,
          }
        : null,
    };
  });
}
```

- [ ] **Step 4: Update `getOwnedCounts` to count INSTANCES, not unique vehicles**

In `lib/queries/vehicles.ts`, the existing `getOwnedCounts` already uses `count: "exact", head: true` against `user_owned_vehicles` which counts rows — that's already instance-based. ✅ No change required. Add a code comment:

```ts
// Counts user_owned_vehicles rows = instance count (multi-instance aware).
```

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add lib/vehicles.ts lib/queries/vehicles.ts lib/queries/my-vehicles.ts
git commit -m "Phase 5: instance-based my-vehicles query + owned_count on VehicleSummary"
```

---

## Task 8: Query — `lib/queries/ownership.ts`

**Files:**
- Create: `lib/queries/ownership.ts`

**Purpose:** Used by `togglePropertyOwnership` to detect when a trade-in modal is needed.

- [ ] **Step 1: Write the query**

```ts
// lib/queries/ownership.ts
import { createClient } from "@/lib/supabase/server";

export type OwnershipGroupStatus = {
  group: string;
  max: number | null;             // null = unlimited (no row in limits table)
  ownedCount: number;
  atLimit: boolean;
};

export async function getOwnershipGroupStatus(
  userId: string,
  ownershipGroup: string,
): Promise<OwnershipGroupStatus> {
  const supabase = await createClient();

  const [{ data: limit }, { data: owned, error }] = await Promise.all([
    supabase
      .from("property_ownership_limits")
      .select("max_owned")
      .eq("ownership_group", ownershipGroup)
      .maybeSingle(),
    supabase
      .from("user_owned_properties")
      .select("id, properties!inner(ownership_group)")
      .eq("user_id", userId)
      .eq("properties.ownership_group", ownershipGroup),
  ]);

  if (error) throw error;

  const max = limit?.max_owned ?? null;
  const ownedCount = (owned ?? []).length;

  return {
    group: ownershipGroup,
    max,
    ownedCount,
    atLimit: max !== null && ownedCount >= max,
  };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add lib/queries/ownership.ts
git commit -m "Phase 5: lib/queries/ownership.ts — group-status helper for trade-in detection"
```

---

## Task 9: Refactor `vehicles/actions.ts` → `addVehicleInstance`

**Files:**
- Modify: `app/(app)/vehicles/actions.ts`

**Semantic shift:** `toggleVehicleOwnership` was a binary toggle. We replace it with `addVehicleInstance` (always +1). Removal moves to `removeVehicleInstance` in `/my-vehicles/actions.ts` (Task 12).

- [ ] **Step 1: Replace file contents**

```ts
"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type AddInstanceResult = {
  vehicleId: string;
  createdInstanceId?: string;
  error?: string;
};

export async function addVehicleInstance(
  vehicleId: string,
): Promise<AddInstanceResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { vehicleId, error: "Not signed in." };
  }

  const { data, error } = await supabase
    .from("user_owned_vehicles")
    .insert({ user_id: user.id, vehicle_id: vehicleId })
    .select("id")
    .single();

  if (error) return { vehicleId, error: error.message };

  revalidatePath("/", "layout");
  return { vehicleId, createdInstanceId: data.id };
}
```

- [ ] **Step 2: Update VehicleCard import (Task 13 handles full refactor; this just keeps typecheck clean)**

In `app/(app)/vehicles/vehicle-card.tsx` line 12: change
```ts
import { toggleVehicleOwnership } from "./actions";
```
to
```ts
import { addVehicleInstance } from "./actions";
```

The VehicleCard usage will be temporarily broken (TS errors). That's expected — Task 13 fixes it. To unblock the typecheck for THIS commit, temporarily rename the local function call:

```ts
// Around line 33
const result = await addVehicleInstance(vehicle.id);
if (result.error) {
  setOptimisticOwned(!nextState);
  toast.error(result.error);
} else {
  setOptimisticOwned(true);   // always true after add — Task 13 fixes the model
}
```

(Same change for the drift handler around line 50.)

- [ ] **Step 3: Typecheck + commit**

```bash
npm run typecheck
git add app/(app)/vehicles/actions.ts app/(app)/vehicles/vehicle-card.tsx
git commit -m "Phase 5: vehicles/actions — addVehicleInstance (binary toggle removed)"
```

---

## Task 10: Server actions — trade-in + un-own in `properties/actions.ts`

**Files:**
- Modify: `app/(app)/properties/actions.ts`

- [ ] **Step 1: Replace the file**

```ts
"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { getOwnershipGroupStatus } from "@/lib/queries/ownership";

export type ToggleResult =
  | { ok: true; ownedPropertyId: string }
  | { ok: false; removed: true }
  | {
      needsTradeIn: {
        group: string;
        currentlyOwned: Array<{ id: string; display_name: string; car_count: number }>;
        newProperty: { id: string; display_name: string; capacity: number };
      };
    }
  | { error: string };

export async function togglePropertyOwnership(
  propertyId: string,
): Promise<ToggleResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Already owned → un-own (no car relocation here; this path is for the
  // /properties browse "Owned" toggle on a property that's the sole owned in
  // its group. Cars get cleared via ON DELETE SET NULL).
  const { data: existing } = await supabase
    .from("user_owned_properties")
    .select("id")
    .eq("user_id", user.id)
    .eq("property_id", propertyId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("user_owned_properties")
      .delete()
      .eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: false, removed: true };
  }

  // Look up the new property's ownership_group + capacity.
  const { data: prop, error: propErr } = await supabase
    .from("properties")
    .select("display_name, capacity, ownership_group")
    .eq("id", propertyId)
    .single();
  if (propErr || !prop) return { error: propErr?.message ?? "Property not found." };

  const status = await getOwnershipGroupStatus(user.id, prop.ownership_group);

  if (status.atLimit) {
    // Fetch current owned in this group with car counts.
    const { data: rows, error: rowErr } = await supabase
      .from("user_owned_properties")
      .select(`
        id,
        properties!inner ( display_name, ownership_group ),
        user_owned_vehicles!stored_in_property_id ( id )
      `)
      .eq("user_id", user.id)
      .eq("properties.ownership_group", prop.ownership_group);
    if (rowErr) return { error: rowErr.message };

    type Row = NonNullable<typeof rows>[number];
    const currentlyOwned = (rows ?? []).map((r: Row) => {
      const p = Array.isArray(r.properties) ? r.properties[0] : r.properties;
      return {
        id: r.id,
        display_name: p?.display_name ?? "",
        car_count: (r.user_owned_vehicles ?? []).length,
      };
    });

    return {
      needsTradeIn: {
        group: prop.ownership_group,
        currentlyOwned,
        newProperty: {
          id: propertyId,
          display_name: prop.display_name,
          capacity: prop.capacity,
        },
      },
    };
  }

  // Under limit → insert directly.
  const { data, error } = await supabase
    .from("user_owned_properties")
    .insert({ user_id: user.id, property_id: propertyId })
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, ownedPropertyId: data.id };
}

export type TradeInArgs = {
  newPropertyId: string;
  tradeInOwnedPropertyId: string;
  carDestinations: Array<{
    ownedVehicleId: string;
    action: "move" | "unassign";
  }>;
};

export async function tradeInProperty(
  args: TradeInArgs,
): Promise<{ ok: true; newOwnedPropertyId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // 1. Insert new owned property row.
  const { data: newRow, error: newErr } = await supabase
    .from("user_owned_properties")
    .insert({ user_id: user.id, property_id: args.newPropertyId })
    .select("id")
    .single();
  if (newErr) return { error: newErr.message };

  // 2. Move-or-unassign each car.
  for (const dest of args.carDestinations) {
    const patch =
      dest.action === "move"
        ? { stored_in_property_id: newRow.id, assigned_upgrade_id: null }
        : { stored_in_property_id: null, assigned_upgrade_id: null };
    const { error } = await supabase
      .from("user_owned_vehicles")
      .update(patch)
      .eq("id", dest.ownedVehicleId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  }

  // 3. Delete the traded-in owned property (cars are already moved).
  const { error: delErr } = await supabase
    .from("user_owned_properties")
    .delete()
    .eq("id", args.tradeInOwnedPropertyId)
    .eq("user_id", user.id);
  if (delErr) return { error: delErr.message };

  revalidatePath("/", "layout");
  return { ok: true, newOwnedPropertyId: newRow.id };
}

export type UnownArgs = {
  ownedPropertyId: string;
  carDestinations: Array<{
    ownedVehicleId: string;
    destinationPropertyId: string | null; // null = unassign
  }>;
};

export async function unownProperty(
  args: UnownArgs,
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  for (const dest of args.carDestinations) {
    const patch =
      dest.destinationPropertyId === null
        ? { stored_in_property_id: null, assigned_upgrade_id: null }
        : { stored_in_property_id: dest.destinationPropertyId, assigned_upgrade_id: null };
    const { error } = await supabase
      .from("user_owned_vehicles")
      .update(patch)
      .eq("id", dest.ownedVehicleId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  }

  const { error: delErr } = await supabase
    .from("user_owned_properties")
    .delete()
    .eq("id", args.ownedPropertyId)
    .eq("user_id", user.id);
  if (delErr) return { error: delErr.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck**

`npm run typecheck` — property-card.tsx may fail because the result shape changed. Patch property-card.tsx (around the existing `togglePropertyOwnership` caller — find the `if (result.error)` block):

```tsx
const result = await togglePropertyOwnership(property.id);
if ("error" in result && result.error) {
  setOptimisticOwned(!nextState);
  toast.error(result.error);
} else if ("needsTradeIn" in result) {
  // Task 18 wires the TradeInModal here.
  setOptimisticOwned(false);
  toast.info("At ownership limit — trade-in modal coming in a moment.");
} else if ("removed" in result) {
  setOptimisticOwned(false);
} else if ("ok" in result) {
  setOptimisticOwned(true);
}
```

(The `needsTradeIn` branch gets the real wiring in Task 18.)

- [ ] **Step 3: Commit**

```bash
git add app/(app)/properties/actions.ts app/(app)/properties/property-card.tsx
git commit -m "Phase 5: properties/actions — trade-in detection + tradeInProperty + unownProperty"
```

---

## Task 11: Server action — `my-properties/actions.ts`

**Files:**
- Create: `app/(app)/my-properties/actions.ts`

- [ ] **Step 1: Write the file**

```ts
"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type ToggleUpgradeResult =
  | { ok: true; installed: boolean }
  | { error: string };

export async function toggleUpgradeInstalled(
  ownedPropertyId: string,
  upgradeId: string,
): Promise<ToggleUpgradeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Verify the user owns this property (RLS would also catch this).
  const { data: ownership, error: ownErr } = await supabase
    .from("user_owned_properties")
    .select("id")
    .eq("id", ownedPropertyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (ownErr || !ownership) return { error: "Property not owned." };

  // Existing installation?
  const { data: existing } = await supabase
    .from("user_owned_property_upgrades")
    .select("id")
    .eq("user_owned_property_id", ownedPropertyId)
    .eq("property_upgrade_id", upgradeId)
    .maybeSingle();

  if (existing) {
    // Uninstall — but only if no dependent upgrades are installed.
    const { data: dependents } = await supabase
      .from("property_upgrades")
      .select("id, user_owned_property_upgrades!inner(id)")
      .eq("required_upgrade_id", upgradeId)
      .eq("user_owned_property_upgrades.user_owned_property_id", ownedPropertyId);
    if ((dependents ?? []).length > 0) {
      return {
        error: "Uninstall the dependent upgrades first.",
      };
    }
    const { error } = await supabase
      .from("user_owned_property_upgrades")
      .delete()
      .eq("id", existing.id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: true, installed: false };
  }

  // Install — verify prereq.
  const { data: upgrade } = await supabase
    .from("property_upgrades")
    .select("required_upgrade_id")
    .eq("id", upgradeId)
    .maybeSingle();
  if (upgrade?.required_upgrade_id) {
    const { data: hasParent } = await supabase
      .from("user_owned_property_upgrades")
      .select("id")
      .eq("user_owned_property_id", ownedPropertyId)
      .eq("property_upgrade_id", upgrade.required_upgrade_id)
      .maybeSingle();
    if (!hasParent) {
      return { error: "Install the required upgrade first." };
    }
  }

  const { error } = await supabase
    .from("user_owned_property_upgrades")
    .insert({
      user_owned_property_id: ownedPropertyId,
      property_upgrade_id: upgradeId,
    });
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true, installed: true };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add app/(app)/my-properties/actions.ts
git commit -m "Phase 5: my-properties/actions — toggleUpgradeInstalled with prereq enforcement"
```

---

## Task 12: Server action — `my-vehicles/actions.ts`

**Files:**
- Create: `app/(app)/my-vehicles/actions.ts`

- [ ] **Step 1: Write the file**

```ts
"use server";

import { revalidatePath } from "next/cache";

import {
  capacityForStorageLocation,
  currentCarCountAt,
} from "@/lib/capacity";
import { createClient } from "@/lib/supabase/server";

type Result<T = {}> = ({ ok: true } & T) | { error: string };

export async function assignVehicleStorage(opts: {
  ownedVehicleId: string;
  ownedPropertyId: string | null;
  assignedUpgradeId: string | null;
}): Promise<Result | { capacityExceeded: { capacity: number; current: number } }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Unassign path
  if (opts.ownedPropertyId === null) {
    const { error } = await supabase
      .from("user_owned_vehicles")
      .update({ stored_in_property_id: null, assigned_upgrade_id: null })
      .eq("id", opts.ownedVehicleId)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
    revalidatePath("/", "layout");
    return { ok: true };
  }

  // Capacity check
  const [capacity, current] = await Promise.all([
    capacityForStorageLocation(opts.ownedPropertyId, opts.assignedUpgradeId),
    currentCarCountAt(opts.ownedPropertyId, opts.assignedUpgradeId),
  ]);
  if (current >= capacity) {
    return { capacityExceeded: { capacity, current } };
  }

  const { error } = await supabase
    .from("user_owned_vehicles")
    .update({
      stored_in_property_id: opts.ownedPropertyId,
      assigned_upgrade_id: opts.assignedUpgradeId,
    })
    .eq("id", opts.ownedVehicleId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function assignVehiclesToSubGarage(opts: {
  ownedPropertyId: string;
  assignedUpgradeId: string | null;
  vehicleIds: string[];
}): Promise<
  | { ok: true; createdInstanceIds: string[] }
  | { capacityExceeded: { capacity: number; wouldBeAfter: number } }
  | { error: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const [capacity, current] = await Promise.all([
    capacityForStorageLocation(opts.ownedPropertyId, opts.assignedUpgradeId),
    currentCarCountAt(opts.ownedPropertyId, opts.assignedUpgradeId),
  ]);
  if (current + opts.vehicleIds.length > capacity) {
    return {
      capacityExceeded: { capacity, wouldBeAfter: current + opts.vehicleIds.length },
    };
  }

  const rows = opts.vehicleIds.map((vid) => ({
    user_id: user.id,
    vehicle_id: vid,
    stored_in_property_id: opts.ownedPropertyId,
    assigned_upgrade_id: opts.assignedUpgradeId,
  }));

  const { data, error } = await supabase
    .from("user_owned_vehicles")
    .insert(rows)
    .select("id");
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true, createdInstanceIds: (data ?? []).map((r) => r.id) };
}

export async function updateVehicleInstance(opts: {
  ownedVehicleId: string;
  nickname?: string | null;
  notes?: string | null;
  customTags?: string[];
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const patch: Record<string, unknown> = {};
  if (opts.nickname !== undefined) patch.nickname = opts.nickname;
  if (opts.notes !== undefined) patch.notes = opts.notes;
  if (opts.customTags !== undefined) {
    patch.custom_tags = Array.from(
      new Set(opts.customTags.map((t) => t.trim().toLowerCase()).filter(Boolean)),
    );
  }
  patch.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from("user_owned_vehicles")
    .update(patch)
    .eq("id", opts.ownedVehicleId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function removeVehicleInstance(
  ownedVehicleId: string,
): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("user_owned_vehicles")
    .delete()
    .eq("id", ownedVehicleId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add app/(app)/my-vehicles/actions.ts
git commit -m "Phase 5: my-vehicles/actions — assign/update/remove instance + capacity enforcement"
```

---

## Task 13: VehicleCard refactor — `Owned ×N` chip + Add semantics

**Files:**
- Modify: `app/(app)/vehicles/vehicle-card.tsx`

**Goal:** Replace the binary toggle with "+ Add to portfolio" button. Show an `Owned ×N` chip when `owned_count > 0`. Drift sub-toggle stays but its semantics change: clicking it with the base card calls `addVehicleInstance(driftId)` instead of toggling.

- [ ] **Step 1: Rewrite VehicleCardImpl**

Replace the function body (keep imports + export):

```tsx
function VehicleCardImpl({ vehicle, imageUrl, tagLookup }: Props) {
  const [optimisticCount, setOptimisticCount] = useState(vehicle.owned_count);
  const [isPending, startTransition] = useTransition();
  const [driftCount, setDriftCount] = useState(
    vehicle.drift_variant?.owned ? 1 : 0,  // pre-Piece 1 backward-compat
  );
  const [driftPending, startDriftTransition] = useTransition();

  const handleAdd = () => {
    setOptimisticCount(optimisticCount + 1);
    startTransition(async () => {
      const result = await addVehicleInstance(vehicle.id);
      if (result.error) {
        setOptimisticCount(optimisticCount);
        toast.error(result.error);
      } else {
        toast.success(`Added ${vehicle.display_name}`);
      }
    });
  };

  const handleDriftAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!vehicle.drift_variant) return;
    setDriftCount(driftCount + 1);
    startDriftTransition(async () => {
      const result = await addVehicleInstance(vehicle.drift_variant!.id);
      if (result.error) {
        setDriftCount(driftCount);
        toast.error(result.error);
      } else {
        toast.success(`Added Drift ${vehicle.display_name}`);
      }
    });
  };

  const owned = optimisticCount > 0;

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-all hover:border-foreground/40",
        owned && "border-emerald-500/70 ring-2 ring-emerald-500/30",
        isPending && "opacity-80",
      )}
    >
      <button
        type="button"
        onClick={handleAdd}
        disabled={isPending}
        className="flex flex-1 flex-col text-left"
        aria-label={`Add ${vehicle.display_name} to portfolio`}
      >
        <div
          className={cn(
            "absolute right-2 top-2 z-10 flex h-7 min-w-7 items-center justify-center gap-1 rounded-full px-2 transition-all",
            owned
              ? "bg-emerald-500 text-white"
              : "bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100",
          )}
        >
          {owned ? (
            <>
              <Check className="h-4 w-4" />
              <span className="text-xs font-semibold">×{optimisticCount}</span>
            </>
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </div>

        <div className="relative aspect-video w-full bg-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={vehicle.display_name}
              fill
              sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No image
            </div>
          )}
          <span className="absolute left-2 top-2 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur-sm">
            {vehicle.class}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div>
            <p className="text-sm font-medium leading-tight">{vehicle.display_name}</p>
            <p className="text-xs text-muted-foreground">{vehicle.manufacturer_display}</p>
          </div>
          <div className="mt-auto flex h-[22px] items-center gap-1 overflow-hidden">
            {vehicle.tag_ids.slice(0, 2).map((id) => (
              <Badge key={id} variant="outline" className="shrink-0 text-[10px]">
                {tagLookup[id] ?? id}
              </Badge>
            ))}
            {vehicle.tag_ids.length > 2 && (
              <Badge
                variant="outline"
                className="shrink-0 text-[10px]"
                title={vehicle.tag_ids.slice(2).map((id) => tagLookup[id] ?? id).join(", ")}
              >
                +{vehicle.tag_ids.length - 2}
              </Badge>
            )}
            {vehicle.drift_variant && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleDriftAdd}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleDriftAdd(e as unknown as React.MouseEvent);
                  }
                }}
                className={cn(
                  "ml-auto inline-flex cursor-pointer select-none items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                  driftCount > 0
                    ? "border-emerald-500/70 bg-emerald-500/20 text-emerald-300"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  driftPending && "opacity-60",
                )}
                aria-pressed={driftCount > 0}
                aria-label={`Add Drift ${vehicle.display_name}`}
              >
                {driftCount > 0 ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                Drift{driftCount > 1 ? ` ×${driftCount}` : ""}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
```

Also update the `Props` type at top of file:

```tsx
type Props = {
  vehicle: VehicleSummary;
  imageUrl: string | null;
  tagLookup: Record<string, string>;
};
```

(remove the `owned: boolean` prop — `owned_count` is on `vehicle` now.)

- [ ] **Step 2: Update `VehiclesBrowser` to pass new prop set**

In `app/(app)/vehicles/vehicles-browser.tsx`, find where `<VehicleCard>` is rendered and remove the `owned={...}` prop.

- [ ] **Step 3: Typecheck + smoke-test**

```bash
npm run typecheck
npm run dev
```

Open `http://localhost:3000/vehicles`, click any car. Verify:
- Card flips to green ring, shows `✓ ×1` chip
- Click again → `✓ ×2`
- Drift toggle on a drift-capable car adds drift instances independently
- `/my-vehicles` shows duplicates (one card per instance — Task 20 makes this proper)

- [ ] **Step 4: Commit**

```bash
git add app/(app)/vehicles/vehicle-card.tsx app/(app)/vehicles/vehicles-browser.tsx
git commit -m "Phase 5: VehicleCard — Owned ×N chip + Add semantics for multi-instance"
```

---

## Task 14: Component — `<CustomTagsInput>`

**Files:**
- Create: `components/portfolio/custom-tags-input.tsx`

**MVP:** plain text input, comma-separated. Server normalises. No autocomplete.

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
};

export function CustomTagsInput({ value, onChange, className }: Props) {
  const [draft, setDraft] = useState(value.join(", "));

  const commit = () => {
    const parsed = Array.from(
      new Set(
        draft
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    onChange(parsed);
    setDraft(parsed.join(", "));
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="drift, gymkhana, f1-wheels"
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="border-amber-500/40 text-amber-300"
            >
              {t}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add components/portfolio/custom-tags-input.tsx
git commit -m "Phase 5: CustomTagsInput MVP — comma-separated text input"
```

---

## Task 15: Component — `<InstanceDrawer>`

**Files:**
- Create: `components/portfolio/instance-drawer.tsx`

**Purpose:** Per-vehicle editor. Opened from /my-vehicles card or row click.

- [ ] **Step 1: Install shadcn sheet primitive (if not already present)**

Check `components/ui/sheet.tsx`. If missing:

```bash
npx shadcn@latest add sheet
git add components/ui/sheet.tsx
```

- [ ] **Step 2: Write the drawer**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  removeVehicleInstance,
  updateVehicleInstance,
  assignVehicleStorage,
} from "@/app/(app)/my-vehicles/actions";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

import { CustomTagsInput } from "./custom-tags-input";

type Props = {
  instance: OwnedVehicleInstance;
  ownedProperties: OwnedPropertyDetail[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InstanceDrawer({
  instance,
  ownedProperties,
  open,
  onOpenChange,
}: Props) {
  const [nickname, setNickname] = useState(instance.nickname ?? "");
  const [notes, setNotes] = useState(instance.notes ?? "");
  const [tags, setTags] = useState(instance.custom_tags);
  const [propertyId, setPropertyId] = useState(
    instance.storage?.owned_property_id ?? "",
  );
  const [upgradeId, setUpgradeId] = useState(
    instance.storage?.assigned_upgrade_id ?? "",
  );
  const [isPending, startTransition] = useTransition();

  const selectedProperty = ownedProperties.find((p) => p.id === propertyId);
  const installedUpgrades =
    selectedProperty?.upgrades.filter(
      (u) => u.is_installed && u.capacity > 0,
    ) ?? [];

  const handleSave = () => {
    startTransition(async () => {
      const meta = await updateVehicleInstance({
        ownedVehicleId: instance.id,
        nickname: nickname || null,
        notes: notes || null,
        customTags: tags,
      });
      if ("error" in meta) {
        toast.error(meta.error);
        return;
      }

      const storage = await assignVehicleStorage({
        ownedVehicleId: instance.id,
        ownedPropertyId: propertyId || null,
        assignedUpgradeId: upgradeId || null,
      });
      if ("error" in storage) {
        toast.error(storage.error);
        return;
      }
      if ("capacityExceeded" in storage) {
        toast.error(
          `Full: ${storage.capacityExceeded.current} / ${storage.capacityExceeded.capacity}`,
        );
        return;
      }
      toast.success("Saved");
      onOpenChange(false);
    });
  };

  const handleRemove = () => {
    if (!confirm("Remove this vehicle instance from your portfolio?")) return;
    startTransition(async () => {
      const result = await removeVehicleInstance(instance.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Removed");
      onOpenChange(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{nickname || instance.display_name}</SheetTitle>
          <SheetDescription>
            {instance.manufacturer_display} · {instance.class}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 py-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nickname">Nickname</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="e.g. Pearl Black Banshee"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Storage location</Label>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={propertyId}
              onChange={(e) => {
                setPropertyId(e.target.value);
                setUpgradeId("");
              }}
            >
              <option value="">— Unassigned —</option>
              {ownedProperties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name} ({p.subtype_display})
                </option>
              ))}
            </select>
            {installedUpgrades.length > 0 && (
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={upgradeId}
                onChange={(e) => setUpgradeId(e.target.value)}
              >
                <option value="">Base storage</option>
                {installedUpgrades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name} ({u.capacity})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Label>Custom tags</Label>
            <CustomTagsInput value={tags} onChange={setTags} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="notes">Notes</Label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleSave} disabled={isPending} className="w-full">
            Save changes
          </Button>
          <Button
            variant="outline"
            onClick={handleRemove}
            disabled={isPending}
            className="w-full border-red-500/50 text-red-300 hover:bg-red-500/10"
          >
            Remove this instance
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
npm run typecheck
git add components/portfolio/instance-drawer.tsx components/ui/sheet.tsx
git commit -m "Phase 5: InstanceDrawer — per-vehicle editor with storage + tags + notes"
```

---

## Task 16: Component — `<PropertyDrawer>`

**Files:**
- Create: `components/portfolio/property-drawer.tsx`

**Purpose:** Shared by wizard hub + /my-properties cards. Manages a property's upgrade tree + lists storage locations with car counts. Click a storage row → opens `<VehiclePickerModal>` (Task 17). Includes "Un-own / trade in" button at bottom.

- [ ] **Step 1: Write the drawer**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toggleUpgradeInstalled } from "@/app/(app)/my-properties/actions";
import { unownProperty } from "@/app/(app)/properties/actions";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

import { VehiclePickerModal } from "./vehicle-picker-modal";

type Props = {
  property: OwnedPropertyDetail;
  allOwnedProperties: OwnedPropertyDetail[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PropertyDrawer({
  property,
  allOwnedProperties,
  open,
  onOpenChange,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{
    upgradeId: string | null;
    label: string;
    capacity: number;
    current: number;
  } | null>(null);

  const storageUpgrades = property.upgrades.filter((u) => u.capacity > 0);
  const nonStorageUpgrades = property.upgrades.filter((u) => u.capacity === 0);

  const baseStorageCars = property.total_cars - storageUpgrades
    .filter((u) => u.is_installed)
    .reduce((sum, u) => sum + u.cars_here, 0);

  const handleToggleUpgrade = (upgradeId: string) => {
    startTransition(async () => {
      const r = await toggleUpgradeInstalled(property.id, upgradeId);
      if ("error" in r) toast.error(r.error);
    });
  };

  const handleUnown = () => {
    if (
      !confirm(
        `Remove ${property.display_name} from your portfolio? ${property.total_cars} cars will need to go somewhere.`,
      )
    )
      return;
    // For Piece 1 simplicity, default car destinations: prompt-free unassign.
    // (Full destination-picker UI is the same modal as TradeInModal; reuse opportunity.)
    startTransition(async () => {
      const r = await unownProperty({
        ownedPropertyId: property.id,
        carDestinations: [], // server-side ON DELETE SET NULL handles it
      });
      if ("error" in r) toast.error(r.error);
      else {
        toast.success(`Removed ${property.display_name}`);
        onOpenChange(false);
      }
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{property.display_name}</SheetTitle>
            <SheetDescription>
              {property.subtype_display}
              {property.neighborhood ? ` · ${property.neighborhood}` : ""}
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 py-4">
            {storageUpgrades.length > 0 && (
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Storage upgrades
                </p>
                <div className="flex flex-col gap-1">
                  {storageUpgrades.map((u) => {
                    const prereqMet =
                      !u.required_upgrade_id ||
                      property.upgrades.find((x) => x.id === u.required_upgrade_id)
                        ?.is_installed;
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 rounded-md p-2 hover:bg-muted/50"
                        style={{ opacity: prereqMet ? 1 : 0.5 }}
                      >
                        <input
                          type="checkbox"
                          checked={u.is_installed}
                          disabled={!prereqMet || isPending}
                          onChange={() => handleToggleUpgrade(u.id)}
                        />
                        <span className="text-sm">{u.display_name}</span>
                        <Badge variant="outline" className="ml-auto text-[10px]">
                          {u.capacity}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            {nonStorageUpgrades.length > 0 && (
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Equipment &amp; security
                </p>
                <div className="flex flex-col gap-1">
                  {nonStorageUpgrades.map((u) => {
                    const prereqMet =
                      !u.required_upgrade_id ||
                      property.upgrades.find((x) => x.id === u.required_upgrade_id)
                        ?.is_installed;
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 rounded-md p-2 hover:bg-muted/50"
                        style={{ opacity: prereqMet ? 1 : 0.5 }}
                      >
                        <input
                          type="checkbox"
                          checked={u.is_installed}
                          disabled={!prereqMet || isPending}
                          onChange={() => handleToggleUpgrade(u.id)}
                        />
                        <span className="text-sm">{u.display_name}</span>
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your storage (click to manage cars)
              </p>
              <div className="flex flex-col gap-1">
                {/* Base property storage row (only if it has its own capacity) */}
                {property.base_capacity > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPickerTarget({
                        upgradeId: null,
                        label: "Base storage",
                        capacity: property.base_capacity,
                        current: baseStorageCars,
                      });
                      setPickerOpen(true);
                    }}
                    className="flex items-center justify-between rounded-md border p-3 text-sm hover:border-foreground/40"
                  >
                    <span>{property.subtype_display}</span>
                    <span className="text-muted-foreground">
                      {baseStorageCars} / {property.base_capacity} →
                    </span>
                  </button>
                )}
                {/* Each installed storage upgrade */}
                {storageUpgrades
                  .filter((u) => u.is_installed)
                  .map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setPickerTarget({
                          upgradeId: u.id,
                          label: u.display_name,
                          capacity: u.capacity,
                          current: u.cars_here,
                        });
                        setPickerOpen(true);
                      }}
                      className="flex items-center justify-between rounded-md border p-3 text-sm hover:border-foreground/40"
                    >
                      <span>{u.display_name}</span>
                      <span className="text-muted-foreground">
                        {u.cars_here} / {u.capacity} →
                      </span>
                    </button>
                  ))}
              </div>
            </section>
          </div>

          <SheetFooter>
            <Button
              variant="outline"
              onClick={handleUnown}
              disabled={isPending}
              className="w-full border-red-500/50 text-red-300 hover:bg-red-500/10"
            >
              Un-own / trade in this property
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {pickerTarget && (
        <VehiclePickerModal
          ownedPropertyId={property.id}
          assignedUpgradeId={pickerTarget.upgradeId}
          label={`${property.display_name} · ${pickerTarget.label}`}
          capacity={pickerTarget.capacity}
          currentCount={pickerTarget.current}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
        />
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck** — will fail until Task 17 creates VehiclePickerModal. That's expected — keep moving and commit at end of Task 17.

---

## Task 17: Component — `<VehiclePickerModal>`

**Files:**
- Create: `components/portfolio/vehicle-picker-modal.tsx`

- [ ] **Step 1: Install shadcn dialog primitive (if not present)**

Check `components/ui/dialog.tsx`. If missing: `npx shadcn@latest add dialog`.

- [ ] **Step 2: Write the modal**

```tsx
"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { assignVehiclesToSubGarage } from "@/app/(app)/my-vehicles/actions";
import { getVehiclesBrowserData } from "@/lib/queries/vehicles";

type Props = {
  ownedPropertyId: string;
  assignedUpgradeId: string | null;
  label: string;
  capacity: number;
  currentCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type LightVehicle = {
  id: string;
  display_name: string;
  manufacturer_display: string;
  class: string;
};

export function VehiclePickerModal({
  ownedPropertyId,
  assignedUpgradeId,
  label,
  capacity,
  currentCount,
  open,
  onOpenChange,
}: Props) {
  const [vehicles, setVehicles] = useState<LightVehicle[] | null>(null);
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [isPending, startTransition] = useTransition();

  // Fetch vehicles list lazily on open
  if (open && vehicles === null) {
    fetch("/api/vehicles-list")
      .then((r) => r.json() as Promise<LightVehicle[]>)
      .then(setVehicles)
      .catch((err) => toast.error(String(err)));
  }

  const slotsFree = capacity - currentCount;
  const totalSelected = Array.from(counts.values()).reduce((a, b) => a + b, 0);

  const filtered = useMemo(() => {
    if (!vehicles) return [];
    const q = search.toLowerCase();
    return q
      ? vehicles.filter(
          (v) =>
            v.display_name.toLowerCase().includes(q) ||
            v.manufacturer_display.toLowerCase().includes(q),
        )
      : vehicles;
  }, [vehicles, search]);

  const bump = (id: string, delta: number) => {
    setCounts((prev) => {
      const next = new Map(prev);
      const cur = next.get(id) ?? 0;
      const nv = Math.max(0, cur + delta);
      if (nv === 0) next.delete(id);
      else next.set(id, nv);
      return next;
    });
  };

  const handleSave = () => {
    const ids: string[] = [];
    for (const [id, count] of counts) {
      for (let i = 0; i < count; i++) ids.push(id);
    }
    if (ids.length === 0) {
      onOpenChange(false);
      return;
    }
    startTransition(async () => {
      const r = await assignVehiclesToSubGarage({
        ownedPropertyId,
        assignedUpgradeId,
        vehicleIds: ids,
      });
      if ("error" in r) toast.error(r.error);
      else if ("capacityExceeded" in r)
        toast.error(`Over capacity: ${r.capacityExceeded.wouldBeAfter} / ${r.capacityExceeded.capacity}`);
      else {
        toast.success(`Added ${ids.length} cars`);
        setCounts(new Map());
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add cars to {label}</DialogTitle>
          <DialogDescription>
            {totalSelected} selected · {slotsFree - totalSelected} slots remaining of {capacity}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vehicles..."
          />
          {vehicles === null ? (
            <p className="text-sm text-muted-foreground">Loading vehicles…</p>
          ) : (
            <div className="grid max-h-96 grid-cols-2 gap-1 overflow-y-auto sm:grid-cols-3 md:grid-cols-4">
              {filtered.slice(0, 200).map((v) => {
                const n = counts.get(v.id) ?? 0;
                return (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{v.display_name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {v.manufacturer_display}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => bump(v.id, -1)}
                        disabled={n === 0}
                        className="h-6 w-6 rounded border text-xs disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-xs">{n}</span>
                      <button
                        type="button"
                        onClick={() => bump(v.id, +1)}
                        disabled={totalSelected >= slotsFree}
                        className="h-6 w-6 rounded border text-xs disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || totalSelected === 0}>
            Save {totalSelected} cars
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Create the lightweight vehicles list API route** (so the modal doesn't need a full RSC fetch each open)

Create `app/api/vehicles-list/route.ts`:

```ts
import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select("id, display_name, class, manufacturers(display)")
    .order("display_name", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  type Row = NonNullable<typeof data>[number];
  return NextResponse.json(
    (data ?? []).map((r: Row) => {
      const m = Array.isArray(r.manufacturers) ? r.manufacturers[0] : r.manufacturers;
      return {
        id: r.id,
        display_name: r.display_name,
        class: r.class,
        manufacturer_display: m?.display ?? "",
      };
    }),
  );
}
```

- [ ] **Step 4: Typecheck + commit (both Task 16 and 17 land together)**

```bash
npm run typecheck
git add components/portfolio/property-drawer.tsx components/portfolio/vehicle-picker-modal.tsx app/api/vehicles-list/route.ts components/ui/dialog.tsx
git commit -m "Phase 5: PropertyDrawer + VehiclePickerModal — shared upgrade + assignment UI"
```

---

## Task 18: Component — `<TradeInModal>` + wire into `/properties` browse

**Files:**
- Create: `components/portfolio/trade-in-modal.tsx`
- Modify: `app/(app)/properties/property-card.tsx`

- [ ] **Step 1: Write the modal**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { tradeInProperty } from "@/app/(app)/properties/actions";

type TradeInTrigger = {
  group: string;
  currentlyOwned: Array<{ id: string; display_name: string; car_count: number }>;
  newProperty: { id: string; display_name: string; capacity: number };
};

type Props = {
  trigger: TradeInTrigger | null;
  onClose: () => void;
};

export function TradeInModal({ trigger, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(
    trigger?.currentlyOwned[0]?.id ?? null,
  );
  const [isPending, startTransition] = useTransition();

  if (!trigger) return null;

  const chosen = trigger.currentlyOwned.find((p) => p.id === selected);
  const overCapacity =
    chosen !== undefined && chosen.car_count > trigger.newProperty.capacity;
  const excess = overCapacity ? chosen!.car_count - trigger.newProperty.capacity : 0;

  const handleConfirm = () => {
    if (!chosen) return;
    // Build car destinations: for Piece 1 simplicity, "move first capacity cars,
    // unassign the rest". A future iteration replaces with per-car picker.
    const destinations = Array.from({ length: chosen.car_count }, (_, i) => ({
      ownedVehicleId: "__placeholder__",  // Filled by server (TODO: see below)
      action: i < trigger.newProperty.capacity ? "move" as const : "unassign" as const,
    }));
    // We don't have car IDs at this layer — fetch them inside the action OR pass
    // empty array and let the action move all + auto-unassign overflow. The simpler
    // path: pass empty destinations; tradeInProperty falls back to "move all that
    // fit, unassign rest". See spec server-action notes.
    startTransition(async () => {
      const r = await tradeInProperty({
        newPropertyId: trigger.newProperty.id,
        tradeInOwnedPropertyId: chosen.id,
        carDestinations: [],  // empty = server's default move-all-or-unassign
      });
      if ("error" in r) toast.error(r.error);
      else {
        toast.success("Trade-in complete");
        onClose();
      }
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            You're at your {trigger.group.replace(/-/g, " ")} limit
          </DialogTitle>
          <DialogDescription>
            To get <strong>{trigger.newProperty.display_name}</strong>, trade in
            one of your existing properties.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          {trigger.currentlyOwned.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-3 rounded-md border p-3"
              style={{ borderColor: selected === p.id ? "hsl(48 96% 53%)" : undefined }}
            >
              <input
                type="radio"
                name="tradein"
                checked={selected === p.id}
                onChange={() => setSelected(p.id)}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{p.display_name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.car_count} cars stored
                </p>
              </div>
            </label>
          ))}
          {overCapacity && (
            <p className="text-xs text-amber-400">
              ⚠ New property holds {trigger.newProperty.capacity} cars but {chosen!.display_name} has {chosen!.car_count}.
              {excess} cars will be unassigned (you'll re-link them from /my-vehicles).
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isPending || !selected}>
            Trade in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Note on tradeInProperty's empty-destinations behavior:** Update `tradeInProperty()` in `app/(app)/properties/actions.ts` to handle empty `carDestinations` as "move all that fit, unassign overflow":

```ts
// In tradeInProperty, before the "for (const dest of args.carDestinations)" loop:
if (args.carDestinations.length === 0) {
  // Fetch cars at the trade-in property, then build destinations server-side.
  const { data: cars, error } = await supabase
    .from("user_owned_vehicles")
    .select("id")
    .eq("user_id", user.id)
    .eq("stored_in_property_id", args.tradeInOwnedPropertyId)
    .order("created_at", { ascending: true });
  if (error) return { error: error.message };

  // Capacity check on new property (base only — sub-garage capacity is irrelevant
  // for trade-in because upgrades don't auto-transfer)
  const { data: newProp } = await supabase
    .from("user_owned_properties")
    .select("properties!inner(capacity)")
    .eq("id", newRow.id)
    .maybeSingle();
  const newP = Array.isArray(newProp?.properties) ? newProp?.properties[0] : newProp?.properties;
  const cap = newP?.capacity ?? 0;

  args.carDestinations = (cars ?? []).map((c, i) => ({
    ownedVehicleId: c.id,
    action: i < cap ? "move" : "unassign",
  }));
}
```

- [ ] **Step 2: Wire the modal into property-card.tsx**

In `app/(app)/properties/property-card.tsx`, add state for the trade-in trigger near the top of the component and render the modal:

```tsx
const [tradeInTrigger, setTradeInTrigger] = useState<TradeInTrigger | null>(null);
// ...
// In handleToggle, replace the "needsTradeIn" branch:
} else if ("needsTradeIn" in result) {
  setOptimisticOwned(false);
  setTradeInTrigger(result.needsTradeIn);
}
// ...
// At the end of the JSX return:
<TradeInModal trigger={tradeInTrigger} onClose={() => setTradeInTrigger(null)} />
```

Import: `import { TradeInModal, type TradeInTrigger } from "@/components/portfolio/trade-in-modal";`. Export the `TradeInTrigger` type from the modal file.

- [ ] **Step 3: Smoke-test**

Run `npm run dev`. Sign in. Toggle ownership on a nightclub. Toggle ownership on a SECOND nightclub — verify the trade-in modal opens listing the first one. Confirm — verify (via MCP execute_sql) that the new nightclub is owned and the old one isn't, and that the cars (if any) point at the new owned_property_id.

- [ ] **Step 4: Commit**

```bash
git add components/portfolio/trade-in-modal.tsx app/(app)/properties/property-card.tsx app/(app)/properties/actions.ts
git commit -m "Phase 5: TradeInModal + tradeInProperty default-destinations behavior"
```

---

## Task 19: `/my-properties` page (Phase 4c)

**Files:**
- Create: `app/(app)/my-properties/my-properties-grid.tsx`
- Create: `app/(app)/my-properties/empty-state.tsx`
- Modify: `app/(app)/my-properties/page.tsx`

- [ ] **Step 1: Write the empty state**

```tsx
// app/(app)/my-properties/empty-state.tsx
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function MyPropertiesEmptyState() {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-12 text-center">
      <p className="text-lg font-semibold">No properties yet</p>
      <p className="max-w-md text-sm text-muted-foreground">
        Walk through the onboarding wizard for a guided setup, or browse the
        property catalogue to mark what you own.
      </p>
      <div className="flex gap-2">
        <Button asChild>
          <Link href="/wizard">Open onboarding wizard</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/properties">Browse properties</Link>
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the grid**

```tsx
// app/(app)/my-properties/my-properties-grid.tsx
"use client";

import { useState } from "react";

import { PropertyDrawer } from "@/components/portfolio/property-drawer";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import { propertyImageUrl } from "@/lib/properties";

type Props = { properties: OwnedPropertyDetail[] };

export function MyPropertiesGrid({ properties }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = properties.find((p) => p.id === selectedId);

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {properties.map((p) => {
          const imageUrl = propertyImageUrl(p.image_path);
          const totalCapacity =
            p.base_capacity +
            p.upgrades.filter((u) => u.is_installed).reduce((s, u) => s + u.capacity, 0);
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedId(p.id)}
              className="flex flex-col overflow-hidden rounded-lg border bg-card text-left hover:border-foreground/40"
            >
              <div className="relative aspect-video w-full bg-muted">
                {imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={imageUrl} alt={p.display_name} className="h-full w-full object-cover" />
                )}
                <span className="absolute right-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium text-white">
                  {p.total_upgrades === 0
                    ? "No upgrades"
                    : p.installed_upgrades === p.total_upgrades
                      ? "✓ Fully built"
                      : `${p.installed_upgrades} / ${p.total_upgrades} upgrades`}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-3">
                <p className="text-sm font-medium">{p.display_name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.subtype_display}
                  {p.neighborhood ? ` · ${p.neighborhood}` : ""}
                </p>
                <p className="mt-1 text-xs text-emerald-400">
                  🚗 {p.total_cars} / {totalCapacity} cars stored
                </p>
              </div>
            </button>
          );
        })}
      </div>
      {selected && (
        <PropertyDrawer
          property={selected}
          allOwnedProperties={properties}
          open={true}
          onOpenChange={(o) => !o && setSelectedId(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Replace `page.tsx`**

```tsx
// app/(app)/my-properties/page.tsx
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";

import { MyPropertiesGrid } from "./my-properties-grid";
import { MyPropertiesEmptyState } from "./empty-state";

export default async function MyPropertiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const properties = await getOwnedPropertiesWithStorage(user.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">My Properties</h1>
      {properties.length === 0 ? (
        <MyPropertiesEmptyState />
      ) : (
        <MyPropertiesGrid properties={properties} />
      )}
    </div>
  );
}
```

- [ ] **Step 4: Smoke-test**

`npm run dev` → `/my-properties`. If no properties: empty state shows both CTAs. Own a property at `/properties`, come back: card shows with status overlay + car count. Click card: drawer opens with upgrade tree.

- [ ] **Step 5: Commit**

```bash
git add app/(app)/my-properties/
git commit -m "Phase 5: /my-properties Phase 4c — cards + drawer + empty state"
```

---

## Task 20: `/my-vehicles` rewrite — cards + table + sub-line + banner + filter

**Files:**
- Create: `app/(app)/my-vehicles/unassigned-banner.tsx`
- Create: `app/(app)/my-vehicles/my-vehicles-grid.tsx`
- Create: `app/(app)/my-vehicles/my-vehicles-table.tsx`
- Create: `components/portfolio/location-filter.tsx`
- Modify: `app/(app)/my-vehicles/page.tsx`

- [ ] **Step 1: Banner**

```tsx
// app/(app)/my-vehicles/unassigned-banner.tsx
import Link from "next/link";

import { Button } from "@/components/ui/button";

export function UnassignedBanner({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <div className="flex items-center justify-between rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-3">
      <p className="text-sm">
        <strong>{count}</strong> {count === 1 ? "car needs" : "cars need"} a home.
      </p>
      <Button asChild size="sm">
        <Link href="/wizard">Set up storage →</Link>
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: LocationFilter**

```tsx
// components/portfolio/location-filter.tsx
"use client";

import { Checkbox } from "@/components/ui/checkbox"; // shadcn — add if missing: `npx shadcn@latest add checkbox`
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type Props = {
  properties: Array<{ id: string; display_name: string }>;
  selectedPropertyIds: string[];
  unassignedOnly: boolean;
  onChange: (sel: { properties: string[]; unassignedOnly: boolean }) => void;
};

export function LocationFilter({
  properties, selectedPropertyIds, unassignedOnly, onChange,
}: Props) {
  const togglePid = (id: string) => {
    const next = selectedPropertyIds.includes(id)
      ? selectedPropertyIds.filter((x) => x !== id)
      : [...selectedPropertyIds, id];
    onChange({ properties: next, unassignedOnly });
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          📍 Locations
          {(selectedPropertyIds.length > 0 || unassignedOnly) && (
            <span className="ml-1 rounded bg-primary px-1 text-[10px] text-primary-foreground">
              {selectedPropertyIds.length + (unassignedOnly ? 1 : 0)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <label className="flex cursor-pointer items-center gap-2 border-b pb-2">
          <Checkbox
            checked={unassignedOnly}
            onCheckedChange={(c) =>
              onChange({ properties: selectedPropertyIds, unassignedOnly: !!c })
            }
          />
          <span className="text-sm font-medium">Unassigned only</span>
        </label>
        <div className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
          {properties.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={selectedPropertyIds.includes(p.id)}
                onCheckedChange={() => togglePid(p.id)}
              />
              <span className="text-sm">{p.display_name}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Step 3: Cards grid**

```tsx
// app/(app)/my-vehicles/my-vehicles-grid.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { vehicleImageUrl } from "@/lib/vehicles";
import { InstanceDrawer } from "@/components/portfolio/instance-drawer";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

type Props = {
  instances: OwnedVehicleInstance[];
  ownedProperties: OwnedPropertyDetail[];
  tagLookup: Record<string, string>;
};

export function MyVehiclesGrid({ instances, ownedProperties, tagLookup }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = instances.find((i) => i.id === selectedId);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {instances.map((inst) => {
          const img = vehicleImageUrl(inst.image_path);
          const subLineCompact = inst.storage
            ? `${inst.storage.property_display_name}${inst.storage.upgrade_display_name ? ` · ${inst.storage.upgrade_display_name}` : ""}`
            : null;
          return (
            <button
              key={inst.id}
              type="button"
              onClick={() => setSelectedId(inst.id)}
              className="flex flex-col overflow-hidden rounded-lg border border-emerald-500/70 bg-card text-left ring-2 ring-emerald-500/30 hover:border-foreground/40"
            >
              <div className="relative aspect-video w-full bg-muted">
                {img && (
                  <Image src={img} alt={inst.display_name} fill className="object-contain" loading="lazy" sizes="20vw" />
                )}
                <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] uppercase text-white">
                  {inst.class}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-3">
                <p className="text-sm font-medium">
                  {inst.nickname ?? inst.display_name}
                </p>
                <p className="text-xs text-muted-foreground">{inst.manufacturer_display}</p>
                {subLineCompact ? (
                  <p className="mt-1 text-xs text-amber-400">📍 {subLineCompact}</p>
                ) : (
                  <p className="mt-1 text-xs text-red-400">📍 Not stored →</p>
                )}
                <div className="mt-1 flex flex-wrap gap-1">
                  {inst.tag_ids.slice(0, 3).map((id) => (
                    <Badge key={id} variant="outline" className="text-[10px]">
                      {tagLookup[id] ?? id}
                    </Badge>
                  ))}
                  {inst.custom_tags.slice(0, 3).map((t) => (
                    <Badge key={t} variant="outline" className="border-amber-500/40 text-amber-300 text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      {selected && (
        <InstanceDrawer
          instance={selected}
          ownedProperties={ownedProperties}
          open={true}
          onOpenChange={(o) => !o && setSelectedId(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Table view**

```tsx
// app/(app)/my-vehicles/my-vehicles-table.tsx
"use client";

import { useState } from "react";

import { InstanceDrawer } from "@/components/portfolio/instance-drawer";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

type Props = {
  instances: OwnedVehicleInstance[];
  ownedProperties: OwnedPropertyDetail[];
};

type SortKey = "display_name" | "class" | "manufacturer_display" | "property" | "upgrade";

export function MyVehiclesTable({ instances, ownedProperties }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("display_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const selected = instances.find((i) => i.id === selectedId);

  const sorted = [...instances].sort((a, b) => {
    const av =
      sortKey === "property"
        ? a.storage?.property_display_name ?? ""
        : sortKey === "upgrade"
          ? a.storage?.upgrade_display_name ?? ""
          : (a as unknown as Record<string, string>)[sortKey] ?? "";
    const bv =
      sortKey === "property"
        ? b.storage?.property_display_name ?? ""
        : sortKey === "upgrade"
          ? b.storage?.upgrade_display_name ?? ""
          : (b as unknown as Record<string, string>)[sortKey] ?? "";
    const cmp = av.localeCompare(bv);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      onClick={() => {
        if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
        else { setSortKey(k); setSortDir("asc"); }
      }}
      className="cursor-pointer p-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      {label} {sortKey === k && (sortDir === "asc" ? "↑" : "↓")}
    </th>
  );

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30">
            <tr>
              <SortHeader k="display_name" label="Vehicle" />
              <SortHeader k="class" label="Class" />
              <SortHeader k="manufacturer_display" label="Manufacturer" />
              <SortHeader k="property" label="📍 Stored at" />
              <SortHeader k="upgrade" label="Sub-garage" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((inst) => (
              <tr
                key={inst.id}
                onClick={() => setSelectedId(inst.id)}
                className="cursor-pointer border-b hover:bg-muted/30"
              >
                <td className="p-2">{inst.nickname ?? inst.display_name}</td>
                <td className="p-2 text-muted-foreground">{inst.class}</td>
                <td className="p-2 text-muted-foreground">{inst.manufacturer_display}</td>
                <td className="p-2">
                  {inst.storage ? (
                    inst.storage.property_display_name
                  ) : (
                    <span className="text-red-400">Not stored →</span>
                  )}
                </td>
                <td className="p-2 text-muted-foreground">
                  {inst.storage?.upgrade_display_name ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {selected && (
        <InstanceDrawer
          instance={selected}
          ownedProperties={ownedProperties}
          open={true}
          onOpenChange={(o) => !o && setSelectedId(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 5: Rewrite the page**

```tsx
// app/(app)/my-vehicles/page.tsx
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOwnedVehicleInstances } from "@/lib/queries/my-vehicles";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";

import { MyVehiclesClient } from "./my-vehicles-client";

export default async function MyVehiclesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [instances, ownedProperties, { data: tags }] = await Promise.all([
    getOwnedVehicleInstances(user.id),
    getOwnedPropertiesWithStorage(user.id),
    supabase.from("vehicle_tags").select("id, display"),
  ]);

  const tagLookup = Object.fromEntries(
    (tags ?? []).map((t) => [t.id, t.display]),
  );

  return (
    <MyVehiclesClient
      instances={instances}
      ownedProperties={ownedProperties}
      tagLookup={tagLookup}
    />
  );
}
```

Create `app/(app)/my-vehicles/my-vehicles-client.tsx` (the toggle wrapper):

```tsx
"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationFilter } from "@/components/portfolio/location-filter";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

import { MyVehiclesGrid } from "./my-vehicles-grid";
import { MyVehiclesTable } from "./my-vehicles-table";
import { UnassignedBanner } from "./unassigned-banner";

type Props = {
  instances: OwnedVehicleInstance[];
  ownedProperties: OwnedPropertyDetail[];
  tagLookup: Record<string, string>;
};

const VIEW_KEY = "my-vehicles:view";

export function MyVehiclesClient({ instances, ownedProperties, tagLookup }: Props) {
  const [view, setView] = useState<"cards" | "table">("cards");
  const [search, setSearch] = useState("");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  // Restore + persist view choice
  useEffect(() => {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "table" || v === "cards") setView(v);
  }, []);
  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  const filtered = instances.filter((i) => {
    if (unassignedOnly && i.storage) return false;
    if (selectedPropertyIds.length > 0 && (!i.storage || !selectedPropertyIds.includes(i.storage.owned_property_id))) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!i.display_name.toLowerCase().includes(q) && !(i.nickname ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const unassignedCount = instances.filter((i) => !i.storage).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">My Vehicles ({instances.length})</h1>
        <div className="flex flex-wrap gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search"
            className="w-48"
          />
          <LocationFilter
            properties={ownedProperties.map((p) => ({ id: p.id, display_name: p.display_name }))}
            selectedPropertyIds={selectedPropertyIds}
            unassignedOnly={unassignedOnly}
            onChange={({ properties, unassignedOnly }) => {
              setSelectedPropertyIds(properties);
              setUnassignedOnly(unassignedOnly);
            }}
          />
          <div className="flex rounded-md border">
            <Button
              size="sm"
              variant={view === "cards" ? "default" : "ghost"}
              onClick={() => setView("cards")}
            >▦ Cards</Button>
            <Button
              size="sm"
              variant={view === "table" ? "default" : "ghost"}
              onClick={() => setView("table")}
            >☰ Table</Button>
          </div>
        </div>
      </div>
      <UnassignedBanner count={unassignedCount} />
      {view === "cards" ? (
        <MyVehiclesGrid instances={filtered} ownedProperties={ownedProperties} tagLookup={tagLookup} />
      ) : (
        <MyVehiclesTable instances={filtered} ownedProperties={ownedProperties} />
      )}
    </div>
  );
}
```

- [ ] **Step 6: Smoke-test**

`npm run dev` → `/my-vehicles`. Verify: cards show with sub-line, search filters, location filter shows owned properties + Unassigned toggle, view toggle persists across page refresh, table sort works, clicking a card opens the InstanceDrawer.

- [ ] **Step 7: Commit**

```bash
git add app/(app)/my-vehicles/ components/portfolio/location-filter.tsx components/ui/checkbox.tsx
git commit -m "Phase 5: /my-vehicles rewrite — instance cards + table + sub-line + filters + banner"
```

---

## Task 21: PropertiesBrowser selectionMode + wizard PropertyHubList

**Files:**
- Modify: `app/(app)/properties/properties-browser.tsx`
- Create: `app/(app)/wizard/property-hub-list.tsx`

- [ ] **Step 1: Add `selectionMode` to PropertiesBrowser**

Find the `PropertiesBrowserProps` type and extend:

```ts
type Props = {
  // ... existing fields ...
  selectionMode?: "browse" | "multi";
  selectedIds?: string[];
  onToggleSelection?: (propertyId: string) => void;
};
```

In the render, pass new props to `<PropertyCard>`. In `property-card.tsx`, when `mode === "multi"`, replace the `togglePropertyOwnership` call with `onToggleSelection?.(property.id)` and show a different visual state (e.g., emerald check overlay when in `selectedIds`).

(Detailed PropertyCard change: ~15 lines. Add `mode`, `selected`, `onClick` to its props; in the render, if `mode==="multi"`, the whole card click calls `onClick` instead of toggling ownership. Tail of file changes the click handler conditional.)

- [ ] **Step 2: Write PropertyHubList**

```tsx
// app/(app)/wizard/property-hub-list.tsx
"use client";

import { useState } from "react";

import { PropertyDrawer } from "@/components/portfolio/property-drawer";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

type Props = { properties: OwnedPropertyDetail[] };

export function PropertyHubList({ properties }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = properties.find((p) => p.id === selectedId);

  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Your properties — {properties.length} owned</h2>
        <p className="text-sm text-muted-foreground">Click any property to fill in installed upgrades + cars.</p>
        <div className="mt-2 flex flex-col gap-2">
          {properties.map((p) => {
            const totalCap =
              p.base_capacity +
              p.upgrades.filter((u) => u.is_installed).reduce((s, u) => s + u.capacity, 0);
            const status =
              p.total_cars === 0
                ? "Empty"
                : p.total_cars >= totalCap && p.installed_upgrades === p.total_upgrades
                  ? `✓ Complete (${p.total_cars} cars)`
                  : `⏳ In progress (${p.total_cars} of ~${totalCap})`;
            const borderColor =
              status.startsWith("✓") ? "hsl(142 65% 38%)" :
              status.startsWith("⏳") ? "hsl(48 96% 53%)" : "#444";
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className="flex items-center justify-between rounded-md border p-3 text-left hover:border-foreground/60"
                style={{ borderLeft: `3px solid ${borderColor}` }}
              >
                <div>
                  <p className="text-sm font-medium">{p.display_name}</p>
                  <p className="text-xs text-muted-foreground">{p.subtype_display}</p>
                </div>
                <span className="text-xs text-muted-foreground">{status}</span>
              </button>
            );
          })}
        </div>
      </div>
      {selected && (
        <PropertyDrawer
          property={selected}
          allOwnedProperties={properties}
          open={true}
          onOpenChange={(o) => !o && setSelectedId(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
npm run typecheck
git add app/(app)/properties/properties-browser.tsx app/(app)/properties/property-card.tsx app/(app)/wizard/property-hub-list.tsx
git commit -m "Phase 5: PropertiesBrowser selectionMode + PropertyHubList for wizard"
```

---

## Task 22: Wizard route + state machine + layout redirect

**Files:**
- Create: `app/(app)/wizard/page.tsx`
- Create: `app/(app)/wizard/onboarding-wizard.tsx`
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Write the state-machine component**

```tsx
// app/(app)/wizard/onboarding-wizard.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { PropertiesBrowser } from "@/app/(app)/properties/properties-browser";
import { togglePropertyOwnership } from "@/app/(app)/properties/actions";
import { PropertyHubList } from "./property-hub-list";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

type Step = "picker" | "hub";

type Props = {
  ownedProperties: OwnedPropertyDetail[];
  propertiesBrowserData: Parameters<typeof PropertiesBrowser>[0];
};

export function OnboardingWizard({ ownedProperties, propertiesBrowserData }: Props) {
  const router = useRouter();
  const [step, setStep] = useState<Step>(
    ownedProperties.length > 0 ? "hub" : "picker",
  );
  const [pickerSelection, setPickerSelection] = useState<string[]>([]);

  const handleAdvance = async () => {
    for (const propertyId of pickerSelection) {
      const r = await togglePropertyOwnership(propertyId);
      if ("error" in r && r.error) {
        // ignore individual failures; user can re-try at the hub
      }
    }
    router.refresh();
    setStep("hub");
  };

  if (step === "picker") {
    return (
      <div className="flex flex-col gap-4">
        <div>
          <h1 className="text-2xl font-bold">Set up your portfolio</h1>
          <p className="text-sm text-muted-foreground">
            Pick the properties you own. You can finish in any order on the next screen.
          </p>
        </div>
        <PropertiesBrowser
          {...propertiesBrowserData}
          selectionMode="multi"
          selectedIds={pickerSelection}
          onToggleSelection={(id) =>
            setPickerSelection((prev) =>
              prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
            )
          }
        />
        <div className="sticky bottom-0 flex justify-between border-t bg-background p-3">
          <Button variant="outline" onClick={() => router.push("/dashboard")}>
            Skip for now
          </Button>
          <Button onClick={handleAdvance} disabled={pickerSelection.length === 0}>
            Continue with {pickerSelection.length} selected →
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Your portfolio</h1>
        <p className="text-sm text-muted-foreground">
          Click each property to mark installed upgrades and add cars. Finish whenever.
        </p>
      </div>
      <PropertyHubList properties={ownedProperties} />
      <div className="flex justify-end gap-2 border-t pt-4">
        <Button variant="outline" onClick={() => router.push("/dashboard")}>
          Finish later
        </Button>
        <Button onClick={() => router.push("/my-vehicles")}>Done</Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

```tsx
// app/(app)/wizard/page.tsx
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getPropertiesBrowserData } from "@/lib/queries/properties";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";

import { OnboardingWizard } from "./onboarding-wizard";

export default async function WizardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [propertiesBrowserData, ownedProperties] = await Promise.all([
    getPropertiesBrowserData(user.id),
    getOwnedPropertiesWithStorage(user.id),
  ]);

  return (
    <OnboardingWizard
      ownedProperties={ownedProperties}
      propertiesBrowserData={propertiesBrowserData}
    />
  );
}
```

- [ ] **Step 3: Wizard redirect in layout**

In `app/(app)/layout.tsx`, after the `if (!user) redirect("/login")` block:

```ts
import { isWizardCompleted } from "@/lib/queries/wizard";
import { headers } from "next/headers";

// ...

const pathname = (await headers()).get("x-pathname") ?? "";
const completed = await isWizardCompleted(user.id);
if (!completed && pathname !== "/wizard" && pathname !== "/dashboard") {
  redirect("/wizard");
}
```

Wire `x-pathname` in `middleware.ts` so the layout can read the current route:

```ts
// middleware.ts — inside the existing function, before returning supabaseResponse:
supabaseResponse.headers.set("x-pathname", request.nextUrl.pathname);
```

- [ ] **Step 4: Smoke-test the full wizard flow**

1. Create a fresh user (or wipe ownership in MCP: `delete from user_owned_properties; delete from user_owned_vehicles;`)
2. Navigate to `/`. Should redirect to `/wizard`.
3. Select a stand-alone garage and a nightclub. Click Continue.
4. Hub appears with 2 entries marked "Empty".
5. Click the garage. Drawer skips upgrade tree (no sub-garages), opens vehicle modal directly… **wait — the drawer currently always opens.** Patch PropertyDrawer to call its modal opener directly when `storageUpgrades.length === 0 && property.base_capacity > 0` AND the user hasn't seen the drawer yet. Implementation: in PropertyDrawer's open useEffect, if storageUpgrades.length===0 && nonStorageUpgrades.length===0 then auto-set pickerTarget to base storage and open the picker.
6. Add 3 cars. Save.
7. Hub row updates to "✓ Complete (3 cars)".
8. Click Done → `/my-vehicles` shows the 3 cars.
9. Sign out + back in → no redirect to `/wizard` (completed).

- [ ] **Step 5: Apply the drawer-skip patch**

In `components/portfolio/property-drawer.tsx`, add at the top of the component:

```tsx
import { useEffect } from "react";
// ...
useEffect(() => {
  if (!open) return;
  const noUpgrades =
    storageUpgrades.length === 0 && nonStorageUpgrades.length === 0;
  if (noUpgrades && property.base_capacity > 0 && !pickerOpen) {
    setPickerTarget({
      upgradeId: null,
      label: "Base storage",
      capacity: property.base_capacity,
      current: baseStorageCars,
    });
    setPickerOpen(true);
  }
}, [open, storageUpgrades.length, nonStorageUpgrades.length, property.base_capacity, baseStorageCars, pickerOpen]);
```

- [ ] **Step 6: Commit**

```bash
git add app/(app)/wizard/ app/(app)/layout.tsx middleware.ts components/portfolio/property-drawer.tsx
git commit -m "Phase 5: onboarding wizard route + layout redirect + drawer-skip for simple properties"
```

---

## Task 23: Acceptance walk-through + plan.md update

**Files:**
- Modify: `docs/plan.md`

- [ ] **Step 1: Walk through every Acceptance Criterion from the spec**

For each criterion (1–9), run the documented flow on `localhost:3000`. Fix any breaks inline.

- [ ] **Step 2: Update `docs/plan.md`**

Add a "Where we left off" entry dated 2026-05-24 or whenever this lands, summarising:
- Migrations 0004 + 0005 applied
- Verify-flag findings from Task 3 (paste subagent verdict)
- All Piece 1 surfaces live
- Pending followups (custom images, polished tag editor, AI organizer — all deferred to later pieces)

Update the Phase Overview table: Phase 5 (Slot Assignment) → 🟡 In progress for the wizard portion that ships → ✅ on completion.

- [ ] **Step 3: Final commit**

```bash
git add docs/plan.md
git commit -m "docs: plan.md — Piece 1 foundation shipped (wizard + multi-instance + trade-in)"
```

---

## Self-Review Notes

After writing the plan I did a pass against the spec:

- **Spec coverage:** every section/decision has a task. Custom uploaded images explicitly NOT in scope (per spec §Deferred), so no task for them. ✅
- **Type consistency:** `ownedPropertyId` vs `owned_property_id` is used consistently (camelCase in TS, snake_case in column refs). ✅
- **Edge case — drawer skip:** Task 22 Step 4 catches the case the spec described but the PropertyDrawer code wouldn't handle without the useEffect; Step 5 patches it. ✅
- **One known imperfection:** Task 18's TradeInModal sends `carDestinations: []` and the server fills in "move-first-N-unassign-rest" automatically. This means the modal doesn't yet let the user pick *which* cars stay when over-capacity — the spec promised that interaction. The MVP is functional (cars don't get deleted, overflow goes to unassigned) but the polished "pick which N stay" is a small follow-up. Recommend filing as a Piece 1.1 issue rather than blocking. Captured in spec's Open/Verify items already.

---

## Out of Scope (don't do these in Piece 1)

- Per-car selection in trade-in over-capacity flow (mentioned above)
- Custom uploaded vehicle images
- Polished chip-input tag editor with autocomplete
- AI organizer (Piece 2)
- Per-slot x/y positions (Phase 8 — Visual Garage Editor)
- Move-history audit log
- Pro tier paywall

Each lives in the spec's Deferred section with its target phase.
