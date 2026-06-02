# Admin Dashboard

Internal control centre for GT Vault — manage catalog content, users, plans,
credits, and (in future) revenue, analytics, and support. Lives under `/admin`.

> **Status:** Slices 1 + 2 + 3 + 4 shipped to `main` on **2026-06-02**. Slices
> 5–6 are backlog. This doc is the living reference for the whole dashboard.

---

## 1. Roles & access

Three roles, stored on `profiles.role` (`'user' | 'editor' | 'owner'`, default
`'user'`):

| Role | Can access | Notes |
|------|-----------|-------|
| **owner** | Everything in `/admin` incl. **People → Users**, owner stats, all actions | Full control |
| **editor** | **Content only** (Vehicles, Properties & Businesses, Upgrades) | No users/revenue/billing |
| **user** | Nothing in `/admin` (redirected to `/`) | Normal app user |

**Owner bootstrap (lockout safety net):** the email in the `ADMIN_EMAIL` env var
(`james@automatedpanda.com`) **always** resolves to `owner`, regardless of the DB
`role` value. So you can never lock yourself out even if a role row is wrong.

**Security:**
- Role resolution is pure + tested: `lib/admin/roles.ts` (`resolveRole`,
  `isAdminRole`, `isOwnerRole`).
- Server guard: `lib/admin/guard.ts` — `getRole()`, `isAdmin()`, `isOwner()`,
  `requireAdmin()`, `requireOwner()`. Enforced in the admin layout (page access)
  AND at the top of every admin server action (write access). Sidebar hiding is
  UX only — the real boundary is server-side.
- A DB trigger (`prevent_role_change`) blocks anyone but the service role from
  changing `profiles.role`, so a user can never self-escalate via the normal
  profile-update path. Role changes flow only through the owner-only action.

---

## 2. Slice roadmap

The original vision (content mgmt, users, analytics, revenue, support, activity
log, draft/publish) was decomposed into 6 independently-shippable slices:

| # | Slice | Status |
|---|-------|--------|
| 1 | **Roles + Admin Shell** (sidebar, role-aware sections, owner overview stats) | ✅ Shipped 2026-06-02 |
| 2 | **User Management** (table + adjust credits / change role / disable) | ✅ Shipped 2026-06-02 |
| 3 | **Revenue tracking** (MRR, total revenue, active/cancelled subs, recent/failed payments, ARPU) | ✅ Shipped 2026-06-02 |
| 4 | **Support / Feedback inbox** (user-facing submit + admin triage: categories, statuses, priority, internal notes) | ✅ Shipped 2026-06-02 |
| 5 | **Content-mgmt upgrades** (image upload/replace via Supabase Storage, more editable fields, draft/publish, full `activity_log` table) | ⬜ Backlog |
| 6 | **Analytics overview** (total/new/active users, most-viewed items, searches, conversion, free vs paid + GA4/Search Console) — needs net-new event-tracking infra | ⬜ Backlog |

Spec: `docs/superpowers/specs/2026-06-02-admin-roles-shell-user-management-design.md`
Plan: `docs/superpowers/plans/2026-06-02-admin-roles-shell-user-management.md`

---

## 3. What shipped (Slice 1 + 2)

### Admin shell
- `/admin` is a **sidebar layout** (`app/admin/layout.tsx`): Overview, Content,
  and (owner-only) People sections. `app/admin/admin-nav-link.tsx` handles active
  highlighting.
- **Overview page** (`app/admin/page.tsx`): owner sees stat cards — Total users,
  Paid users, Credits outstanding — plus the content section cards. Editors see
  just the content cards.

### User Management — `/admin/users` (owner only)
Table of all accounts (joins `auth.users` ⨝ `profiles` ⨝ `user_credits`):
name, email, role, plan (Free/Pro from `has_active_sub`), status (active/
disabled), credits total, signup, last login. Searchable.

**Row actions** (all `requireOwner()`):
- **Adjust credits** — modal: enter a signed amount (`+50` to gift, `-20` to
  deduct) + optional note. Hits the never-expiring `balance_credits` bucket,
  clamped at ≥0, audited in `credit_transactions` (reason `adjustment`). The user
  is alerted in-app (and by email once Resend is configured — see §5).
- **Change role** — user / editor / owner.
- **Disable / enable** — Supabase `auth.admin` ban toggle (`ban_duration`).

> 💡 This UI **replaces manual SQL credit grants.** To gift a user credits: go to
> `/admin/users`, click **Credits** on their row, enter the amount, Apply.

### Notifications
- `notifications` table + bell in the app-shell header
  (`components/app-shell/notification-bell.tsx`): unread badge, dropdown list,
  mark-all-read on open. Credit gifts show "🎁 You received credits!".
- Library: `lib/notifications/` — `messages.ts` (pure payload builders),
  `server.ts` (service-role insert + RLS-scoped reads), `actions.ts`
  (`markAllNotificationsRead`), `types.ts`.

