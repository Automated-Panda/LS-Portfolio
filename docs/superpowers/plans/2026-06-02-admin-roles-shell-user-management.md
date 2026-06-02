# Admin Roles, Shell & User Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a role system (owner/editor/user), a role-aware sidebar admin shell, and an owner-only User Management page with audited credit adjustments that alert the user in-app + by email.

**Architecture:** A single SQL migration adds `profiles.role`, a self-escalation guard trigger, a `notifications` table, and an `admin_adjust_credits` RPC (reusing the existing `adjustment` credit reason). Server-side role resolution treats `ADMIN_EMAIL` as an owner bootstrap. The admin layout becomes a sidebar that hides owner-only sections from editors. Credit adjustments flow through the service-role RPC, then fan out to an in-app notification and a best-effort Resend email that no-ops until `RESEND_API_KEY` is set.

**Tech Stack:** Next.js (App Router, server actions), Supabase (Postgres + RLS + service-role client), TypeScript, Vitest, Tailwind + shadcn/ui, Resend.

**Spec:** `docs/superpowers/specs/2026-06-02-admin-roles-shell-user-management-design.md`

---

## File Structure

**Database**
- Create `supabase/migrations/0027_admin_roles.sql` — role column + guard trigger + owner seed, `notifications` table + RLS, `admin_adjust_credits` RPC.

**Roles & access**
- Create `lib/admin/roles.ts` — pure role types + `resolveRole`/`isAdminRole`/`isOwnerRole`.
- Create `lib/admin/roles.test.ts`.
- Modify `lib/admin/guard.ts` — add `getRole`/`isOwner`/`requireOwner`; make `isAdmin` role-based.

**Credits**
- Create `lib/credits/adjust.ts` — pure `parseCreditDelta`.
- Create `lib/credits/adjust.test.ts`.
- Modify `lib/credits/server.ts` — add `adminAdjustCredits` (calls the RPC).

**Notifications**
- Create `lib/notifications/types.ts` — `NotificationRow`.
- Create `lib/notifications/messages.ts` — pure `creditAdjustmentNotification`.
- Create `lib/notifications/messages.test.ts`.
- Create `lib/notifications/server.ts` — `createNotification`/`listNotifications`/`unreadCount`.
- Create `lib/notifications/actions.ts` — `markAllNotificationsRead` server action.

**Email**
- Create `lib/email/templates/credits-adjusted.ts` — pure branded HTML builder.
- Create `lib/email/templates/credits-adjusted.test.ts`.
- Create `lib/email/client.ts` — Resend client + graceful `sendEmail`.
- Create `lib/email/send.ts` — `sendCreditsAdjustedEmail`.

**Admin UI**
- Modify `app/admin/layout.tsx` — sidebar shell, role-aware.
- Create `app/admin/admin-nav-link.tsx` — client active-link.
- Modify `app/admin/page.tsx` — overview with owner-only stat cards.
- Create `lib/admin/users-view.ts` — pure `buildUserRow`/`isBanned`.
- Create `lib/admin/users-view.test.ts`.
- Create `app/admin/users/page.tsx` — owner-only users page.
- Create `app/admin/users/actions.ts` — `adjustUserCredits`/`setUserRole`/`setUserDisabled`.
- Create `app/admin/users/admin-users-table.tsx` — client table + modals.

**App-shell notification bell**
- Create `components/app-shell/notification-bell.tsx` — client bell + dropdown.
- Modify `components/app-shell/app-shell.tsx` — render the bell in the header.
- Modify `app/(app)/layout.tsx` — fetch notifications + unread count, pass to `AppShell`.

**Config / docs**
- Modify `.env.local.example` — add `RESEND_API_KEY`, `EMAIL_FROM`.
- Modify `package.json` — add `resend` dependency.

---

## Task 1: Database migration

**Files:**
- Create: `supabase/migrations/0027_admin_roles.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0027_admin_roles.sql
-- Role system (owner/editor/user), per-user notifications, and a manual
-- admin credit-adjustment RPC for the User Management admin page.

-- ── profiles.role ────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'editor', 'owner'));

-- Seed the owner via the bootstrap email BEFORE the guard trigger exists.
update public.profiles p
  set role = 'owner'
  from auth.users u
  where u.id = p.id and lower(u.email) = lower('james@automatedpanda.com');

-- Prevent privilege escalation: an authenticated/anon caller (one whose JWT
-- carries a role claim that isn't 'service_role') may never change `role`.
-- Direct DB / migration connections have no JWT claims and are allowed.
create or replace function public.prevent_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_jwt_role text;
begin
  if new.role is distinct from old.role then
    v_jwt_role := nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role';
    if v_jwt_role is not null and v_jwt_role <> 'service_role' then
      raise exception 'Changing profiles.role is not permitted';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_profiles_prevent_role_change on public.profiles;
create trigger trg_profiles_prevent_role_change
  before update on public.profiles
  for each row execute procedure public.prevent_role_change();

-- ── notifications ────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, read_at);

alter table public.notifications enable row level security;

-- Users may read + mark-read their OWN notifications. There is intentionally no
-- insert policy: only the service-role client (createNotification) writes them.
create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can mark own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── admin_adjust_credits ─────────────────────────────────────────────────────
-- Manual, audited adjustment of the NEVER-EXPIRING bucket (balance_credits).
-- Clamps the bucket at zero, logs the ACTUAL applied delta (post-clamp) with the
-- existing 'adjustment' reason, and returns the user's new total balance.
create or replace function public.admin_adjust_credits(
  p_user_id uuid,
  p_delta   integer,
  p_note    text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_old   integer;
  v_new   integer;
  v_total integer;
begin
  if p_delta = 0 then
    raise exception 'admin_adjust_credits: delta must be non-zero';
  end if;

  -- Make sure a credits row exists (defaults fill the other buckets).
  insert into public.user_credits (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

  -- Lock the row, clamp at zero.
  select balance_credits into v_old
    from public.user_credits where user_id = p_user_id for update;
  v_new := greatest(0, v_old + p_delta);

  update public.user_credits
    set balance_credits = v_new
    where user_id = p_user_id;

  select free_monthly + sub_monthly + balance_credits into v_total
    from public.user_credits where user_id = p_user_id;

  insert into public.credit_transactions
    (user_id, delta, reason, bucket, balance_after, metadata)
    values (
      p_user_id,
      v_new - v_old,           -- actual applied delta (accounts for the zero clamp)
      'adjustment',
      'purchased',
      v_total,
      jsonb_build_object('note', p_note, 'admin', true)
    );

  return v_total;
end; $$;

-- Lock it down: only the service role (server) may adjust credits.
revoke all on function public.admin_adjust_credits(uuid, integer, text) from public;
revoke all on function public.admin_adjust_credits(uuid, integer, text) from anon;
revoke all on function public.admin_adjust_credits(uuid, integer, text) from authenticated;
grant execute on function public.admin_adjust_credits(uuid, integer, text) to service_role;
```

