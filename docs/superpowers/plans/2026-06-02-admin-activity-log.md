# Admin Activity Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record every admin mutation (content edits, image upload/remove, user-management, support triage) to an append-only `admin_activity_log`, and show it on an owner-only `/admin/activity` page.

**Architecture:** A pure formatter (`diffFields` + `actionLabel`) is unit-tested. A best-effort server helper `logAdminActivity` resolves the acting admin and inserts a row via the service-role client, swallowing its own errors so it can never break the underlying action. Each existing admin action gets one `logAdminActivity` call after its successful mutation.

**Tech Stack:** Next.js (App Router, server actions), Supabase (Postgres + RLS + service-role), TypeScript, Vitest, Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-02-admin-activity-log-design.md`

**Refinement vs spec:** `logAdminActivity` is **best-effort internally** (try/catch + `console.error`, returns void) — callers do NOT wrap it, keeping each wiring edit a single line.

---

## File Structure

- Create `lib/admin/activity-format.ts` (+ test) — pure `diffFields`, `actionLabel`.
- Create `lib/admin/activity.ts` — `logAdminActivity` (best-effort server helper).
- Create `supabase/migrations/0030_admin_activity_log.sql`.
- Modify `app/admin/actions.ts` — log content edits + image actions.
- Modify `app/admin/users/actions.ts` — log credits/role/disabled.
- Modify `app/admin/support/actions.ts` — log status/priority/note.
- Create `app/admin/activity/page.tsx` + `app/admin/activity/admin-activity-list.tsx`.
- Modify `app/admin/layout.tsx` — owner-only Activity sidebar link.

---

## Task 1: Pure activity formatter

**Files:**
- Create: `lib/admin/activity-format.ts`
- Test: `lib/admin/activity-format.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/admin/activity-format.test.ts
import { describe, it, expect } from "vitest";
import { diffFields, actionLabel } from "./activity-format";

describe("diffFields", () => {
  it("returns only the changed fields", () => {
    const before = { display_name: "Adder", price: 1000000 };
    const after = { display_name: "Adder", price: 1100000 };
    expect(diffFields(before, after, ["display_name", "price"])).toEqual([
      { field: "price", from: 1000000, to: 1100000 },
    ]);
  });
  it("treats missing values as null", () => {
    expect(diffFields({}, { neighborhood: "Vinewood" }, ["neighborhood"])).toEqual([
      { field: "neighborhood", from: null, to: "Vinewood" },
    ]);
  });
  it("compares arrays shallowly", () => {
    expect(diffFields({ vendors: ["a"] }, { vendors: ["a"] }, ["vendors"])).toEqual([]);
    expect(diffFields({ vendors: ["a"] }, { vendors: ["a", "b"] }, ["vendors"])).toEqual([
      { field: "vendors", from: ["a"], to: ["a", "b"] },
    ]);
  });
  it("only considers the listed fields", () => {
    expect(diffFields({ a: 1, b: 2 }, { a: 9, b: 9 }, ["b"])).toEqual([
      { field: "b", from: 2, to: 9 },
    ]);
  });
  it("returns empty when nothing changed", () => {
    expect(diffFields({ a: 1 }, { a: 1 }, ["a"])).toEqual([]);
  });
});

