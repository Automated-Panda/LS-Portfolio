# Admin Dashboard — Slice 1+2: Roles, Shell & User Management

**Date:** 2026-06-02
**Status:** Approved (design)
**Author:** James + Claude

## Context

GT Vault already has a minimal `/admin` area (`app/admin/`) with card-grid
landing + editors for **Vehicles**, **Properties & Businesses**, and **Upgrades**.
Access is gated by a single hard-coded `ADMIN_EMAIL` env check in
`lib/admin/guard.ts` — there is **no role system**. Stripe + the credit system
(`user_credits`, `credit_transactions`, `grant_credits` RPC) are fully wired.

The full Admin Dashboard vision spans 7+ independent subsystems (content
management, user management, analytics, revenue, support inbox, activity log,
draft/publish). That is too large for one spec, so it has been **decomposed into
sequential slices**:

1. **Roles + Admin Shell foundation** ← _this spec (combined with #2)_
2. **User Management** (incl. give/remove credits) ← _this spec_
3. Revenue tracking
4. Support / Feedback inbox
5. Content-mgmt upgrades (image upload, draft/publish, full activity log)
6. Analytics overview

This spec covers **Slice 1 + Slice 2 together**, because Slice 1 is the
foundation everything else needs and Slice 2 delivers the highest immediate
value — including a proper "Give / Remove credits" UI that replaces manual SQL.

## Goals

- A real **role system** (`owner` / `editor` / `user`) with `ADMIN_EMAIL` as an
  owner bootstrap (lockout safety net).
- A proper **sidebar admin shell** that is role-aware (Editors see Content only;
  Owner sees everything).
- An **owner-only User Management** page: searchable table of all users with
  role, plan, status, subscription, credits, signup, last login.
- Per-user actions: **adjust credits (± any amount, audited)**, **change role**,
  **disable / enable account**.
- When credits are adjusted, the user is **alerted** via an in-app notification
  **and** a (graceful-degrade) email.

## Non-Goals (explicitly deferred)

- Saved / favourited items (net-new _user-facing_ feature → its own feature).
- Usage activity & analytics (Slice 6).
- Revenue dashboard (Slice 3); Support inbox (Slice 4).
- Image upload/replace, draft/publish, a general `activity_log` table (Slice 5).
- CSV export of users (trivial follow-up).
- Realtime push for notifications (bell + email are sufficient now).
- A `developer` role (one-line migration to add later; no behavior yet).

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Roles | `owner` / `editor` / `user` + `ADMIN_EMAIL` bootstrap → owner | Matches spec; bootstrap prevents lockout |
| Credit grant target | Never-expiring `balance_credits` bucket | Behaves like a gift that sticks |
| Credit grant amount | Arbitrary ± delta, clamped ≥ 0, with note | James wants exact control + claw-back |
| Notification storage | Dedicated `notifications` table | Reusable for future events; keeps history |
| Credit-adjust impl | New `admin_adjust_credits` RPC | Keeps manual gifts separate from Stripe `grant_credits` |
| Admin shell | New sidebar layout | Matches dashboard vision; scales to future slices |
| Email | Resend, **graceful-degrade** on `RESEND_API_KEY` | Not blocked on DNS/domain verification today |

## Architecture

### 1. Database — migration `0027_admin_roles.sql`

- **`profiles.role`**: `text not null default 'user'`,
  `check (role in ('user','editor','owner'))`.
- **Self-escalation guard**: a `BEFORE UPDATE` trigger on `profiles` raises if
  `role` is changed by anyone other than the service role (i.e. role changes can
  only happen through the owner-only admin action, never the normal profile
  update path / RLS).
- **Owner seed**: `update profiles ... set role = 'owner'` for the row whose
  `auth.users.email` matches the known owner email (`james@automatedpanda.com`),
  idempotent.
- **`notifications`** table:
  - `id uuid pk default gen_random_uuid()`
  - `user_id uuid not null references auth.users(id) on delete cascade`
  - `type text not null` (e.g. `credit_adjustment`)
  - `title text not null`
  - `body text`
  - `data jsonb not null default '{}'`
  - `read_at timestamptz`
  - `created_at timestamptz not null default now()`
  - RLS: user may `select` + `update` (mark read) **their own** rows; inserts are
    service-role only.
  - Index on `(user_id, read_at)` for unread counts.
- **`credit_transactions.reason`**: add `admin_adjustment` to the allowed set
  (enum value or check-constraint update, matching current implementation).
- **`admin_adjust_credits(p_user_id uuid, p_delta int, p_note text)`**:
  `SECURITY DEFINER`, granted to `service_role` only. Atomically updates
  `user_credits.balance_credits` (clamped to `≥ 0`), inserts a
  `credit_transactions` row (`reason = 'admin_adjustment'`, `bucket = 'purchased'`,
  `balance_after`, `metadata` carrying the note), and returns the new total.
  Creates a `user_credits` row first if one is somehow missing.

### 2. Roles & access — `lib/admin/guard.ts` (extended)

- `getRole(): Promise<'owner'|'editor'|'user'>` — reads `profiles.role` for the
  current user; returns `owner` when the email equals `ADMIN_EMAIL` (bootstrap),
  regardless of the DB value.
- `isAdmin()` — `role ∈ {owner, editor}` → may access `/admin`.
- `isOwner()` — `role === owner` → may access owner-only areas.
- `requireAdmin()` / `requireOwner()` — throw `Forbidden` for server actions;
  layout uses `isAdmin()` (redirect `/`) and owner-only pages use `isOwner()`.
- Existing per-action `requireAdmin()` calls in `app/admin/actions.ts` continue
  to work (content edits are allowed for editors + owner).

### 3. Admin shell — `app/admin/layout.tsx` (reworked) + sidebar component

- Replace the header-nav with a **sidebar shell**:
  - **Overview**: Dashboard
  - **Content**: Vehicles · Properties & Businesses · Upgrades _(editor + owner)_
  - **People**: Users _(owner only)_
  - Footer: ⬇ Export backup · ← Back to app
- Sidebar is **role-aware**: editors do not see the People section; owner sees
  all. Future slices (Revenue, Support, Analytics) slot into new sections here.
- **Overview page** (`app/admin/page.tsx`): light stat cards from cheap counts
  (total users, paid users, active subs, total credits granted). No heavy
  analytics — those are Slice 6.

### 4. User Management — `app/admin/users/` (owner-only)

- **`page.tsx`** (server): builds a combined view-model by joining
  `auth.users` (via service-role `auth.admin.listUsers`: email, `created_at`,
  `last_sign_in_at`, `banned_until`) with `profiles` (display name, role) and
  `user_credits` (balance, `has_active_sub`, stripe ids). `plan` is derived:
  `has_active_sub ? 'Pro' : 'Free'`.
- **`admin-users-table.tsx`** (client): searchable/filterable table. Columns:
  name, email, role, plan, account status, subscription status, credits, signup,
  last login. Row actions:
  - **Adjust credits** — modal with a signed amount field + optional note.
  - **Change role** — select (user / editor / owner).
  - **Disable / enable** — toggle.
- **`actions.ts`** (server actions, each `requireOwner()`):
  - `adjustUserCredits(userId, delta, note)` → `admin_adjust_credits` RPC →
    `createNotification(...)` → best-effort `sendCreditsAdjustedEmail(...)` →
    `revalidatePath('/admin/users')`.
  - `setUserRole(userId, role)` → update `profiles.role` (service role).
  - `setUserDisabled(userId, disabled)` → `auth.admin.updateUserById` with
    `ban_duration` (`'none'` to re-enable, a long duration to disable).
- Pagination: simple page/perPage (small user base today; `listUsers` paginates).

### 5. Notifications — `lib/notifications/` + app-shell bell

- `lib/notifications/server.ts`:
  `createNotification(userId, { type, title, body, data })` via the service-role
  client; `markRead(id)` / `markAllRead(userId)` for the current user.
- **Bell** in the app-shell header (`components/app-shell/`): unread dot + count,
  dropdown list, mark-as-read. On load, an unread `credit_adjustment` notification
  also pops a toast (e.g. "🎁 You received 50 credits!"). Realtime push deferred.

### 6. Email — `lib/email/` (Resend, graceful-degrade)

- Add `resend` dependency.
- `lib/email/client.ts`: lazily constructs a Resend client from `RESEND_API_KEY`.
  If the key is **absent**, `send()` is a **no-op** that logs and returns
  `{ skipped: true }` — so the build/feature is never blocked on DNS/domain
  verification.
- `lib/email/templates/credits-adjusted.ts`: branded HTML matching the existing
  dark auth templates (`https://www.gtvault.app/logo-email.png`).
- `lib/email/send.ts`: `sendCreditsAdjustedEmail(to, { delta, newBalance, note })`.
  From `EMAIL_FROM` (default `GT Vault <noreply@gtvault.app>`).
- Wired into `adjustUserCredits` inside `try/catch` — an email failure or a
  missing key **never** blocks the grant or the in-app notification.
- New env vars documented in `.env.local.example`: `RESEND_API_KEY`, `EMAIL_FROM`.

### 7. Testing (TDD on pure logic)

- Role resolution: bootstrap email → owner; DB role honored otherwise.
- `admin_adjust_credits` semantics: positive grant, negative deduction, clamp at
  zero (cannot go negative), correct `balance_after`, transaction row written.
- Email client: `send()` is a no-op returning `skipped` when `RESEND_API_KEY` is
  unset; attempts a send when present.
- Notification creation shape.
- Existing credit tests remain green.

## Security Notes

- `role` is only mutable via the service-role admin action; the DB trigger blocks
  self-escalation through any RLS-governed update path.
- `admin_adjust_credits` is `SECURITY DEFINER` + service-role only; never callable
  by end users.
- Owner-only pages/actions enforce `requireOwner()` server-side; the sidebar
  hiding is UX only, not the security boundary.
- RLS keeps the catalog read-only for non-admins (unchanged).

## Acceptance Criteria

- [ ] An owner can open `/admin`, see the sidebar, and reach **Users**.
- [ ] An editor can open `/admin`, see/edit **Content**, and **cannot** see or
      reach **Users** (server-enforced).
- [ ] A normal user is redirected away from `/admin`.
- [ ] Owner can adjust any user's credits by an exact ± amount; the balance
      changes, a `credit_transactions` row is written, and the user receives an
      in-app notification (+ email when `RESEND_API_KEY` is set).
- [ ] Credits cannot be driven below zero.
- [ ] Owner can change a user's role and disable/enable an account.
- [ ] With `RESEND_API_KEY` unset, everything works and email is skipped silently.
- [ ] `npm run typecheck` and `npm test` pass.
