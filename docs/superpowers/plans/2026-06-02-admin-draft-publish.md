# Admin Draft/Publish (Catalog Visibility) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give vehicles + properties a `status` (draft/published/archived); hide non-published items from the public via an RLS policy; let admins see + change status from the editors, logged to the activity log.

**Architecture:** A `status` column (default `published`) + a catalog SELECT RLS policy scoped to `status='published'` hides drafts from every public read with zero query changes. Admin editors switch to the service-role client (which bypasses RLS) so admins still see all statuses, and gain a status `<select>` per row that calls a guarded `setCatalogStatus` action (which logs to the Slice-5b activity log).

**Tech Stack:** Next.js (App Router, server actions), Supabase (Postgres + RLS + service-role), TypeScript, Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-02-admin-draft-publish-design.md`

---

## File Structure

- Create `lib/catalog/status.ts` (+ test) — pure statuses + validator.
- Create `supabase/migrations/0031_catalog_status.sql` — column + RLS swap.
- Modify `app/admin/actions.ts` — `setCatalogStatus` action.
- Create `app/admin/admin-status-cell.tsx` — status `<select>` cell.
- Modify `app/admin/vehicles/page.tsx` + `app/admin/properties/page.tsx` — service-role client + select `status`.
- Modify `app/admin/vehicles/admin-vehicles-table.tsx` + `app/admin/properties/admin-properties-table.tsx` — Status column.

---

## Task 1: Pure catalog status module

**Files:**
- Create: `lib/catalog/status.ts`
- Test: `lib/catalog/status.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/catalog/status.test.ts
import { describe, it, expect } from "vitest";
import { CATALOG_STATUSES, isValidCatalogStatus, statusLabel } from "./status";

describe("CATALOG_STATUSES", () => {
  it("has draft, published, archived", () => {
    expect(CATALOG_STATUSES.map((s) => s.value)).toEqual(["draft", "published", "archived"]);
  });
});

describe("isValidCatalogStatus", () => {
  it("accepts the three states and rejects others", () => {
    expect(isValidCatalogStatus("draft")).toBe(true);
    expect(isValidCatalogStatus("published")).toBe(true);
    expect(isValidCatalogStatus("archived")).toBe(true);
    expect(isValidCatalogStatus("live")).toBe(false);
    expect(isValidCatalogStatus("")).toBe(false);
  });
});

