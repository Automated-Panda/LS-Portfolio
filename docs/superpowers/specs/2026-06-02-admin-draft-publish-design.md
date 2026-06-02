# Admin Dashboard — Slice 5c: Draft / Publish (Catalog Visibility)

**Date:** 2026-06-02
**Status:** Approved (design)
**Author:** James + Claude

## Context

Final sub-slice of Slice 5 (after 5a image upload + 5b activity log). Adds
visibility states to catalog items so an admin can hide a vehicle or property
from the public without deleting it.

Verified facts that shape the design:
- The catalog tables `vehicles` / `properties` have RLS enabled with a single
  permissive SELECT policy `"Reference tables are readable by everyone"`
  (`using (true)`) — `supabase/migrations/0001_init.sql`.
- **Every** public-facing read (browse, detail, cards, dashboard catalog
  coverage, `lib/marketing/stats.ts`, the public `app/api/vehicles-list` route,
  and the `user_owned_* → catalog !inner` joins) goes through the RLS-respecting
  client (`createClient` from `@/lib/supabase/server`). No public read uses the
  service-role client.
- The admin editors `app/admin/vehicles/page.tsx` + `app/admin/properties/page.tsx`
  ALSO currently read via the RLS client.
- There is no status/visibility column on either table today.
- "Businesses" are `properties` rows (`property_type='business'`) — same handling.

## Goals

- Each vehicle/property has a status: **draft** (hidden), **published** (live —
  the default for all existing rows), **archived** (hidden, kept for records).
- Non-published items are hidden from the public **everywhere** automatically.
- Admins can see all statuses and change an item's status from the editors; the
  change is recorded in the activity log (Slice 5b).

## Non-Goals (deferred)

- "Needs review" + editor-proposes/owner-approves approval workflow.
- Scheduled publishing; per-field draft staging.
- Status on `property_upgrades`.
- Keeping a drafted/archived item visible to a user who already owns it (confirmed
  with James: a hidden item disappears from owners' garages too — acceptable since
  archiving is rare and admin-only).

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Hiding mechanism | RLS SELECT policy scoped to `status='published'` | One policy change hides drafts across all public reads; no query edits |
| Existing rows | Column default `'published'` | Nothing disappears on rollout |
| Admin visibility | Switch admin editors to the service-role client | RLS would otherwise hide drafts from admins too |
| Status change auditing | Reuse Slice-5b activity log (`*.update`, status diff) | No new action codes needed |
| Owned hidden items | Fully hidden (no owner exception) | Simplest; matches RLS; rare case |
| Scope | vehicles + properties | upgrades have no independent visibility |

## Architecture

### 1. Database — migration `0031_catalog_status.sql`

```sql
alter table public.vehicles
  add column if not exists status text not null default 'published'
  check (status in ('draft','published','archived'));
alter table public.properties
  add column if not exists status text not null default 'published'
  check (status in ('draft','published','archived'));

create index if not exists idx_vehicles_status on public.vehicles (status);
create index if not exists idx_properties_status on public.properties (status);

-- Scope public visibility to published rows. Service-role (admin) bypasses RLS.
drop policy if exists "Reference tables are readable by everyone" on public.vehicles;
create policy "Published vehicles are readable by everyone"
  on public.vehicles for select using (status = 'published');

drop policy if exists "Reference tables are readable by everyone" on public.properties;
create policy "Published properties are readable by everyone"
  on public.properties for select using (status = 'published');
```

(The identically-named policy on `property_upgrades` / `manufacturers` /
`vehicle_tags` is left untouched — only the vehicles + properties policies are
dropped/recreated by name on those two tables.)

### 2. Pure logic — `lib/catalog/status.ts` (tested)

- `CATALOG_STATUSES: { value: 'draft'|'published'|'archived'; label: string }[]`
  (labels: Draft / Published / Archived).
- `isValidCatalogStatus(v: string): boolean`.
- `statusLabel(v: string): string` (fallback to the raw value).

### 3. Admin action — append to `app/admin/actions.ts`

`setCatalogStatus(entity: string, id: string, status: string): Promise<Result>`
(`requireAdmin`):
- validate `entity ∈ {vehicles, properties}` and `isValidCatalogStatus(status)`.
- read the current row (`display_name, status`) via the service-role client.
- update `status`; on error return it.
- log to the activity log: `logAdminActivity({ action: entity === 'vehicles' ?
  'vehicle.update' : 'property.update', targetId: id, targetLabel: <display_name>,
  changes: diffFields({status: <old>}, {status}, ['status']) })`.
- `revalidatePath('/admin/' + entity)`; `revalidatePath('/', 'layout')`.

### 4. Admin reads + UI

- `app/admin/vehicles/page.tsx` + `app/admin/properties/page.tsx`: switch
  `createClient()` → `createAdminClient()` (service-role) so admins see all
  statuses, and add `status` to the `.select(...)` + the mapped row.
- `app/admin/admin-status-cell.tsx` (new client component): a `<select>` of
  `CATALOG_STATUSES` seeded from the row's status; on change calls
  `setCatalogStatus(entity, id, value)` inside `useTransition`, reverts + toasts
  on error. Mirrors `admin-image-cell.tsx`.
- Both admin tables (`admin-vehicles-table.tsx`, `admin-properties-table.tsx`):
  add `status: string` to the row type and a **Status** column rendering
  `<AdminStatusCell entity=... id={row.id} initial={row.status} />`.

### 5. Testing (TDD on pure logic)

`lib/catalog/status.test.ts`: `isValidCatalogStatus` accepts the three values,
rejects others; `statusLabel` maps values → labels, unknown → verbatim;
`CATALOG_STATUSES` has the three expected values.

The migration (incl. the RLS swap), the admin-client switch, the action, and the
status cell are verified by typecheck + manual smoke.

## Acceptance Criteria

- [ ] After the migration, all existing catalog items are `published` and the
      public catalog/dashboard/marketing counts are unchanged.
- [ ] Setting a vehicle to `draft` (or `archived`) removes it from the public
      `/vehicles` list, its detail page, dashboard coverage, and marketing counts —
      with no app query changes — while it still shows (and is editable) in
      `/admin/vehicles`.
- [ ] Same for a property/business.
- [ ] The status change appears in the activity log as a `status: old → new` diff.
- [ ] Re-publishing makes the item public again.
- [ ] A normal user cannot read a non-published row (RLS).
- [ ] `npm run typecheck` and `npm test` pass (incl. the new status tests).
