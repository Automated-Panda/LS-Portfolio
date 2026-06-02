# Admin Dashboard — Slice 4: Support / Feedback Inbox

**Date:** 2026-06-02
**Status:** Approved (design)
**Author:** James + Claude

## Context

Slice 4 of the Admin Dashboard (roadmap in `docs/admin.md`). Slices 1–3 shipped
2026-06-02. There is currently **no support/feedback system** — no tickets table,
no submission form.

This slice adds a two-sided feature: a **user-facing feedback submission** (from
every logged-in page) and an **admin triage inbox** (`/admin/support`). It reuses
the Slice-2 **notification system** to alert submitters when their ticket's status
changes.

## Goals

- Logged-in users can submit feedback from a **floating button** AND a
  **"Send feedback"** item in the account menu — both open the same modal.
- Submission captures: **category** (bug / feature / data / suggestion / general /
  complaint), **message**, and an optional **related item** (free text).
- **Owner AND editor** can open `/admin/support` and triage tickets:
  - move **status** through New → In review → Planned → Fixed → Rejected → Closed
    (and filter by status),
  - set **priority** (low / normal / high),
  - add **internal notes** (admin-only),
  - changing status **notifies the submitter** in-app (reuses Slice 2).

## Non-Goals (deferred)

- "Assigned to" (single admin today).
- A user-facing "My tickets" history page (the in-app notification is the loop).
- Email notifications (in-app only this slice; Resend is still graceful-degrade).
- Attachments / screenshots.
- Logged-out / marketing-site contact form.

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Submission entry | Floating button + user-menu item, one shared modal | James picked both; share open-state via context |
| Shared open-state | `FeedbackProvider` React context in app shell | Cleaner/testable vs an event bus |
| Inbox access | Owner **and** editor (`requireAdmin`) | Support isn't owner-only (per original spec) |
| Internal notes | Separate `support_ticket_notes` table | Many notes per ticket; clean cascade |
| Admin reads/writes | Service-role client in admin actions | Same pattern as Users/Revenue; no admin RLS needed |
| Status-change alert | `createNotification` to submitter | Reuses Slice 2 infra |
| Related item | Optional free text | Avoids a heavy entity picker (YAGNI) |

## Architecture

### 1. Database — migration `0028_support_tickets.sql`