describe("statusLabel", () => {
  it("maps values to labels, falling back to the value", () => {
    expect(statusLabel("published")).toBe("Published");
    expect(statusLabel("draft")).toBe("Draft");
    expect(statusLabel("unknown")).toBe("unknown");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/catalog/status.test.ts`
Expected: FAIL — `Cannot find module './status'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/catalog/status.ts
// Pure catalog visibility statuses. Values MUST match the check constraint in
// supabase/migrations/0031_catalog_status.sql.

export type CatalogStatus = "draft" | "published" | "archived";

export const CATALOG_STATUSES: { value: CatalogStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export function isValidCatalogStatus(v: string): boolean {
  return CATALOG_STATUSES.some((s) => s.value === v);
}

export function statusLabel(v: string): string {
  return CATALOG_STATUSES.find((s) => s.value === v)?.label ?? v;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/catalog/status.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/catalog/status.ts lib/catalog/status.test.ts
git commit -m "feat(catalog): pure draft/published/archived status module"
```

---

## Task 2: Migration (status column + RLS swap)

**Files:**
- Create: `supabase/migrations/0031_catalog_status.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0031_catalog_status.sql
-- Catalog visibility: draft/published/archived. Existing rows default to
-- 'published' so nothing disappears. The public SELECT policy is scoped to
-- published rows; the service-role admin client bypasses RLS and sees all.

alter table public.vehicles
  add column if not exists status text not null default 'published'
  check (status in ('draft', 'published', 'archived'));
alter table public.properties
  add column if not exists status text not null default 'published'
  check (status in ('draft', 'published', 'archived'));

create index if not exists idx_vehicles_status on public.vehicles (status);
create index if not exists idx_properties_status on public.properties (status);

drop policy if exists "Reference tables are readable by everyone" on public.vehicles;
create policy "Published vehicles are readable by everyone"
  on public.vehicles for select using (status = 'published');

drop policy if exists "Reference tables are readable by everyone" on public.properties;
create policy "Published properties are readable by everyone"
  on public.properties for select using (status = 'published');
```

- [ ] **Step 2: Apply to the GT Vault project**

Apply via Supabase MCP `apply_migration` (project_id `bzoizaakcqzlvpraysjn`, name `0031_catalog_status`). Report exact errors if any; do not retry destructively. (This changes live catalog visibility — but the `default 'published'` keeps every existing row visible.)

- [ ] **Step 3: Verify (non-destructive but IMPORTANT — confirm nothing got hidden)**

Run via MCP `execute_sql` (project `bzoizaakcqzlvpraysjn`):
```sql
select
  (select count(*) from public.vehicles)                              as total_vehicles,
  (select count(*) from public.vehicles where status = 'published')   as pub_vehicles,
  (select count(*) from public.properties)                            as total_properties,
  (select count(*) from public.properties where status = 'published') as pub_properties,
  (select count(*) from pg_policies where tablename='vehicles'   and qual like '%published%') as veh_policy,
  (select count(*) from pg_policies where tablename='properties' and qual like '%published%') as prop_policy,
  (select count(*) from pg_policies where tablename='vehicles'   and policyname='Reference tables are readable by everyone') as veh_old_policy;
```
Expected: `pub_vehicles == total_vehicles`, `pub_properties == total_properties` (every existing row published), `veh_policy = 1`, `prop_policy = 1`, `veh_old_policy = 0` (the old `using(true)` policy is gone on vehicles). If `pub_*` does NOT equal `total_*`, STOP and report — something is wrong.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0031_catalog_status.sql
git commit -m "feat(catalog): status column + published-only RLS policy"
```

---

## Task 3: setCatalogStatus action

**Files:**
- Modify: `app/admin/actions.ts`

- [ ] **Step 1: Add the import**

`app/admin/actions.ts` already imports `requireAdmin`, `createAdminClient`,
`revalidatePath`, `logAdminActivity`, `diffFields`, and defines `IMAGE_ENTITIES`
(a `Set<ImageEntity>` of `["vehicles","properties"]`) and `type Result = { ok: true } | { error: string }`.
READ the file to confirm, then add this import near the top:
```ts
import { isValidCatalogStatus } from "@/lib/catalog/status";
```

- [ ] **Step 2: Append the action at the END of the file**

```ts
/** Set a catalog item's visibility status (draft/published/archived). */
export async function setCatalogStatus(
  entity: string,
  id: string,
  status: string,
): Promise<Result> {
  await requireAdmin();
  if (!IMAGE_ENTITIES.has(entity as ImageEntity)) return { error: "Invalid entity." };
  if (!isValidCatalogStatus(status)) return { error: "Invalid status." };

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from(entity)
    .select("display_name, status")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from(entity).update({ status }).eq("id", id);
  if (error) return { error: error.message };

  const b = (before ?? {}) as { display_name?: string; status?: string };
  await logAdminActivity({
    action: entity === "vehicles" ? "vehicle.update" : "property.update",
    targetId: id,
    targetLabel: b.display_name ?? id,
    changes: diffFields({ status: b.status ?? null }, { status }, ["status"]),
  });

  revalidatePath(`/admin/${entity}`);
  revalidatePath("/", "layout");
  return { ok: true };
}
```

- [ ] **Step 3: Typecheck + commit**

Run: `npm run typecheck` (expected: no errors), then:
```bash
git add app/admin/actions.ts
git commit -m "feat(catalog): setCatalogStatus admin action (logged)"
```

---

## Task 4: Status cell + admin wiring

**Files:**
- Create: `app/admin/admin-status-cell.tsx`
- Modify: `app/admin/vehicles/page.tsx`
- Modify: `app/admin/vehicles/admin-vehicles-table.tsx`
- Modify: `app/admin/properties/page.tsx`
- Modify: `app/admin/properties/admin-properties-table.tsx`

- [ ] **Step 1: Create the status cell**

```tsx
// app/admin/admin-status-cell.tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { ImageEntity } from "@/lib/admin/image-upload";
import { CATALOG_STATUSES } from "@/lib/catalog/status";
import { setCatalogStatus } from "./actions";

export function AdminStatusCell({
  entity,
  id,
  initial,
}: {
  entity: ImageEntity;
  id: string;
  initial: string;
}) {
  const [status, setStatus] = useState(initial);
  const [pending, startTransition] = useTransition();

  const onChange = (next: string) => {
    const prev = status;
    setStatus(next); // optimistic
    startTransition(async () => {
      const res = await setCatalogStatus(entity, id, next);
      if ("error" in res) {
        toast.error(res.error);
        setStatus(prev);
      }
    });
  };

  return (
    <select
      value={status}
      disabled={pending}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-md border bg-background px-2 text-xs"
    >
      {CATALOG_STATUSES.map((s) => (
        <option key={s.value} value={s.value}>
          {s.label}
        </option>
      ))}
    </select>
  );
}
```

- [ ] **Step 2: Vehicles page — service-role client + select status**

Replace the ENTIRE contents of `app/admin/vehicles/page.tsx` with:
```tsx
import { createAdminClient } from "@/lib/supabase/admin";
import type { AvailabilityStatus, VehicleVendor } from "@/lib/vehicles";

import { AdminVehiclesTable, type AdminVehicleRow } from "./admin-vehicles-table";

export default async function AdminVehiclesPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("vehicles")
    .select(
      "id, display_name, class, manufacturer_id, price, availability, vendors, image_path, status, manufacturers(display)",
    )
    .order("display_name", { ascending: true });
  if (error) throw error;

  type Row = NonNullable<typeof data>[number];
  const rows: AdminVehicleRow[] = (data ?? []).map((r: Row) => {
    const m = Array.isArray(r.manufacturers) ? r.manufacturers[0] : r.manufacturers;
    return {
      id: r.id,
      display_name: r.display_name,
      class: r.class,
      manufacturer_display: m?.display ?? "",
      price: r.price,
      availability: (r.availability ?? "available") as AvailabilityStatus,
      vendors: (r.vendors ?? []) as VehicleVendor[],
      image_path: r.image_path,
      status: r.status ?? "published",
    };
  });

  return <AdminVehiclesTable rows={rows} />;
}
```

- [ ] **Step 3: Vehicles table — Status column**

In `app/admin/vehicles/admin-vehicles-table.tsx`:
- Add `status: string;` to the `AdminVehicleRow` type (after `image_path: string | null;`).
- Add the import (near the `AdminImageCell` import):
  ```tsx
  import { AdminStatusCell } from "../admin-status-cell";
  ```
- In the `<thead>` row, add `<th className="w-32 p-2">Status</th>` immediately AFTER `<th className="w-44 p-2">Image</th>`.
- In `Row`'s returned `<tr>`, add this `<td>` immediately AFTER the image `<td>` (the one containing `<AdminImageCell entity="vehicles" ...>`):
  ```tsx
      <td className="p-1.5">
        <AdminStatusCell entity="vehicles" id={row.id} initial={row.status} />
      </td>
  ```

- [ ] **Step 4: Properties page — service-role client + select status**

Replace the ENTIRE contents of `app/admin/properties/page.tsx` with:
```tsx
import { createAdminClient } from "@/lib/supabase/admin";

import {
  AdminPropertiesTable,
  type AdminPropertyRow,
} from "./admin-properties-table";

export default async function AdminPropertiesPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, display_name, property_type, subtype, subtype_display, neighborhood, capacity, counts_as_garage, price, image_path, status",
    )
    .order("display_name", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as AdminPropertyRow[];
  return <AdminPropertiesTable rows={rows} />;
}
```

- [ ] **Step 5: Properties table — Status column**

In `app/admin/properties/admin-properties-table.tsx`:
- Add `status: string;` to the `AdminPropertyRow` type (after `image_path: string | null;`).
- Add the import (near the `AdminImageCell` import):
  ```tsx
  import { AdminStatusCell } from "../admin-status-cell";
  ```
- In the `<thead>` row, add `<th className="w-32 p-2">Status</th>` immediately AFTER the `Image` `<th>` (the first header cell, added in Slice 5a).
- In `Row`'s returned `<tr>`, add this `<td>` immediately AFTER the image `<td>` (the one containing `<AdminImageCell entity="properties" ...>`):
  ```tsx
      <td className="p-1.5">
        <AdminStatusCell entity="properties" id={row.id} initial={row.status} />
      </td>
  ```
READ the file first to confirm the exact `Image` `<th>` text and the image `<td>` so you place the new cells correctly.

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Full test suite**

Run: `npm test`
Expected: all green, including `lib/catalog/status.test.ts`.

- [ ] **Step 8: Manual smoke (note — needs a browser)**

As owner: `/admin/vehicles` shows a **Status** column (all "Published"). Set one to **Draft** → it vanishes from the public `/vehicles` list + its detail page + dashboard coverage, but still shows in `/admin/vehicles`; `/admin/activity` logs `status: published → draft`. Re-publish → it returns. Same for a property/business. (Do not block the commit on this step.)

- [ ] **Step 9: Commit**

```bash
git add app/admin/admin-status-cell.tsx app/admin/vehicles/page.tsx app/admin/vehicles/admin-vehicles-table.tsx app/admin/properties/page.tsx app/admin/properties/admin-properties-table.tsx
git commit -m "feat(admin): status column + Draft/Published/Archived control in editors"
```

---

## Self-Review Notes (for the executor)

- **Spec coverage:** status column + RLS swap (Task 2), pure status module (Task 1), `setCatalogStatus` logged action (Task 3), admin service-role switch + Status UI on vehicles + properties (Task 4). Public hiding is automatic via RLS — no public query edits.
- **Safety:** column default `'published'` keeps every existing row visible; Task 2 Step 3 explicitly verifies `published == total` before proceeding.
- **Type consistency:** `CatalogStatus`/`CATALOG_STATUSES` defined once in `lib/catalog/status.ts`; `setCatalogStatus` reuses the existing `Result` type + `IMAGE_ENTITIES`/`ImageEntity`; the status cell reuses `ImageEntity` for its `entity` prop.
- **Audit:** status changes reuse the Slice-5b activity log via the existing `vehicle.update`/`property.update` codes (status diff) — no new action codes.
- **Admin visibility:** switching the two admin pages to `createAdminClient()` is REQUIRED — otherwise the new RLS policy would hide drafts from admins too.
- **Deferred per spec:** approval workflow, scheduled publish, upgrades status, owner-visible hidden items.