### Support / Feedback (Slice 4) — `/admin/support` (owner + editor)
- **Users submit** from a floating 💬 button (bottom-right, every logged-in page)
  AND a "Send feedback" item in the account menu — both drive one modal via a
  `FeedbackProvider` context. Fields: category (bug/feature/data/suggestion/
  general/complaint), message, optional related item. Action `submitFeedback`
  inserts with the user-scoped client (insert-own RLS).
- **Admins triage** at `/admin/support` (owner AND editor): filter by status,
  change **status** (New→In review→Planned→Fixed→Rejected→Closed) and **priority**
  (low/normal/high), and add **internal notes** (admin-only). A status change
  fires an in-app notification to the submitter (best-effort; reuses Slice 2).
- Tables: `support_tickets` (user-scoped RLS) + `support_ticket_notes`
  (RLS-enabled, **no policies** = service-role/admin-only). Pure domain +
  validation: `lib/support/tickets.ts` (unit-tested). Admin reads/writes via the
  service-role client in `app/admin/support/`.
- Deferred: assignment, a user "My tickets" page, email, attachments.

### Revenue (Slice 3) — `/admin/revenue` (owner only)
- Revenue dollars live **only in Stripe** (our DB stores credit deltas + Stripe
  IDs, never amounts), so the page reads **live from the Stripe API** each load —
  no caching/snapshot table.
- Shows: **MRR** (active subs), **total revenue** (gross — paid, non-refunded
  charges), **active / cancelled subs**, **ARPU** (MRR ÷ active), **plan
  breakdown** (Pro from subs; Starter/Plus from one-time packs, disambiguated by
  `hasInvoice` so a $9.99 renewal isn't counted as a one-time Plus), and **recent
  + failed payments** lists.
- **Test-mode badge** when `STRIPE_SECRET_KEY` is `sk_test_…`; graceful "Stripe
  unavailable" state if the key is missing/errors.
- Code: pure `lib/stripe/revenue-metrics.ts` (unit-tested) + server I/O
  `lib/stripe/revenue.ts` (normalizes Stripe subs + charges via `getStripe()`).
  Note: pinned Stripe API version dropped `Charge.invoice` from the typings, so
  `hasInvoice` uses a narrowing cast (the field is still on the wire).

---

## 4. Key files & DB objects

**Code map**
- Roles: `lib/admin/roles.ts`, `lib/admin/guard.ts`
- Users view-model (pure): `lib/admin/users-view.ts`
- Users page/actions/table: `app/admin/users/{page,actions,admin-users-table}.tsx`
- Credit adjust: `lib/credits/adjust.ts` (parse), `lib/credits/server.ts`
  (`adminAdjustCredits` → RPC)
- Notifications: `lib/notifications/*`, `components/app-shell/notification-bell.tsx`
- Email: `lib/email/{client,send}.ts`, `lib/email/templates/credits-adjusted.ts`
- Existing content editors (unchanged behaviour, now editor+owner): `app/admin/{vehicles,properties,upgrades}/`, `app/admin/actions.ts`

**Migration `0027_admin_roles.sql`** (already applied to live DB `bzoizaakcqzlvpraysjn`)
- `profiles.role` column + check constraint; owner seeded.
- `prevent_role_change()` trigger (anti-escalation).
- `notifications` table + RLS (select/update own; service-role-only insert) +
  unread index.
- `admin_adjust_credits(p_user_id, p_delta, p_note)` — `SECURITY DEFINER`,
  service-role only; clamps the purchased bucket at 0, logs the actual applied
  delta with the existing `adjustment` reason, returns the new total balance.

---

## 5. Resend email — follow-up to enable

Credit-adjust emails are **graceful-degrade**: they only send when
`RESEND_API_KEY` is set. Until then the in-app notification still fires and the
email is silently skipped. To turn emails on:

1. Create a Resend account; add the **gtvault.app** sending domain and verify its
   DNS records.
2. Set `RESEND_API_KEY` (and optionally `EMAIL_FROM`, default
   `GT Vault <noreply@gtvault.app>`) in the production env + local `.env.local`.
3. No code changes needed — emails start flowing immediately. The template
   (`lib/email/templates/credits-adjusted.ts`) matches the dark branded auth
   emails with the lime CTA to `/credits`.

---

## 6. Backlog / deferred (from the spec's non-goals)

- Saved/favourited items (net-new **user-facing** feature).
- Usage activity & analytics (Slice 6).
- Revenue dashboard (Slice 3); Support inbox (Slice 4).
- Image upload/replace, draft/publish, general `activity_log` table (Slice 5).
- CSV export of users (trivial add).
- Realtime push for notifications (bell + email cover it for now).
- A `developer` role (one-line migration to add when needed).
