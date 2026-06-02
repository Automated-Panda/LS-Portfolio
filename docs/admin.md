# Admin Dashboard

Internal control centre for GT Vault — manage catalog content, images, users,
credits, revenue, support, and an audit trail of admin actions. Lives under
`/admin`.

> **Status:** Slices **1–5** (all sub-slices) shipped to `main` on **2026-06-02**.
> Only **Slice 6 (Analytics)** remains. This doc is the living reference for the
> whole dashboard.

---

## 1. Roles & access

Three roles, stored on `profiles.role` (`'user' | 'editor' | 'owner'`, default
`'user'`):

| Role | Can access | Notes |
|------|-----------|-------|
| **owner** | Everything in `/admin` (Content, **Users**, **Revenue**, **Support**, **Activity**), owner stats, all actions | Full control |
| **editor** | **Content** (Vehicles, Properties & Businesses, Upgrades) + **Support** inbox | No users/revenue/activity/billing |
| **user** | Nothing in `/admin` (redirected to `/`) | Normal app user |

**Owner bootstrap (lockout safety net):** the email in the `ADMIN_EMAIL` env var
(`james@automatedpanda.com`) **always** resolves to `owner`, regardless of the DB
`role` value — you can never lock yourself out.

**Security:**
- Pure role resolution: `lib/admin/roles.ts` (`resolveRole`, `isAdminRole`,
  `isOwnerRole`).
- Server guard: `lib/admin/guard.ts` — `getRole()`, `isAdmin()`, `isOwner()`,
  `requireAdmin()`, `requireOwner()`. Enforced in the admin layout (page access)
  AND at the top of every admin server action. Sidebar hiding is UX only — the
  real boundary is server-side.
- A DB trigger (`prevent_role_change`) blocks anyone but the service role from
  changing `profiles.role` (no self-escalation). Role changes flow only through
  the owner-only action.

### Sidebar map (role-aware)
- **Overview** → Dashboard (all admins)
- **Content** → Vehicles · Properties & Businesses · Upgrades (all admins)
- **Support** → Inbox (all admins)
- **People** → Users · **Business** → Revenue · **Audit** → Activity (owner only)

---

## 2. Slice roadmap

The original vision was decomposed into independently-shippable slices:

| # | Slice | Status |
|---|-------|--------|
| 1 | **Roles + Admin Shell** (sidebar, role-aware sections, owner overview stats) | ✅ Shipped 2026-06-02 |
| 2 | **User Management** (table + adjust credits / change role / disable) | ✅ Shipped 2026-06-02 |
| 3 | **Revenue tracking** (MRR, total revenue, active/cancelled subs, recent/failed payments, ARPU) | ✅ Shipped 2026-06-02 |
| 4 | **Support / Feedback inbox** (user submit + admin triage: status/priority/notes) | ✅ Shipped 2026-06-02 |
| 5a | **Image upload/replace** (vehicle + property images via Supabase Storage) | ✅ Shipped 2026-06-02 |
| 5b | **Activity log** (audit of all admin actions) | ✅ Shipped 2026-06-02 |
| 5c | **Draft/publish** (draft/published/archived catalog visibility) | ✅ Shipped 2026-06-02 |
| 6 | **Analytics overview** (total/new/active users, most-viewed items, searches, conversion, free vs paid + GA4/Search Console) — needs net-new event-tracking infra | ⬜ Backlog |

Each slice has its own spec + plan under `docs/superpowers/specs/` and
`docs/superpowers/plans/` (all dated 2026-06-02).

---

## 3. What shipped — by slice

### Roles + Admin Shell (Slice 1)
- `/admin` is a **sidebar layout** (`app/admin/layout.tsx`); `admin-nav-link.tsx`
  handles active highlighting; sections are role-aware (see §1).
- **Overview** (`app/admin/page.tsx`): owner sees stat cards (Total users, Paid
  users, Credits outstanding) + the content cards; editors see content only.