- [ ] **Step 2: Apply the migration to the GT Vault project**

Apply via the Supabase MCP (project ref `bzoizaakcqzlvpraysjn`) using `apply_migration` with name `0027_admin_roles`, or `supabase db push` if using the CLI against the linked project.

- [ ] **Step 3: Verify the schema landed**

Run this SQL (MCP `execute_sql`) and confirm: the `role` column exists with james = `owner`, the function exists, and the table exists.

```sql
select
  (select role from public.profiles p join auth.users u on u.id = p.id
     where lower(u.email) = lower('james@automatedpanda.com')) as owner_role,
  (select count(*) from pg_proc where proname = 'admin_adjust_credits') as fn_exists,
  (select count(*) from information_schema.tables
     where table_schema = 'public' and table_name = 'notifications') as notifications_exists;
```
Expected: `owner_role = owner`, `fn_exists = 1`, `notifications_exists = 1`.

- [ ] **Step 4: Smoke-test the RPC + clamp (pick a non-owner test user id)**

```sql
-- replace <UID> with a real non-owner user id from auth.users
select public.admin_adjust_credits('<UID>', 5, 'plan smoke test');   -- returns new total (+5)
select public.admin_adjust_credits('<UID>', -100, 'clamp test');     -- bucket clamps at 0
select balance_credits from public.user_credits where user_id = '<UID>'; -- expect 0
-- inspect the two audit rows:
select delta, reason, bucket, balance_after, metadata
  from public.credit_transactions where user_id = '<UID>' and reason = 'adjustment'
  order by created_at desc limit 2;
```
Expected: second adjustment's `delta` is the clamped applied amount (not -100), `balance_credits = 0`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0027_admin_roles.sql
git commit -m "feat(admin): migration for roles, notifications & admin_adjust_credits"
```

---

## Task 2: Pure role resolution + guard wiring

**Files:**
- Create: `lib/admin/roles.ts`
- Test: `lib/admin/roles.test.ts`
- Modify: `lib/admin/guard.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/admin/roles.test.ts
import { describe, it, expect } from "vitest";
import { resolveRole, isAdminRole, isOwnerRole } from "./roles";

const OWNER = "james@automatedpanda.com";

describe("resolveRole", () => {
  it("returns owner for the bootstrap email regardless of db role", () => {
    expect(resolveRole(null, OWNER, OWNER)).toBe("owner");
    expect(resolveRole("user", "JAMES@automatedpanda.com", OWNER)).toBe("owner");
  });
  it("honors the db role for non-bootstrap users", () => {
    expect(resolveRole("editor", "a@b.com", OWNER)).toBe("editor");
    expect(resolveRole("owner", "a@b.com", OWNER)).toBe("owner");
  });
  it("defaults unknown / null db roles to user", () => {
    expect(resolveRole(null, "a@b.com", OWNER)).toBe("user");
    expect(resolveRole("bogus", "a@b.com", OWNER)).toBe("user");
  });
  it("returns user when there is no email", () => {
    expect(resolveRole("owner", null, OWNER)).toBe("user");
  });
});