describe("actionLabel", () => {
  it("maps known codes to human labels", () => {
    expect(actionLabel("vehicle.update")).toBe("edited vehicle");
    expect(actionLabel("user.role")).toBe("changed role");
  });
  it("returns the code itself for unknown actions", () => {
    expect(actionLabel("mystery.code")).toBe("mystery.code");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/admin/activity-format.test.ts`
Expected: FAIL — `Cannot find module './activity-format'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/admin/activity-format.ts
// Pure formatting for the admin activity log (no I/O).

export type FieldChange = { field: string; from: unknown; to: unknown };

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  return false;
}

/** Diff the listed fields; missing values count as null. Returns only changes. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of fields) {
    const from = before[field] ?? null;
    const to = after[field] ?? null;
    if (!valuesEqual(from, to)) changes.push({ field, from, to });
  }
  return changes;
}

export const ACTION_LABELS: Record<string, string> = {
  "vehicle.update": "edited vehicle",
  "property.update": "edited property",
  "upgrade.update": "edited upgrade",
  "image.upload": "replaced image",
  "image.remove": "removed image",
  "user.credits": "adjusted credits",
  "user.role": "changed role",
  "user.disabled": "set account status",
  "ticket.status": "changed ticket status",
  "ticket.priority": "changed ticket priority",
  "ticket.note": "added ticket note",
};

export function actionLabel(code: string): string {
  return ACTION_LABELS[code] ?? code;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/admin/activity-format.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/activity-format.ts lib/admin/activity-format.test.ts
git commit -m "feat(activity): pure diff + action-label formatter"
```

---

## Task 2: Migration

**Files:**
- Create: `supabase/migrations/0030_admin_activity_log.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0030_admin_activity_log.sql
-- Append-only audit log of admin actions. Written + read only via the
-- service-role client (owner-gated page) — RLS on, no policies.
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
```

- [ ] **Step 2: Apply to the GT Vault project**

Apply via Supabase MCP `apply_migration` (project_id `bzoizaakcqzlvpraysjn`, name `0030_admin_activity_log`). Report exact errors if any; do not retry destructively.

- [ ] **Step 3: Verify (non-destructive)**

Run via MCP `execute_sql` (project `bzoizaakcqzlvpraysjn`):
```sql
select
  (select count(*) from information_schema.tables where table_schema='public' and table_name='admin_activity_log') as tbl,
  (select count(*) from pg_policies where tablename='admin_activity_log') as policies;
```
Expected: `tbl = 1`, `policies = 0`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0030_admin_activity_log.sql
git commit -m "feat(activity): admin_activity_log table"
```

---

## Task 3: Best-effort server helper

**Files:**
- Create: `lib/admin/activity.ts`

- [ ] **Step 1: Write the helper**

```ts
// lib/admin/activity.ts
// Best-effort audit logging. Resolves the acting admin and appends a row via the
// service-role client. NEVER throws — a logging failure must not break the action.
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FieldChange } from "./activity-format";

export type AdminActivityInput = {
  action: string;
  targetLabel?: string | null;
  targetId?: string | null;
  changes?: Record<string, unknown> | FieldChange[];
};

export async function logAdminActivity(input: AdminActivityInput): Promise<void> {
  try {
    const userClient = await createClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();

    const supabase = createAdminClient();
    const { error } = await supabase.from("admin_activity_log").insert({
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      action: input.action,
      target_label: input.targetLabel ?? null,
      target_id: input.targetId ?? null,
      changes: input.changes ?? {},
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("[admin] activity log failed (non-fatal):", e);
  }
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npm run typecheck` (expected: no errors), then:
```bash
git add lib/admin/activity.ts
git commit -m "feat(activity): best-effort logAdminActivity helper"
```

---

## Task 4: Log content + image actions

**Files:**
- Modify: `app/admin/actions.ts`

- [ ] **Step 1: Add imports**

At the top of `app/admin/actions.ts`, after the existing imports, add:
```ts
import { logAdminActivity } from "@/lib/admin/activity";
import { diffFields } from "@/lib/admin/activity-format";
```

- [ ] **Step 2: Log vehicle edits**

In `updateVehicleAdmin`, replace this tail:
```ts
  const supabase = createAdminClient();
  const { error } = await supabase.from("vehicles").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/vehicles");
  revalidatePath("/", "layout"); // keep public pages in sync
  return { ok: true };
}
```
with:
```ts
  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("vehicles")
    .select("display_name, price, availability, vendors")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("vehicles").update(update).eq("id", id);
  if (error) return { error: error.message };

  await logAdminActivity({
    action: "vehicle.update",
    targetId: id,
    targetLabel: ((before as Record<string, unknown> | null)?.display_name as string) ?? id,
    changes: diffFields((before ?? {}) as Record<string, unknown>, update, Object.keys(update)),
  });

  revalidatePath("/admin/vehicles");
  revalidatePath("/", "layout"); // keep public pages in sync
  return { ok: true };
}
```

- [ ] **Step 3: Log property edits**

In `updatePropertyAdmin`, replace this tail:
```ts
  const supabase = createAdminClient();
  const { error } = await supabase.from("properties").update(update).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/properties");
  revalidatePath("/", "layout");
  return { ok: true };
}
```
with:
```ts
  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("properties")
    .select("display_name, price, capacity, counts_as_garage, subtype_display, neighborhood")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("properties").update(update).eq("id", id);
  if (error) return { error: error.message };

  await logAdminActivity({
    action: "property.update",
    targetId: id,
    targetLabel: ((before as Record<string, unknown> | null)?.display_name as string) ?? id,
    changes: diffFields((before ?? {}) as Record<string, unknown>, update, Object.keys(update)),
  });

  revalidatePath("/admin/properties");
  revalidatePath("/", "layout");
  return { ok: true };
}
```

- [ ] **Step 4: Log upgrade edits**

In `updateUpgradeAdmin`, replace this tail:
```ts
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("property_upgrades")
    .update(update)
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/upgrades");
  revalidatePath("/", "layout");
  return { ok: true };
}
```
with:
```ts
  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("property_upgrades")
    .select("display_name, capacity, price")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase
    .from("property_upgrades")
    .update(update)
    .eq("id", id);
  if (error) return { error: error.message };

  await logAdminActivity({
    action: "upgrade.update",
    targetId: id,
    targetLabel: ((before as Record<string, unknown> | null)?.display_name as string) ?? id,
    changes: diffFields((before ?? {}) as Record<string, unknown>, update, Object.keys(update)),
  });

  revalidatePath("/admin/upgrades");
  revalidatePath("/", "layout");
  return { ok: true };
}
```

- [ ] **Step 5: Log image upload**

In `uploadCatalogImage`, replace this tail:
```ts
  const url = `${publicImageUrl(key)}?t=${Date.now()}`;
  const { error } = await supabase.from(entity).update({ image_path: url }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/admin/${entity}`);
  revalidatePath("/", "layout");
  return { ok: true, url };
}
```
with:
```ts
  const url = `${publicImageUrl(key)}?t=${Date.now()}`;
  const { error } = await supabase.from(entity).update({ image_path: url }).eq("id", id);
  if (error) return { error: error.message };

  const { data: row } = await supabase.from(entity).select("display_name").eq("id", id).maybeSingle();
  await logAdminActivity({
    action: "image.upload",
    targetId: id,
    targetLabel: ((row as Record<string, unknown> | null)?.display_name as string) ?? `${entity} ${id}`,
    changes: {},
  });

  revalidatePath(`/admin/${entity}`);
  revalidatePath("/", "layout");
  return { ok: true, url };
}
```

- [ ] **Step 6: Log image remove**

In `removeCatalogImage`, replace this tail:
```ts
  const supabase = createAdminClient();
  const { error } = await supabase.from(entity).update({ image_path: null }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath(`/admin/${entity}`);
  revalidatePath("/", "layout");
  return { ok: true, url: null };
}
```
with:
```ts
  const supabase = createAdminClient();
  const { data: row } = await supabase.from(entity).select("display_name").eq("id", id).maybeSingle();
  const { error } = await supabase.from(entity).update({ image_path: null }).eq("id", id);
  if (error) return { error: error.message };

  await logAdminActivity({
    action: "image.remove",
    targetId: id,
    targetLabel: ((row as Record<string, unknown> | null)?.display_name as string) ?? `${entity} ${id}`,
    changes: {},
  });

  revalidatePath(`/admin/${entity}`);
  revalidatePath("/", "layout");
  return { ok: true, url: null };
}
```

- [ ] **Step 7: Typecheck + commit**

Run: `npm run typecheck` (expected: no errors), then:
```bash
git add app/admin/actions.ts
git commit -m "feat(activity): log content edits + image actions"
```

---

## Task 5: Log user-management + support actions

**Files:**
- Modify: `app/admin/users/actions.ts`
- Modify: `app/admin/support/actions.ts`

- [ ] **Step 1: Users — add the import**

At the top of `app/admin/users/actions.ts`, after the existing imports, add:
```ts
import { logAdminActivity } from "@/lib/admin/activity";
```

- [ ] **Step 2: Log credit adjustments**

In `adjustUserCredits`, replace:
```ts
  revalidatePath("/admin/users");
  return { ok: true };
}

/** Change a user's role (service-role update bypasses the escalation trigger). */
```
with:
```ts
  await logAdminActivity({
    action: "user.credits",
    targetId: userId,
    targetLabel: userId,
    changes: { delta: parsed.delta, note: trimmedNote, newTotal: total },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

/** Change a user's role (service-role update bypasses the escalation trigger). */
```

- [ ] **Step 3: Log role changes**

In `setUserRole`, replace:
```ts
  const supabase = createAdminClient();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}
```
with:
```ts
  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };

  await logAdminActivity({
    action: "user.role",
    targetId: userId,
    targetLabel: userId,
    changes: { from: (before as { role?: string } | null)?.role ?? null, to: role },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}
```

- [ ] **Step 4: Log disable/enable**

In `setUserDisabled`, replace:
```ts
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: disabled ? BAN_FOREVER : "none",
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/users");
  return { ok: true };
}
```
with:
```ts
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: disabled ? BAN_FOREVER : "none",
  });
  if (error) return { error: error.message };

  await logAdminActivity({
    action: "user.disabled",
    targetId: userId,
    targetLabel: userId,
    changes: { to: disabled },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}
```

- [ ] **Step 5: Support — add the import**

At the top of `app/admin/support/actions.ts`, after the existing imports, add:
```ts
import { logAdminActivity } from "@/lib/admin/activity";
```

- [ ] **Step 6: Log ticket status**

In `setTicketStatus`, replace this block (the `select` already fetches the ticket — extend it to include `status`):
```ts
  const supabase = createAdminClient();
  const { data: ticket, error: fetchErr } = await supabase
    .from("support_tickets")
    .select("user_id, category")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { error: fetchErr.message };
  if (!ticket) return { error: "Ticket not found." };

  const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  const t = ticket as { user_id: string; category: string };
```
with:
```ts
  const supabase = createAdminClient();
  const { data: ticket, error: fetchErr } = await supabase
    .from("support_tickets")
    .select("user_id, category, status")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { error: fetchErr.message };
  if (!ticket) return { error: "Ticket not found." };

  const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  const t = ticket as { user_id: string; category: string; status: string };

  await logAdminActivity({
    action: "ticket.status",
    targetId: id,
    targetLabel: t.category,
    changes: { from: t.status, to: status },
  });
```

- [ ] **Step 7: Log ticket priority + note**

In `setTicketPriority`, replace:
```ts
  const supabase = createAdminClient();
  const { error } = await supabase.from("support_tickets").update({ priority }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/support");
  return { ok: true };
}
```
with:
```ts
  const supabase = createAdminClient();
  const { error } = await supabase.from("support_tickets").update({ priority }).eq("id", id);
  if (error) return { error: error.message };

  await logAdminActivity({
    action: "ticket.priority",
    targetId: id,
    targetLabel: id,
    changes: { to: priority },
  });

  revalidatePath("/admin/support");
  return { ok: true };
}
```

In `addTicketNote`, replace:
```ts
  const { error } = await supabase.from("support_ticket_notes").insert({
    ticket_id: id,
    author_id: user?.id ?? null,
    body: text,
  });
  if (error) return { error: error.message };

  revalidatePath("/admin/support");
  return { ok: true };
}
```
with:
```ts
  const { error } = await supabase.from("support_ticket_notes").insert({
    ticket_id: id,
    author_id: user?.id ?? null,
    body: text,
  });
  if (error) return { error: error.message };

  await logAdminActivity({
    action: "ticket.note",
    targetId: id,
    targetLabel: id,
    changes: { note: text },
  });

  revalidatePath("/admin/support");
  return { ok: true };
}
```

- [ ] **Step 8: Typecheck + commit**

Run: `npm run typecheck` (expected: no errors), then:
```bash
git add app/admin/users/actions.ts app/admin/support/actions.ts
git commit -m "feat(activity): log user-management + support actions"
```

---

## Task 6: Owner-only activity page + sidebar

**Files:**
- Create: `app/admin/activity/admin-activity-list.tsx`
- Create: `app/admin/activity/page.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Create the client list**

