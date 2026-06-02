# Admin Dashboard — Slice 5b: Admin Activity Log

**Date:** 2026-06-02
**Status:** Approved (design)
**Author:** James + Claude

## Context

Sub-slice 5b of the Admin Dashboard (after 5a image upload). There is **no audit
trail** of admin actions today — content edits, image changes, user-management
actions, and support triage all happen with no record of who did what. This slice
adds an append-only **admin activity log** plus an owner-only page to view it.

Existing admin actions to instrument (all use the service-role client + a
`requireAdmin`/`requireOwner` guard):
- `app/admin/actions.ts`: `updateVehicleAdmin`, `updatePropertyAdmin`,
  `updateUpgradeAdmin`, `uploadCatalogImage`, `removeCatalogImage`.
- `app/admin/users/actions.ts`: `adjustUserCredits`, `setUserRole`,
  `setUserDisabled` (owner-only).
- `app/admin/support/actions.ts`: `setTicketStatus`, `setTicketPriority`,
  `addTicketNote`.

## Goals

- Record **every** admin mutation above with: actor (id + email), action code,
  a human target label, target id, a `changes` payload (before→after for edits),
  and a timestamp.
- An **owner-only** `/admin/activity` page shows the latest entries newest-first,
  with an action-type filter.
- Logging is **best-effort**: a logging failure must never fail the underlying
  admin action.

## Non-Goals (deferred)

- Revert-from-log.
- Pagination beyond the latest ~200 entries (add later).
- Retention/cleanup policy.
- Diffing image binary content (log "uploaded"/"removed" only).
- A DB-trigger-based audit (can't capture the acting admin's identity or non-row
  actions).

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Logging layer | App-level helper per action | Captures actor + intent + before/after; triggers can't |
| Failure mode | Best-effort (`try/catch`, non-fatal) | An audit miss must not block the real action |
| Storage | One `admin_activity_log` table, `changes jsonb` | Flexible across heterogeneous actions |
| Access | Owner-only page; service-role reads | Oversight tool; editors don't audit |
| Before/after | Read the row's old fields before content edits | The point of the log; one extra read is trivial |

## Architecture

### 1. Database — migration `0030_admin_activity_log.sql`

```sql
create table if not exists public.admin_activity_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users(id),
  actor_email  text,
  action       text not null,
  target_label text,
  target_id    text,
  changes      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_admin_activity_created
  on public.admin_activity_log (created_at desc);

alter table public.admin_activity_log enable row level security;
-- No policies: append + read only via the service-role client (owner-gated page).
```

### 2. Pure formatting — `lib/admin/activity-format.ts` (tested)

- `type FieldChange = { field: string; from: unknown; to: unknown }`.
- `diffFields(before, after, fields: string[]): FieldChange[]` — for each named
  field, include `{field, from, to}` only when `before[field] !== after[field]`
  (shallow, value-equality; `null`/number/string/boolean). Returns `[]` if nothing
  changed.
- `ACTION_LABELS: Record<string, string>` + `actionLabel(code: string): string`
  — maps codes (`vehicle.update`, `property.update`, `upgrade.update`,
  `image.upload`, `image.remove`, `user.credits`, `user.role`, `user.disabled`,
  `ticket.status`, `ticket.priority`, `ticket.note`) to human phrases (e.g.
  "edited vehicle", "replaced image", "changed role"); unknown → the raw code.

### 3. Server helper — `lib/admin/activity.ts`

```ts
import "server-only";
// logAdminActivity({ action, targetLabel?, targetId?, changes? })
//   - resolves the current admin (id + email) via the user-scoped client
//   - inserts a row with the service-role client
//   - throws on DB error (callers wrap in try/catch)
```

`type AdminActivityInput = { action: string; targetLabel?: string | null;
targetId?: string | null; changes?: Record<string, unknown> | FieldChange[] }`.

### 4. Wiring (each call `try/catch`-guarded, after a successful mutation)

- **Content edits** (`app/admin/actions.ts`): before applying the patch, read the
  affected row's current values for the patched fields; after a successful update,
  `logAdminActivity({ action: 'vehicle.update', targetLabel: <display_name>,
  targetId: id, changes: diffFields(before, patch, Object.keys(patch)) })`. Same
  for property/upgrade. Skip logging when the patch is a no-op (no fields).
- **Images** (`app/admin/actions.ts`): after upload/remove,
  `logAdminActivity({ action: 'image.upload' | 'image.remove', targetLabel:
  <item display_name, read>, targetId: id, changes: {} })`.
- **Users** (`app/admin/users/actions.ts`): resolve the target email (already
  fetched in `adjustUserCredits`; fetch via `auth.admin.getUserById` in the role/
  disable actions). Log `user.credits` (`{delta, note, newTotal}`), `user.role`
  (read old role first → `{from, to}`), `user.disabled` (`{to: disabled}`).
- **Support** (`app/admin/support/actions.ts`): `setTicketStatus` already fetches
  the ticket → log `ticket.status` `{from, to}` with `targetLabel = category`;
  `ticket.priority` `{to}`; `ticket.note` `{note}`.

A logging helper failure is caught and `console.error`'d — the action still
returns `{ ok: true }`.

### 5. Owner-only page — `app/admin/activity/page.tsx`

- `if (!(await isOwner())) redirect('/admin')`.
- Service-role fetch: `admin_activity_log` ordered `created_at desc` limit 200.
- Pass to a small client `admin-activity-list.tsx`: an action-type `<select>`
  filter + a feed. Each row: `actor_email` · `actionLabel(action)` ·
  `target_label` · relative/short date; if `changes` is a `FieldChange[]`, render
  `field: from → to` lines; if an object, render its key/values compactly.
- Sidebar: owner-only **Audit → Activity** group in `app/admin/layout.tsx`
  (mirrors the People/Business owner-only groups).

### 6. Testing (TDD on the pure module)

`lib/admin/activity-format.test.ts`:
- `diffFields`: detects changed fields only; ignores unchanged; handles
  null↔value and number/string/boolean; empty when nothing changed; respects the
  `fields` allowlist.
- `actionLabel`: known codes → labels; unknown code → returned verbatim.

The helper, the action wiring, and the page are verified by typecheck + manual
smoke.

## Acceptance Criteria

- [ ] Editing a vehicle's price logs a `vehicle.update` entry with
      `price: old → new` and the editor's email; it appears on `/admin/activity`.
- [ ] Replacing/removing an image, adjusting credits, changing a role, disabling
      an account, and changing a ticket's status/priority/notes each create a
      log entry.
- [ ] The activity page is reachable by the owner only; an editor is redirected to
      `/admin`.
- [ ] If the log insert fails, the underlying admin action still succeeds.
- [ ] The action-type filter narrows the feed.
- [ ] `npm run typecheck` and `npm test` pass (incl. the new activity-format
      tests).