### User Management — `/admin/users` (Slice 2, owner only)
- Table joining `auth.users ⨝ profiles ⨝ user_credits`: name, email, role, plan
  (Free/Pro from `has_active_sub`), status, credits total, signup, last login.
- **Row actions** (all `requireOwner()`):
  - **Adjust credits** — signed amount (`+50` gift / `-20` deduct) + note. Hits the
    never-expiring `balance_credits` bucket, clamped ≥0, audited in
    `credit_transactions` (reason `adjustment`). Alerts the user in-app (+ email
    once Resend is set — see §5). **This replaces manual SQL credit grants.**
  - **Change role** (user/editor/owner) · **Disable/enable** (Supabase ban toggle).
- **Notifications** (built here, reused by later slices): `notifications` table +
  bell in the app-shell header (`components/app-shell/notification-bell.tsx`).
  Library `lib/notifications/*` (`messages` pure builders, `server` service-role
  insert + RLS reads, `actions` mark-read, `types`).

### Revenue — `/admin/revenue` (Slice 3, owner only)
- Revenue $ lives **only in Stripe**, so the page reads **live from the Stripe API**
  each load (no snapshot table). Shows MRR, total revenue (gross), active/cancelled
  subs, ARPU, plan breakdown, and recent + failed payments.
- Plan breakdown disambiguates a `$9.99` Pro renewal vs a one-time Plus via
  `hasInvoice`. **Test-data badge** for `sk_test_…` keys; graceful "Stripe
  unavailable" fallback.
- Pure `lib/stripe/revenue-metrics.ts` (tested) + I/O `lib/stripe/revenue.ts`.
  Note: pinned Stripe API version dropped `Charge.invoice` from the typings →
  `hasInvoice` uses a narrowing cast (field still on the wire).

### Support / Feedback — `/admin/support` (Slice 4, owner + editor)
- **Users submit** from a floating 💬 button + an account-menu "Send feedback" item
  (one modal via a `FeedbackProvider` context). Fields: category, message, optional
  related item. `submitFeedback` inserts via the user-scoped client (insert-own RLS).
- **Admins triage**: filter by status; change **status** (New→In review→Planned→
  Fixed→Rejected→Closed) and **priority**; add **internal notes** (admin-only). A
  status change notifies the submitter in-app (best-effort).
- Tables `support_tickets` (user-scoped RLS) + `support_ticket_notes` (RLS-enabled,
  **no policies** = service-role-only). Pure `lib/support/tickets.ts` (tested).

### Image upload/replace (Slice 5a) — vehicle + property editors
- **Replace/Remove** an image per row in `/admin/vehicles` + `/admin/properties`.
  Uploads go to a **public** Supabase Storage bucket `catalog-images` (migration
  0029) via the service-role action.
- **No schema column** — the absolute Storage URL (cache-busted `?t=`) is stored in
  the existing `image_path`; helpers `vehicleImageUrl`/`propertyImageUrl` return
  absolute URLs verbatim, else map a legacy basename to `/vehicles|properties/{name}`.
  So the ~1,016 legacy static images keep working.
- Pure `lib/admin/image-upload.ts` (≤5 MB; webp/png/jpeg; extension-less key
  `{entity}/{id}` = orphan-free). UI `app/admin/admin-image-cell.tsx`.
  `next.config.ts` allows `*.supabase.co` for `next/image`.

### Activity log (Slice 5b) — `/admin/activity` (owner only)
- Append-only `admin_activity_log` (migration 0030, RLS-no-policy → service-role
  only) records **every admin mutation**: content edits (with before→after diff),
  image upload/remove, user credits/role/disable, ticket status/priority/note.
- **Best-effort**: `logAdminActivity` (`lib/admin/activity.ts`) swallows its own
  errors, so logging can never break an action. Pure `lib/admin/activity-format.ts`
  (`diffFields`, `actionLabel`, tested). Owner page with an action-type filter.

### Draft/publish (Slice 5c) — catalog visibility
- Vehicles + properties get a `status`: **draft** / **published** / **archived**
  (migration 0031; existing rows default **published** — nothing disappeared).