```tsx
// app/admin/activity/admin-activity-list.tsx
"use client";

import { useState } from "react";

import { actionLabel } from "@/lib/admin/activity-format";

export type ActivityEntry = {
  id: string;
  actorEmail: string | null;
  action: string;
  targetLabel: string | null;
  changes: unknown;
  createdAt: string;
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString();
}

function renderChanges(changes: unknown): React.ReactNode {
  if (Array.isArray(changes)) {
    return (
      <ul className="mt-1 space-y-0.5">
        {changes.map((c: { field: string; from: unknown; to: unknown }, i) => (
          <li key={i} className="text-xs text-muted-foreground">
            {c.field}: {String(c.from)} → {String(c.to)}
          </li>
        ))}
      </ul>
    );
  }
  if (changes && typeof changes === "object" && Object.keys(changes).length > 0) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        {Object.entries(changes as Record<string, unknown>)
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join(" · ")}
      </p>
    );
  }
  return null;
}

export function AdminActivityList({ entries }: { entries: ActivityEntry[] }) {
  const [filter, setFilter] = useState("all");
  const actions = Array.from(new Set(entries.map((e) => e.action))).sort();
  const shown = entries.filter((e) => filter === "all" || e.action === filter);

  return (
    <div className="space-y-4">
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="rounded-md border bg-background px-3 py-2 text-sm"
      >
        <option value="all">All actions</option>
        {actions.map((a) => (
          <option key={a} value={a}>
            {actionLabel(a)}
          </option>
        ))}
      </select>

      <div className="divide-y rounded-lg border">
        {shown.map((e) => (
          <div key={e.id} className="p-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{e.actorEmail ?? "—"}</span>
              <span className="text-muted-foreground">{actionLabel(e.action)}</span>
              {e.targetLabel && <span className="font-medium">{e.targetLabel}</span>}
              <span className="ml-auto text-xs text-muted-foreground">{fmt(e.createdAt)}</span>
            </div>
            {renderChanges(e.changes)}
          </div>
        ))}
        {shown.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No activity.</p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create the owner-only page**

```tsx
// app/admin/activity/page.tsx
import { redirect } from "next/navigation";