describe("isAdminRole / isOwnerRole", () => {
  it("admin = owner or editor", () => {
    expect(isAdminRole("owner")).toBe(true);
    expect(isAdminRole("editor")).toBe(true);
    expect(isAdminRole("user")).toBe(false);
  });
  it("owner only", () => {
    expect(isOwnerRole("owner")).toBe(true);
    expect(isOwnerRole("editor")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/admin/roles.test.ts`
Expected: FAIL — `Cannot find module './roles'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/admin/roles.ts
// Pure role policy. ADMIN_EMAIL is always treated as owner (lockout safety net);
// everyone else's access comes from profiles.role. No I/O so it stays testable.

export type Role = "user" | "editor" | "owner";

export function resolveRole(
  dbRole: string | null | undefined,
  email: string | null | undefined,
  ownerEmail: string | null | undefined,
): Role {
  if (!email) return "user";
  if (ownerEmail && email.toLowerCase() === ownerEmail.toLowerCase()) {
    return "owner";
  }
  if (dbRole === "owner" || dbRole === "editor") return dbRole;
  return "user";
}

export function isAdminRole(role: Role): boolean {
  return role === "owner" || role === "editor";
}

export function isOwnerRole(role: Role): boolean {
  return role === "owner";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/admin/roles.test.ts`
Expected: PASS.

- [ ] **Step 5: Wire the guard to use roles**

Replace the entire contents of `lib/admin/guard.ts` with:

```ts
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveRole, isAdminRole, isOwnerRole, type Role } from "./roles";

/**
 * Role resolution for the current request. profiles.role is the source of truth,
 * except ADMIN_EMAIL is ALWAYS owner (bootstrap / lockout safety net). Access is
 * enforced server-side here and re-checked in every admin server action.
 */
export async function getRole(): Promise<Role> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "user";
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return resolveRole(
    profile?.role ?? null,
    user.email ?? null,
    process.env.ADMIN_EMAIL ?? null,
  );
}

/** True for owner OR editor — may access /admin. */
export async function isAdmin(): Promise<boolean> {
  return isAdminRole(await getRole());
}

/** True for owner only — may access owner-only areas (users, revenue, etc.). */
export async function isOwner(): Promise<boolean> {
  return isOwnerRole(await getRole());
}

/** Throws if the caller can't access /admin — call at the top of admin actions. */
export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) {
    throw new Error("Forbidden: admin access required.");
  }
}

/** Throws if the caller isn't the owner — call at the top of owner-only actions. */
export async function requireOwner(): Promise<void> {
  if (!(await isOwner())) {
    throw new Error("Forbidden: owner access required.");
  }
}
```

- [ ] **Step 6: Verify nothing else broke**

Run: `npm run typecheck`
Expected: no errors. (Existing `requireAdmin` callers in `app/admin/actions.ts` keep working; editors now also pass them, which is intended.)

- [ ] **Step 7: Commit**

```bash
git add lib/admin/roles.ts lib/admin/roles.test.ts lib/admin/guard.ts
git commit -m "feat(admin): role resolution with owner-email bootstrap"
```

---

## Task 3: Credit-adjust parsing + server wrapper

**Files:**
- Create: `lib/credits/adjust.ts`
- Test: `lib/credits/adjust.test.ts`
- Modify: `lib/credits/server.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/credits/adjust.test.ts
import { describe, it, expect } from "vitest";
import { parseCreditDelta } from "./adjust";

describe("parseCreditDelta", () => {
  it("parses positive, signed and negative whole numbers", () => {
    expect(parseCreditDelta("50")).toEqual({ ok: true, delta: 50 });
    expect(parseCreditDelta("+50")).toEqual({ ok: true, delta: 50 });
    expect(parseCreditDelta("-20")).toEqual({ ok: true, delta: -20 });
    expect(parseCreditDelta("  15 ")).toEqual({ ok: true, delta: 15 });
  });
  it("rejects empty, zero, non-integer and oversized input", () => {
    expect(parseCreditDelta("").ok).toBe(false);
    expect(parseCreditDelta("0").ok).toBe(false);
    expect(parseCreditDelta("3.5").ok).toBe(false);
    expect(parseCreditDelta("abc").ok).toBe(false);
    expect(parseCreditDelta("9999999").ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/credits/adjust.test.ts`
Expected: FAIL — `Cannot find module './adjust'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// lib/credits/adjust.ts
// Pure parsing/validation of an admin-entered signed credit amount.

export type AdjustParse = { ok: true; delta: number } | { ok: false; error: string };

const MAX = 1_000_000;

export function parseCreditDelta(input: string): AdjustParse {
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, error: "Enter an amount." };
  const n = Number(trimmed);
  if (!Number.isInteger(n)) return { ok: false, error: "Amount must be a whole number." };
  if (n === 0) return { ok: false, error: "Amount can't be zero." };
  if (Math.abs(n) > MAX) return { ok: false, error: "That amount is too large." };
  return { ok: true, delta: n };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/credits/adjust.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the server wrapper**

Append to `lib/credits/server.ts` (after `grantCredits`):

```ts
/**
 * Manually adjust a user's NEVER-EXPIRING (purchased) credit bucket by `delta`
 * (may be negative). Clamps at zero in the DB, writes an audited 'adjustment'
 * transaction row, and returns the user's new total balance. Service-role only.
 */
export async function adminAdjustCredits(
  userId: string,
  delta: number,
  note: string | null,
): Promise<{ ok: true; total: number }> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("admin_adjust_credits", {
    p_user_id: userId,
    p_delta: delta,
    p_note: note,
  });
  if (error) throw new Error(`adminAdjustCredits RPC failed: ${error.message}`);
  return { ok: true, total: (data as number) ?? 0 };
}
```

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add lib/credits/adjust.ts lib/credits/adjust.test.ts lib/credits/server.ts
git commit -m "feat(credits): admin credit-adjust parsing + service-role wrapper"
```

---

## Task 4: Notifications library

**Files:**
- Create: `lib/notifications/types.ts`
- Create: `lib/notifications/messages.ts`
- Test: `lib/notifications/messages.test.ts`
- Create: `lib/notifications/server.ts`
- Create: `lib/notifications/actions.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/notifications/messages.test.ts
import { describe, it, expect } from "vitest";
import { creditAdjustmentNotification } from "./messages";

describe("creditAdjustmentNotification", () => {
  it("frames a positive delta as a gift", () => {
    const n = creditAdjustmentNotification(50, 80);
    expect(n.type).toBe("credit_adjustment");
    expect(n.title).toContain("received");
    expect(n.body).toContain("50");
    expect(n.body).toContain("80");
    expect(n.data).toEqual({ delta: 50, newTotal: 80 });
  });
  it("frames a negative delta as an adjustment, not a gift", () => {
    const n = creditAdjustmentNotification(-20, 10);
    expect(n.title).not.toContain("received");
    expect(n.body).toContain("-20");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/notifications/messages.test.ts`
Expected: FAIL — `Cannot find module './messages'`.

- [ ] **Step 3: Write the pure builder + types**

```ts
// lib/notifications/messages.ts
// Pure builders for notification payloads (no I/O).

export type NotificationPayload = {
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

export function creditAdjustmentNotification(
  delta: number,
  newTotal: number,
): NotificationPayload {
  const isGift = delta > 0;
  return {
    type: "credit_adjustment",
    title: isGift ? "🎁 You received credits!" : "Credit balance updated",
    body: isGift
      ? `An admin added ${delta} credits to your account. You now have ${newTotal}.`
      : `An admin adjusted your credits by ${delta}. You now have ${newTotal}.`,
    data: { delta, newTotal },
  };
}
```

```ts
// lib/notifications/types.ts
export type NotificationRow = {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/notifications/messages.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the server module**

```ts
// lib/notifications/server.ts
// Service-role insert + user-scoped (RLS) reads of notifications.
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { NotificationPayload } from "./messages";
import type { NotificationRow } from "./types";

/** Insert a notification for a user (service-role; bypasses RLS). */
export async function createNotification(
  userId: string,
  payload: NotificationPayload,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    data: payload.data,
  });
  if (error) throw new Error(`createNotification failed: ${error.message}`);
}

/** The current user's most recent notifications (RLS-scoped). */
export async function listNotifications(limit = 20): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listNotifications failed: ${error.message}`);
  return (data as NotificationRow[]) ?? [];
}

/** Count of the current user's unread notifications (RLS-scoped). */
export async function unreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw new Error(`unreadCount failed: ${error.message}`);
  return count ?? 0;
}
```

- [ ] **Step 6: Write the mark-read server action**

```ts
// lib/notifications/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/** Mark all of the current user's unread notifications as read. */
export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .eq("user_id", user.id);
  if (error) throw new Error(`markAllNotificationsRead failed: ${error.message}`);
  revalidatePath("/", "layout");
}
```

- [ ] **Step 7: Typecheck + commit**

Run: `npm run typecheck` (expected: no errors), then:

```bash
git add lib/notifications
git commit -m "feat(notifications): payloads, server reads/writes, mark-read action"
```

---

## Task 5: Email (Resend, graceful-degrade)

**Files:**
- Modify: `package.json` (add `resend`)
- Create: `lib/email/templates/credits-adjusted.ts`
- Test: `lib/email/templates/credits-adjusted.test.ts`
- Create: `lib/email/client.ts`
- Create: `lib/email/send.ts`

- [ ] **Step 1: Install Resend**

Run: `npm install resend`
Expected: `resend` appears in `package.json` dependencies.

- [ ] **Step 2: Write the failing template test**

```ts
// lib/email/templates/credits-adjusted.test.ts
import { describe, it, expect } from "vitest";
import { creditsAdjustedEmail } from "./credits-adjusted";

describe("creditsAdjustedEmail", () => {
  it("uses a gift subject + shows the amount and new balance for a positive delta", () => {
    const { subject, html } = creditsAdjustedEmail({ delta: 50, newBalance: 80 });
    expect(subject).toContain("received");
    expect(html).toContain("50");
    expect(html).toContain("80");
  });
  it("uses a neutral subject for a negative delta", () => {
    const { subject } = creditsAdjustedEmail({ delta: -20, newBalance: 10 });
    expect(subject).not.toContain("received");
  });
  it("escapes a note to prevent HTML injection", () => {
    const { html } = creditsAdjustedEmail({ delta: 5, newBalance: 5, note: "<script>x</script>" });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run lib/email/templates/credits-adjusted.test.ts`
Expected: FAIL — `Cannot find module './credits-adjusted'`.

- [ ] **Step 4: Write the pure template**

```ts
// lib/email/templates/credits-adjusted.ts
// Pure branded HTML for a manual admin credit adjustment. Mirrors the dark
// auth-email style in supabase/templates/*.html (logo, #0a0a0a bg, lime accent).

export type CreditsAdjustedEmail = { subject: string; html: string };

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function creditsAdjustedEmail(opts: {
  delta: number;
  newBalance: number;
  note?: string | null;
}): CreditsAdjustedEmail {
  const isGift = opts.delta > 0;
  const subject = isGift
    ? "🎁 You've received GT Vault credits"
    : "Your GT Vault credit balance changed";
  const headline = isGift ? "You've received credits!" : "Your credit balance changed";
  const lead = isGift
    ? `Good news — an admin has added <strong style="color:#84cc16;">${opts.delta} credits</strong> to your GT Vault account.`
    : `An admin has adjusted your GT Vault credits by <strong style="color:#f5f5f5;">${opts.delta}</strong>.`;
  const noteBlock = opts.note
    ? `<p style="margin:0 0 24px 0;font-size:14px;line-height:1.6;color:#a3a3a3;font-style:italic;">"${escapeHtml(
        opts.note,
      )}"</p>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="dark" />
<title>${headline}</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#0a0a0a;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background-color:#161616;border:1px solid #262626;border-radius:14px;">
          <tr>
            <td style="padding:36px 40px 28px 40px;border-bottom:1px solid #262626;">
              <img src="https://www.gtvault.app/logo-email.png" width="200" alt="GT Vault" style="display:block;border:0;outline:none;text-decoration:none;height:auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px 0;font-size:26px;line-height:1.25;font-weight:700;color:#f5f5f5;letter-spacing:-0.01em;">${headline}</h1>
              <p style="margin:0 0 20px 0;font-size:15px;line-height:1.6;color:#a3a3a3;">${lead}</p>
              ${noteBlock}
              <p style="margin:0 0 28px 0;font-size:15px;line-height:1.6;color:#a3a3a3;">Your balance is now <strong style="color:#f5f5f5;">${opts.newBalance} credits</strong>.</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="background-color:#84cc16;border-radius:6px;">
                    <a href="https://www.gtvault.app/credits" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#0a0a0a;text-decoration:none;border-radius:6px;">View your credits</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 40px 32px 40px;border-top:1px solid #262626;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#737373;">Credits power the GT Vault AI Organizer. Enjoy!</p>
            </td>
          </tr>
        </table>
        <p style="margin:24px 0 0 0;font-size:11px;color:#525252;">GT Vault — a GTA V asset tracker.</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return { subject, html };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run lib/email/templates/credits-adjusted.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the client (graceful-degrade)**

```ts
// lib/email/client.ts
// Resend wrapper. Best-effort: when RESEND_API_KEY is unset, send() is a no-op
// (returns { skipped: true }) so features are never blocked on email setup.
import "server-only";

import { Resend } from "resend";

let cached: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  if (!cached) cached = new Resend(key);
  return cached;
}

export type SendResult = { sent: boolean; skipped?: boolean; error?: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<SendResult> {
  const resend = getResend();
  if (!resend) {
    console.warn(`[email] RESEND_API_KEY unset — skipping email to ${opts.to}`);
    return { sent: false, skipped: true };
  }
  const from = process.env.EMAIL_FROM ?? "GT Vault <noreply@gtvault.app>";
  try {
    await resend.emails.send({
      from,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    return { sent: true };
  } catch (e) {
    console.error("[email] send failed:", e);
    return { sent: false, error: e instanceof Error ? e.message : String(e) };
  }
}
```

- [ ] **Step 7: Write the typed sender**

```ts
// lib/email/send.ts
import "server-only";

import { sendEmail, type SendResult } from "./client";
import { creditsAdjustedEmail } from "./templates/credits-adjusted";

export async function sendCreditsAdjustedEmail(
  to: string,
  opts: { delta: number; newBalance: number; note?: string | null },
): Promise<SendResult> {
  const { subject, html } = creditsAdjustedEmail(opts);
  return sendEmail({ to, subject, html });
}
```

- [ ] **Step 8: Typecheck + commit**

Run: `npm run typecheck` (expected: no errors), then:

```bash
git add package.json package-lock.json lib/email
git commit -m "feat(email): Resend client (graceful-degrade) + credits-adjusted template"
```

---

## Task 6: Admin sidebar shell + overview

**Files:**
- Create: `app/admin/admin-nav-link.tsx`
- Modify: `app/admin/layout.tsx`
- Modify: `app/admin/page.tsx`

- [ ] **Step 1: Write the active-link client component**

```tsx
// app/admin/admin-nav-link.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export function AdminNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const active = href === "/admin" ? pathname === "/admin" : pathname.startsWith(href);
  return (
    <Link
      href={href}
      className={cn(
        "block rounded-md px-2 py-1.5 text-sm transition-colors",
        active
          ? "bg-accent font-medium text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
      )}
    >
      {children}
    </Link>
  );
}
```

- [ ] **Step 2: Rework the admin layout into a sidebar shell**

Replace the entire contents of `app/admin/layout.tsx` with:

```tsx
import Link from "next/link";
import { redirect } from "next/navigation";

import { getRole } from "@/lib/admin/guard";
import { isAdminRole, isOwnerRole } from "@/lib/admin/roles";

import { AdminNavLink } from "./admin-nav-link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const role = await getRole();
  if (!isAdminRole(role)) redirect("/");
  const owner = isOwnerRole(role);

  return (
    <div className="flex min-h-screen">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col border-r bg-card p-4 md:flex">
        <Link href="/admin" className="text-lg font-semibold">
          ⚙️ GT Vault Admin
        </Link>
        <nav className="mt-6 flex flex-1 flex-col gap-6">
          <div>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Overview
            </p>
            <AdminNavLink href="/admin">Dashboard</AdminNavLink>
          </div>
          <div>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Content
            </p>
            <AdminNavLink href="/admin/vehicles">Vehicles</AdminNavLink>
            <AdminNavLink href="/admin/properties">Properties &amp; Businesses</AdminNavLink>
            <AdminNavLink href="/admin/upgrades">Upgrades</AdminNavLink>
          </div>
          {owner && (
            <div>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                People
              </p>
              <AdminNavLink href="/admin/users">Users</AdminNavLink>
            </div>
          )}
        </nav>
        <div className="mt-6 flex flex-col gap-2 border-t pt-4 text-sm">
          <a href="/admin/export" className="text-muted-foreground hover:underline">
            ⬇ Export backup
          </a>
          <Link href="/" className="text-muted-foreground hover:underline">
            ← Back to app
          </Link>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Rework the overview page with owner-only stat cards**

Replace the entire contents of `app/admin/page.tsx` with:

```tsx
import Link from "next/link";

import { getRole } from "@/lib/admin/guard";
import { isOwnerRole } from "@/lib/admin/roles";
import { createAdminClient } from "@/lib/supabase/admin";

const SECTIONS = [
  { href: "/admin/vehicles", title: "Vehicles", desc: "Edit price, availability, and vendors." },
  { href: "/admin/properties", title: "Properties & Businesses", desc: "Edit price, capacity, and garage flag." },
  { href: "/admin/upgrades", title: "Upgrades", desc: "Edit upgrade names, capacity, and price." },
];

async function ownerStats() {
  const supabase = createAdminClient();
  const [{ count: totalUsers }, { count: paidUsers }, { data: credits }] = await Promise.all([
    supabase.from("profiles").select("*", { count: "exact", head: true }),
    supabase.from("user_credits").select("*", { count: "exact", head: true }).eq("has_active_sub", true),
    supabase.from("user_credits").select("balance_credits"),
  ]);
  const outstanding = (credits ?? []).reduce(
    (sum, r) => sum + ((r as { balance_credits: number }).balance_credits ?? 0),
    0,
  );
  return { totalUsers: totalUsers ?? 0, paidUsers: paidUsers ?? 0, outstanding };
}

export default async function AdminHome() {
  const role = await getRole();
  const owner = isOwnerRole(role);
  const stats = owner ? await ownerStats() : null;

  return (
    <div className="space-y-8">
      {stats && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Total users", value: stats.totalUsers },
            { label: "Paid users", value: stats.paidUsers },
            { label: "Credits outstanding", value: stats.outstanding },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="rounded-lg border p-4 transition-colors hover:border-foreground/40"
          >
            <p className="font-medium">{s.title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add app/admin/admin-nav-link.tsx app/admin/layout.tsx app/admin/page.tsx
git commit -m "feat(admin): role-aware sidebar shell + owner overview stats"
```

---

## Task 7: User Management — view-model, page, actions, table

**Files:**
- Create: `lib/admin/users-view.ts`
- Test: `lib/admin/users-view.test.ts`
- Create: `app/admin/users/actions.ts`
- Create: `app/admin/users/admin-users-table.tsx`
- Create: `app/admin/users/page.tsx`

- [ ] **Step 1: Write the failing view-model test**

```ts
// lib/admin/users-view.test.ts
import { describe, it, expect } from "vitest";
import { buildUserRow, isBanned } from "./users-view";

const NOW = 1_700_000_000_000;
const OWNER = "james@automatedpanda.com";

function base() {
  return {
    id: "u1",
    email: "a@b.com",
    createdAt: "2026-01-01T00:00:00Z",
    lastSignInAt: "2026-06-01T00:00:00Z",
    bannedUntil: null as string | null,
    displayName: "Alice",
    username: "alice",
    dbRole: "user" as string | null,
    ownerEmail: OWNER,
    credits: { freeMonthly: 10, subMonthly: 0, balanceCredits: 20, hasActiveSub: false },
    nowMs: NOW,
  };
}

describe("isBanned", () => {
  it("is false for null and past bans, true for a future ban", () => {
    expect(isBanned(null, NOW)).toBe(false);
    expect(isBanned("2020-01-01T00:00:00Z", NOW)).toBe(false);
    expect(isBanned("2999-01-01T00:00:00Z", NOW)).toBe(true);
  });
});

describe("buildUserRow", () => {
  it("sums credits and derives a Free plan with no active sub", () => {
    const row = buildUserRow(base());
    expect(row.credits).toBe(30);
    expect(row.plan).toBe("Free");
    expect(row.disabled).toBe(false);
    expect(row.role).toBe("user");
  });
  it("derives a Pro plan when the sub is active", () => {
    const row = buildUserRow({ ...base(), credits: { freeMonthly: 0, subMonthly: 250, balanceCredits: 0, hasActiveSub: true } });
    expect(row.plan).toBe("Pro");
    expect(row.hasActiveSub).toBe(true);
  });
  it("treats the owner email as owner regardless of db role", () => {
    expect(buildUserRow({ ...base(), email: OWNER, dbRole: "user" }).role).toBe("owner");
  });
  it("reports zero credits when there is no credits row", () => {
    expect(buildUserRow({ ...base(), credits: null }).credits).toBe(0);
  });
  it("marks an account disabled when banned in the future", () => {
    expect(buildUserRow({ ...base(), bannedUntil: "2999-01-01T00:00:00Z" }).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/admin/users-view.test.ts`
Expected: FAIL — `Cannot find module './users-view'`.

- [ ] **Step 3: Write the pure view-model**

```ts
// lib/admin/users-view.ts
// Pure assembly of the admin Users table row from auth + profile + credits data.
import { resolveRole, type Role } from "./roles";

export type AdminUserRow = {
  id: string;
  email: string;
  displayName: string | null;
  username: string | null;
  role: Role;
  plan: "Free" | "Pro";
  disabled: boolean;
  hasActiveSub: boolean;
  credits: number;
  signupAt: string;
  lastSignInAt: string | null;
};

export function isBanned(bannedUntil: string | null, nowMs: number): boolean {
  if (!bannedUntil) return false;
  const t = new Date(bannedUntil).getTime();
  return Number.isFinite(t) && t > nowMs;
}

export function buildUserRow(input: {
  id: string;
  email: string;
  createdAt: string;
  lastSignInAt: string | null;
  bannedUntil: string | null;
  displayName: string | null;
  username: string | null;
  dbRole: string | null;
  ownerEmail: string | null;
  credits: {
    freeMonthly: number;
    subMonthly: number;
    balanceCredits: number;
    hasActiveSub: boolean;
  } | null;
  nowMs: number;
}): AdminUserRow {
  const role = resolveRole(input.dbRole, input.email, input.ownerEmail);
  const hasActiveSub = input.credits?.hasActiveSub ?? false;
  const credits = input.credits
    ? input.credits.freeMonthly + input.credits.subMonthly + input.credits.balanceCredits
    : 0;
  return {
    id: input.id,
    email: input.email,
    displayName: input.displayName,
    username: input.username,
    role,
    plan: hasActiveSub ? "Pro" : "Free",
    disabled: isBanned(input.bannedUntil, input.nowMs),
    hasActiveSub,
    credits,
    signupAt: input.createdAt,
    lastSignInAt: input.lastSignInAt,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/admin/users-view.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the owner-only server actions**

```ts
// app/admin/users/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/admin/guard";
import type { Role } from "@/lib/admin/roles";
import { adminAdjustCredits } from "@/lib/credits/server";
import { parseCreditDelta } from "@/lib/credits/adjust";
import { createNotification } from "@/lib/notifications/server";
import { creditAdjustmentNotification } from "@/lib/notifications/messages";
import { sendCreditsAdjustedEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";

type Result = { ok: true } | { error: string };

const ASSIGNABLE_ROLES: Role[] = ["user", "editor", "owner"];
const BAN_FOREVER = "876000h"; // ~100 years

/** Adjust a user's credits by a signed amount, notify them in-app + by email. */
export async function adjustUserCredits(
  userId: string,
  amountInput: string,
  note: string,
): Promise<Result> {
  await requireOwner();

  const parsed = parseCreditDelta(amountInput);
  if (!parsed.ok) return { error: parsed.error };
  const trimmedNote = note.trim() || null;

  const { total } = await adminAdjustCredits(userId, parsed.delta, trimmedNote);

  // Alert the user — in-app always, email best-effort (never blocks).
  await createNotification(userId, creditAdjustmentNotification(parsed.delta, total));

  try {
    const supabase = createAdminClient();
    const { data } = await supabase.auth.admin.getUserById(userId);
    const email = data.user?.email;
    if (email) {
      await sendCreditsAdjustedEmail(email, {
        delta: parsed.delta,
        newBalance: total,
        note: trimmedNote,
      });
    }
  } catch (e) {
    console.error("[admin] credit-adjust email failed (non-fatal):", e);
  }

  revalidatePath("/admin/users");
  return { ok: true };
}

/** Change a user's role (service-role update bypasses the escalation trigger). */
export async function setUserRole(userId: string, role: Role): Promise<Result> {
  await requireOwner();
  if (!ASSIGNABLE_ROLES.includes(role)) return { error: "Invalid role." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}

/** Disable (ban) or re-enable a user account. */
export async function setUserDisabled(
  userId: string,
  disabled: boolean,
): Promise<Result> {
  await requireOwner();

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: disabled ? BAN_FOREVER : "none",
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}
```

- [ ] **Step 6: Write the client table**

```tsx
// app/admin/users/admin-users-table.tsx
"use client";

import { useState, useTransition } from "react";

import type { Role } from "@/lib/admin/roles";
import type { AdminUserRow } from "@/lib/admin/users-view";
import { Button } from "@/components/ui/button";
import { adjustUserCredits, setUserRole, setUserDisabled } from "./actions";

const ROLES: Role[] = ["user", "editor", "owner"];

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString();
}

export function AdminUsersTable({ users }: { users: AdminUserRow[] }) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<AdminUserRow | null>(null);

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      (u.displayName ?? "").toLowerCase().includes(q) ||
      (u.username ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-4">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or email…"
        className="w-full max-w-sm rounded-md border bg-background px-3 py-2 text-sm"
      />

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Plan</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2 text-right">Credits</th>
              <th className="px-3 py-2">Signup</th>
              <th className="px-3 py-2">Last login</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <UserRow key={u.id} user={u} onAdjust={() => setEditing(u)} />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                  No users match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <AdjustCreditsModal user={editing} onClose={() => setEditing(null)} />
      )}
    </div>
  );
}

function UserRow({ user, onAdjust }: { user: AdminUserRow; onAdjust: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const changeRole = (role: Role) => {
    setError(null);
    startTransition(async () => {
      const res = await setUserRole(user.id, role);
      if ("error" in res) setError(res.error);
    });
  };

  const toggleDisabled = () => {
    setError(null);
    startTransition(async () => {
      const res = await setUserDisabled(user.id, !user.disabled);
      if ("error" in res) setError(res.error);
    });
  };

  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-2">
        <div className="font-medium">{user.displayName || user.username || "—"}</div>
        <div className="text-xs text-muted-foreground">{user.email}</div>
        {error && <div className="text-xs text-red-500">{error}</div>}
      </td>
      <td className="px-3 py-2">
        <select
          value={user.role}
          disabled={pending}
          onChange={(e) => changeRole(e.target.value as Role)}
          className="rounded border bg-background px-1.5 py-1 text-xs"
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-2">{user.plan}</td>
      <td className="px-3 py-2">
        {user.disabled ? (
          <span className="text-red-500">Disabled</span>
        ) : (
          <span className="text-[#65a30d]">Active</span>
        )}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">{user.credits}</td>
      <td className="px-3 py-2">{fmtDate(user.signupAt)}</td>
      <td className="px-3 py-2">{fmtDate(user.lastSignInAt)}</td>
      <td className="px-3 py-2">
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="outline" onClick={onAdjust} disabled={pending}>
            Credits
          </Button>
          <Button size="sm" variant="outline" onClick={toggleDisabled} disabled={pending}>
            {user.disabled ? "Enable" : "Disable"}
          </Button>
        </div>
      </td>
    </tr>
  );
}

function AdjustCreditsModal({
  user,
  onClose,
}: {
  user: AdminUserRow;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await adjustUserCredits(user.id, amount, note);
      if ("error" in res) {
        setError(res.error);
      } else {
        onClose();
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-lg border bg-card p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">Adjust credits</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {user.email} — currently {user.credits} credits.
        </p>
        <label className="mt-4 block text-sm font-medium">Amount (use - to deduct)</label>
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 50 or -20"
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        <label className="mt-3 block text-sm font-medium">Note (optional)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. launch gift"
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
        />
        {error && <p className="mt-2 text-sm text-red-500">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={pending}>
            {pending ? "Saving…" : "Apply"}
          </Button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Write the owner-only users page**

```tsx
// app/admin/users/page.tsx
import { redirect } from "next/navigation";

import { isOwner } from "@/lib/admin/guard";
import { buildUserRow, type AdminUserRow } from "@/lib/admin/users-view";
import { createAdminClient } from "@/lib/supabase/admin";

import { AdminUsersTable } from "./admin-users-table";

type ProfileRow = { id: string; display_name: string | null; username: string | null; role: string | null };
type CreditRow = {
  user_id: string;
  free_monthly: number;
  sub_monthly: number;
  balance_credits: number;
  has_active_sub: boolean;
};

export default async function AdminUsersPage() {
  if (!(await isOwner())) redirect("/admin");

  const supabase = createAdminClient();
  const ownerEmail = process.env.ADMIN_EMAIL ?? null;
  const now = Date.now();

  const { data: authData, error: authErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (authErr) throw new Error(`listUsers failed: ${authErr.message}`);

  const [{ data: profiles }, { data: credits }] = await Promise.all([
    supabase.from("profiles").select("id, display_name, username, role"),
    supabase
      .from("user_credits")
      .select("user_id, free_monthly, sub_monthly, balance_credits, has_active_sub"),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [(p as ProfileRow).id, p as ProfileRow]));
  const creditByUser = new Map(
    (credits ?? []).map((c) => [(c as CreditRow).user_id, c as CreditRow]),
  );

  const rows: AdminUserRow[] = authData.users.map((u) => {
    const p = profileById.get(u.id);
    const c = creditByUser.get(u.id);
    return buildUserRow({
      id: u.id,
      email: u.email ?? "",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      bannedUntil: (u as { banned_until?: string | null }).banned_until ?? null,
      displayName: p?.display_name ?? null,
      username: p?.username ?? null,
      dbRole: p?.role ?? null,
      ownerEmail,
      credits: c
        ? {
            freeMonthly: c.free_monthly,
            subMonthly: c.sub_monthly,
            balanceCredits: c.balance_credits,
            hasActiveSub: c.has_active_sub,
          }
        : null,
      nowMs: now,
    });
  });

  rows.sort((a, b) => b.signupAt.localeCompare(a.signupAt));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Users</h1>
      <p className="text-sm text-muted-foreground">{rows.length} total</p>
      <AdminUsersTable users={rows} />
    </div>
  );
}
```

- [ ] **Step 8: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add lib/admin/users-view.ts lib/admin/users-view.test.ts app/admin/users
git commit -m "feat(admin): owner-only User Management page with credit/role/disable actions"
```

---

## Task 8: Notification bell in the app shell

**Files:**
- Create: `components/app-shell/notification-bell.tsx`
- Modify: `components/app-shell/app-shell.tsx`
- Modify: `app/(app)/layout.tsx`

- [ ] **Step 1: Write the bell client component**

```tsx
// components/app-shell/notification-bell.tsx
"use client";

import { Bell } from "lucide-react";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markAllNotificationsRead } from "@/lib/notifications/actions";
import type { NotificationRow } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

export function NotificationBell({
  notifications,
  unread,
}: {
  notifications: NotificationRow[];
  unread: number;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next && unread > 0) {
      startTransition(() => {
        void markAllNotificationsRead();
      });
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#84cc16] px-1 text-[10px] font-semibold text-black">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">
            You're all caught up.
          </p>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  "border-b px-2 py-2 last:border-0",
                  !n.read_at && "bg-accent/40",
                )}
              >
                <p className="text-sm font-medium">{n.title}</p>
                {n.body && <p className="mt-0.5 text-xs text-muted-foreground">{n.body}</p>}
              </div>
            ))}
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 2: Render the bell in the shell header**

In `components/app-shell/app-shell.tsx`:

Add the import near the other component imports:

```tsx
import { NotificationBell } from "./notification-bell";
```

Add two props to the `Props` type (after `displayName: string | null;`):

```tsx
  notifications: import("@/lib/notifications/types").NotificationRow[];
  unreadCount: number;
```

Add them to the destructured params (after `displayName,`):

```tsx
  notifications,
  unreadCount,
```

Replace the header's user area — change:

```tsx
          <div className="flex-1" />
          <UserMenu
            email={email}
            username={username}
            displayName={displayName}
          />
```

to:

```tsx
          <div className="flex-1" />
          <NotificationBell notifications={notifications} unread={unreadCount} />
          <UserMenu
            email={email}
            username={username}
            displayName={displayName}
          />
```

- [ ] **Step 3: Feed the bell from the app layout**

In `app/(app)/layout.tsx`:

Add imports near the top:

```tsx
import { listNotifications, unreadCount } from "@/lib/notifications/server";
```

Replace the `Promise.all` block:

```tsx
  const [{ data: profile }, counts] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .maybeSingle(),
    getOwnedCounts(user.id),
  ]);
```

with:

```tsx
  const [{ data: profile }, counts, notifications, unread] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .maybeSingle(),
    getOwnedCounts(user.id),
    listNotifications(),
    unreadCount(),
  ]);
```

And pass the new props to `<AppShell>`:

```tsx
    <AppShell
      email={user.email ?? ""}
      username={profile?.username ?? null}
      displayName={profile?.display_name ?? null}
      counts={counts}
      notifications={notifications}
      unreadCount={unread}
    >
      {children}
    </AppShell>
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add components/app-shell/notification-bell.tsx components/app-shell/app-shell.tsx "app/(app)/layout.tsx"
git commit -m "feat(notifications): app-shell bell with unread badge + mark-read on open"
```

---

## Task 9: Env docs + full verification

**Files:**
- Modify: `.env.local.example`

- [ ] **Step 1: Document the email env vars**

Add to `.env.local.example` (after the existing Stripe block):

```bash

# Resend transactional email (OPTIONAL).
# When unset, credit-gift emails are skipped silently (in-app alert still fires).
# Add the key + verify the gtvault.app domain in Resend to enable emails.
RESEND_API_KEY=
EMAIL_FROM="GT Vault <noreply@gtvault.app>"
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the new `roles`, `adjust`, `messages`, `credits-adjusted`, and `users-view` suites.

- [ ] **Step 3: Run the full typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Manual smoke test (dev server)**

Run: `npm run dev`, then verify:
- As the owner (james@…): `/admin` shows the sidebar incl. **People → Users**; the Users table lists all accounts; **Adjust credits** with `+50` updates the balance and (within the app) the target user sees a 🔔 unread badge + a "received credits" notification; **Disable** then **Enable** toggles status; **Change role** persists.
- Set a second account's role to `editor` (via the owner Users page), sign in as them: `/admin` shows **Content only** — no **People** section, and visiting `/admin/users` directly redirects to `/admin`.
- A normal user visiting `/admin` is redirected to `/`.
- With `RESEND_API_KEY` unset: the credit adjustment still succeeds and the in-app notification fires; the server logs `RESEND_API_KEY unset — skipping email`.

- [ ] **Step 5: Commit**

```bash
git add .env.local.example
git commit -m "docs(email): document RESEND_API_KEY / EMAIL_FROM (graceful-degrade)"
```

---

## Self-Review Notes (for the executor)

- **Spec coverage:** roles + bootstrap (Task 2), sidebar shell + role-aware sections (Task 6), Users table with role/plan/status/sub/credits/signup/last-login (Task 7), adjust ±/change-role/disable (Task 7), in-app notification (Tasks 4, 8), graceful email (Task 5), `admin_adjust_credits` clamping + audit (Task 1), security trigger (Task 1). Deferred items match the spec's Non-Goals.
- **Reused, not rebuilt:** the existing `adjustment` credit reason and `credit_transactions` audit table — no enum migration needed.
- **Type consistency:** `Role` is defined once in `lib/admin/roles.ts` and imported everywhere; `AdminUserRow` in `lib/admin/users-view.ts`; `NotificationRow` in `lib/notifications/types.ts`; `NotificationPayload` in `lib/notifications/messages.ts`.
- **Security boundary:** sidebar hiding is UX only; `isOwner()`/`requireOwner()` enforce server-side on the page and every action; the DB trigger blocks role self-escalation; `admin_adjust_credits` is service-role only.