- **How hiding works:** the public catalog SELECT **RLS policy** was scoped from
  `using(true)` to `using(status = 'published')`. Every public read uses the RLS
  client, so drafts/archived hide from the public **everywhere automatically** (no
  query edits). The admin editor pages were switched to `createAdminClient()`
  (bypasses RLS) so admins still see/edit all statuses.
- Status `<select>` per row (`app/admin/admin-status-cell.tsx`) → `setCatalogStatus`
  (`requireAdmin`, validated, logged). Pure `lib/catalog/status.ts`.
- ⚠️ A drafted/archived item a user OWNS also vanishes from their garage (the
  `!inner` joins drop it) — accepted as by-design (admin-only, rare).

---

## 4. Migrations & key files

**Migrations (all applied to live DB `bzoizaakcqzlvpraysjn`):**
- `0027_admin_roles.sql` — `profiles.role` + check; `prevent_role_change` trigger;
  `notifications` table + RLS; `admin_adjust_credits()` RPC (service-role, clamps
  ≥0, audited).
- `0028_support_tickets.sql` — `support_tickets` + `support_ticket_notes` (+ touch
  trigger, RLS).
- `0029_catalog_images_bucket.sql` — public `catalog-images` Storage bucket.
- `0030_admin_activity_log.sql` — `admin_activity_log` (RLS, no policies).
- `0031_catalog_status.sql` — `status` on vehicles+properties + published-only RLS
  SELECT policy.

**Code map:**
- Roles/guard: `lib/admin/roles.ts`, `lib/admin/guard.ts`
- Users: `lib/admin/users-view.ts`, `app/admin/users/*`; credit adjust
  `lib/credits/{adjust,server}.ts`
- Notifications: `lib/notifications/*`, `components/app-shell/notification-bell.tsx`
- Email: `lib/email/*` (graceful-degrade — see §5)
- Revenue: `lib/stripe/{revenue-metrics,revenue}.ts`, `app/admin/revenue/*`
- Support: `lib/support/*`, `app/admin/support/*`
- Images: `lib/admin/image-upload.ts`, `app/admin/admin-image-cell.tsx`
- Activity: `lib/admin/{activity,activity-format}.ts`, `app/admin/activity/*`
- Status: `lib/catalog/status.ts`, `app/admin/admin-status-cell.tsx`
- Shared content actions: `app/admin/actions.ts` (vehicle/property/upgrade edits,
  image upload/remove, `setCatalogStatus`)

---

## 5. Resend email — follow-up to enable

Credit-adjust emails are **graceful-degrade**: they only send when `RESEND_API_KEY`
is set. Until then the in-app notification still fires and the email is silently
skipped. To turn emails on:

1. Create a Resend account; add the **gtvault.app** sending domain + verify DNS.
2. Set `RESEND_API_KEY` (and optionally `EMAIL_FROM`, default
   `GT Vault <noreply@gtvault.app>`) in prod env + local `.env.local`.
3. No code changes needed. Template: `lib/email/templates/credits-adjusted.ts`.

---

## 6. Remaining / backlog

**Admin dashboard:**
- **Slice 6 — Analytics** (total/new/active users, most-viewed items, searches,
  conversion, free vs paid; needs net-new event-tracking infra + optional
  GA4/Search Console). The only admin slice left.

**Deferred enhancements (per slice specs):**
- User "My tickets" history page; support ticket assignment + attachments (Slice 4).
- Activity-log revert, pagination beyond 200, retention policy (5b).
- Draft/publish: "needs review"/owner-approval workflow, scheduled publish, status
  on upgrades, keeping owned hidden items visible to their owner (5c).
- CSV export of users; saved/favourited items (net-new user feature); realtime
  push for notifications; a `developer` role; image resize/optimize + migrating
  legacy images into Storage.

**Outside the admin dashboard (session backlog):** price filtering on
vehicles/properties/businesses · LSIA Warehouse seed gap · Resend setup (§5) ·
in-app tour / How-it-Works.