- **`support_tickets`**:
  - `id uuid pk default gen_random_uuid()`
  - `user_id uuid not null references auth.users(id) on delete cascade`
  - `category text not null check (category in ('bug','feature','data','suggestion','general','complaint'))`
  - `message text not null`
  - `related_item text`
  - `priority text not null default 'normal' check (priority in ('low','normal','high'))`
  - `status text not null default 'new' check (status in ('new','in_review','planned','fixed','rejected','closed'))`
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()` + a `touch_updated_at` trigger
    (mirror the `trg_user_credits_touch` pattern).
  - Index on `(status, created_at desc)`.
- **`support_ticket_notes`**:
  - `id uuid pk default gen_random_uuid()`
  - `ticket_id uuid not null references public.support_tickets(id) on delete cascade`
  - `author_id uuid references auth.users(id)`
  - `body text not null`
  - `created_at timestamptz not null default now()`
  - Index on `(ticket_id, created_at)`.
- **RLS**:
  - `support_tickets`: enable RLS; policy `insert` with check `auth.uid() = user_id`;
    policy `select` using `auth.uid() = user_id`. (No update/delete for users.)
    Admin reads/writes go through the service-role client (bypasses RLS).
  - `support_ticket_notes`: enable RLS; **no policies** → service-role only.

### 2. User submission — `components/app-shell/feedback.tsx`

- `FeedbackProvider` — context exposing `open()` / `setOpen` + `open` boolean.
- `useFeedback()` — hook for consumers.
- `FeedbackWidget` — renders a floating bottom-right button and the modal. Modal
  fields: category `<select>`, message `<textarea>`, optional related-item
  `<input>`. On submit calls the server action and shows a success/empty/error
  state; closes on success.
- Server action `app/(app)/feedback-actions.ts` (a `"use server"` module —
  separate from the client widget) → `submitFeedback(input)`: gets the current
  user, validates via `validateFeedback`, inserts a `support_tickets` row with the
  **user-scoped** client (insert-own RLS), returns `{ ok } | { error }`.
- Wiring in `components/app-shell/app-shell.tsx`: wrap the shell in
  `FeedbackProvider`, render `<FeedbackWidget />`; `user-menu.tsx` adds a
  "Send feedback" item that calls `useFeedback().open()`.

### 3. Admin inbox — `app/admin/support/` (owner + editor)

- Sidebar: a **Support** group (always shown to admins, like Content) with an
  **Inbox** link to `/admin/support`, added in `app/admin/layout.tsx`.
- `page.tsx` (`requireAdmin`, server): service-role fetch of all tickets
  (newest-first) and all notes; resolve submitter emails by calling
  `auth.admin.listUsers` and building an `id → email` map (the exact approach the
  Users page already uses). Group notes by `ticket_id`. Pass a view-model to a
  client list.
- `admin-support-list.tsx` (client): status filter; each ticket expands to show
  full message, related item, internal notes, and controls (status `<select>`,
  priority `<select>`, add-note input). Mirrors the `admin-users-table` pattern
  (useTransition + inline error).
- `actions.ts` (`requireAdmin`, service-role):
  - `setTicketStatus(id, status)` → update row → `createNotification(submitterId,
    ticketStatusNotification(category, status))` → revalidate.
  - `setTicketPriority(id, priority)` → update → revalidate.
  - `addTicketNote(id, body)` → insert note (author = current admin) → revalidate.

### 4. Notifications — `lib/notifications/messages.ts`

Add a pure `ticketStatusNotification(category, status)` returning a
`NotificationPayload` (type `support_update`) — e.g. title "Update on your bug
report", body "Your bug report was marked Fixed." Uses the human labels from the
support constants.

### 5. Pure / tested logic — `lib/support/tickets.ts`

- `CATEGORIES`, `STATUSES`, `PRIORITIES` — arrays of `{ value, label }`.
- `isValidCategory/Status/Priority(value): boolean`.
- `categoryLabel/statusLabel/priorityLabel(value): string`.
- `validateFeedback({ category, message, relatedItem }): { ok: true } | { ok: false; error: string }`
  — category valid, message non-empty + ≤ 2000 chars, related item ≤ 200 chars.
- All pure → unit-tested. The migration's check constraints mirror these values
  (keep in sync).

### 6. Testing (TDD on pure logic)

`lib/support/tickets.test.ts`: validators accept/reject correctly; label lookups;
`validateFeedback` rejects empty/oversized message + invalid category, accepts a
good one. `lib/notifications/messages.test.ts`: extend with
`ticketStatusNotification` (correct type, human-readable status in the body).

The DB migration, the widget/provider, the page, and the server actions are
verified by typecheck + manual smoke (no unit tests for I/O/UI).

## Acceptance Criteria

- [ ] A logged-in user can open the feedback modal from BOTH the floating button
      and the account-menu item, pick a category, type a message (+ optional
      related item), and submit; the ticket appears in the admin inbox.
- [ ] Validation rejects an empty message and an over-long message with a clear
      error.
- [ ] Owner and editor can both open `/admin/support`; a normal user is redirected
      out of `/admin`.
- [ ] Admin can change a ticket's status (filterable), set priority, and add an
      internal note.
- [ ] Changing a ticket's status creates an in-app notification for the submitter
      (visible in their bell).
- [ ] Internal notes are never exposed to the submitter (admin-only table, no user
      RLS policy).
- [ ] `npm run typecheck` and `npm test` pass (incl. the new support + message
      suites).