import { isOwner } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

import { AdminActivityList, type ActivityEntry } from "./admin-activity-list";

type LogRow = {
  id: string;
  actor_email: string | null;
  action: string;
  target_label: string | null;
  changes: unknown;
  created_at: string;
};

export default async function AdminActivityPage() {
  if (!(await isOwner())) redirect("/admin");

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("admin_activity_log")
    .select("id, actor_email, action, target_label, changes, created_at")
    .order("created_at", { ascending: false })
    .limit(200);

  const entries: ActivityEntry[] = ((data ?? []) as LogRow[]).map((r) => ({
    id: r.id,
    actorEmail: r.actor_email,
    action: r.action,
    targetLabel: r.target_label,
    changes: r.changes,
    createdAt: r.created_at,
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Activity log</h1>
      <p className="text-sm text-muted-foreground">Latest {entries.length} admin actions</p>
      <AdminActivityList entries={entries} />
    </div>
  );
}
```

- [ ] **Step 3: Add the owner-only sidebar link**

In `app/admin/layout.tsx`, find the owner-only Business group (added in Slice 3):
```tsx
          {owner && (
            <div>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Business
              </p>
              <AdminNavLink href="/admin/revenue">Revenue</AdminNavLink>
            </div>
          )}
```
Add this block immediately AFTER it (still inside `<nav>`):
```tsx
          {owner && (
            <div>
              <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
                Audit
              </p>
              <AdminNavLink href="/admin/activity">Activity</AdminNavLink>
            </div>
          )}
```
(If the Business group differs, add an equivalent owner-only group labelled "Audit" with an Activity link to `/admin/activity`.)

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 5: Full test suite**

Run: `npm test`
Expected: all green, including `lib/admin/activity-format.test.ts`.

- [ ] **Step 6: Manual smoke (note — needs a browser)**

As owner: edit a vehicle's price → `/admin/activity` shows `james@… edited vehicle <name>  price: old → new`. Replace an image, adjust credits, change a role, disable an account, change a ticket's status → each appears. The action filter narrows the list. An editor visiting `/admin/activity` is redirected to `/admin`. (Do not block the commit on this step.)

- [ ] **Step 7: Commit**

```bash
git add app/admin/activity/page.tsx app/admin/activity/admin-activity-list.tsx app/admin/layout.tsx
git commit -m "feat(activity): owner-only activity log page + sidebar"
```

---

## Self-Review Notes (for the executor)

- **Spec coverage:** table (Task 2), pure diff/label (Task 1), best-effort helper (Task 3), wiring for content+image (Task 4), users+support (Task 5), owner-only page + filter + sidebar (Task 6).
- **Best-effort:** `logAdminActivity` swallows its own errors, so none of the wired actions can fail because of logging — no per-site try/catch needed.
- **Type consistency:** `FieldChange` defined once in `activity-format.ts`; `AdminActivityInput` accepts a `FieldChange[]` (content edits) or a `Record` (other actions); `ActivityEntry` defined once in the list and imported by the page; the list renders both `changes` shapes.
- **Before/after:** content edits + role changes read the prior value first; ticket status reuses the already-fetched row (extended to include `status`).
- **Deferred per spec:** revert, pagination beyond 200, retention, binary image diffing.
