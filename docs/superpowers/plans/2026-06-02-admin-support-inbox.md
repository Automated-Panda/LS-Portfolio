# Admin Support / Feedback Inbox Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let logged-in users submit categorized feedback (floating button + account-menu item) and let owner/editor admins triage tickets in `/admin/support` (status, priority, internal notes), notifying the submitter in-app on status change.

**Architecture:** A pure support-domain module (`lib/support/tickets.ts`) holds the allowed values + validation and is unit-tested. A migration adds `support_tickets` + `support_ticket_notes`. A shared `FeedbackProvider`/`FeedbackWidget` (context) drives one modal from both the floating button and the user menu, submitting via a `"use server"` action. The admin inbox renders tickets (service-role reads) with client controls calling owner/editor-gated actions that reuse the Slice-2 notification system.

**Tech Stack:** Next.js (App Router, server actions, React context), Supabase (Postgres + RLS + service-role), TypeScript, Vitest, Tailwind + shadcn.

**Spec:** `docs/superpowers/specs/2026-06-02-admin-support-inbox-design.md`

**Note:** The spec sketched the submit action at `app/(app)/feedback-actions.ts`; this plan places it at `lib/support/feedback-actions.ts` so the shared `components/app-shell` widget imports it without a route-group (`(app)`) path. Same behavior.

---

## File Structure

- Create `lib/support/tickets.ts` (+ test) — pure values, labels, validation.
- Create `supabase/migrations/0028_support_tickets.sql` — tables + RLS + touch trigger.
- Modify `lib/notifications/messages.ts` (+ test) — add `ticketStatusNotification`.
- Create `lib/support/feedback-actions.ts` — `submitFeedback` server action.
- Create `components/app-shell/feedback.tsx` — `FeedbackProvider` / `useFeedback` / widget.
- Modify `components/app-shell/app-shell.tsx` — wrap in provider.
- Modify `components/app-shell/user-menu.tsx` — "Send feedback" item.
- Create `app/admin/support/page.tsx` — admin inbox page.
- Create `app/admin/support/actions.ts` — status/priority/note actions.
- Create `app/admin/support/admin-support-list.tsx` — client triage list.
- Modify `app/admin/layout.tsx` — Support sidebar link.

---

## Task 1: Pure support domain module

**Files:**
- Create: `lib/support/tickets.ts`
- Test: `lib/support/tickets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// lib/support/tickets.test.ts
import { describe, it, expect } from "vitest";
import {
  CATEGORIES,
  STATUSES,
  PRIORITIES,
  isValidCategory,
  isValidStatus,
  isValidPriority,
  categoryLabel,
  statusLabel,
  priorityLabel,
  validateFeedback,
} from "./tickets";

describe("option lists", () => {
  it("expose the six categories, six statuses, three priorities", () => {
    expect(CATEGORIES).toHaveLength(6);
    expect(STATUSES).toHaveLength(6);
    expect(PRIORITIES).toHaveLength(3);
  });
});

describe("validators", () => {
  it("accept known values and reject unknown", () => {
    expect(isValidCategory("bug")).toBe(true);
    expect(isValidCategory("nope")).toBe(false);
    expect(isValidStatus("in_review")).toBe(true);
    expect(isValidStatus("nope")).toBe(false);
    expect(isValidPriority("high")).toBe(true);
    expect(isValidPriority("nope")).toBe(false);
  });
});

describe("labels", () => {
  it("map values to human labels, falling back to the value", () => {
    expect(categoryLabel("bug")).toBe("Bug report");
    expect(statusLabel("in_review")).toBe("In review");
    expect(priorityLabel("high")).toBe("High");
    expect(statusLabel("unknown")).toBe("unknown");
  });
});

describe("validateFeedback", () => {
  it("accepts a valid submission", () => {
    expect(validateFeedback({ category: "bug", message: "It broke" })).toEqual({ ok: true });
  });
  it("rejects an unknown category", () => {
    expect(validateFeedback({ category: "x", message: "hi" }).ok).toBe(false);
  });
  it("rejects an empty message", () => {
    expect(validateFeedback({ category: "bug", message: "   " }).ok).toBe(false);
  });
  it("rejects an over-long message", () => {
    expect(validateFeedback({ category: "bug", message: "a".repeat(2001) }).ok).toBe(false);
  });
  it("rejects an over-long related item", () => {
    expect(
      validateFeedback({ category: "bug", message: "ok", relatedItem: "a".repeat(201) }).ok,
    ).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/support/tickets.test.ts`
Expected: FAIL — `Cannot find module './tickets'`.

- [ ] **Step 3: Write the implementation**

```ts
// lib/support/tickets.ts
// Pure support-ticket domain: allowed values, labels, and feedback validation.
// The value strings here MUST match the check constraints in
// supabase/migrations/0028_support_tickets.sql.

export type Option = { value: string; label: string };

export const CATEGORIES: Option[] = [
  { value: "bug", label: "Bug report" },
  { value: "feature", label: "Feature request" },
  { value: "data", label: "Incorrect data" },
  { value: "suggestion", label: "Suggestion" },
  { value: "general", label: "General feedback" },
  { value: "complaint", label: "Complaint" },
];

export const STATUSES: Option[] = [
  { value: "new", label: "New" },
  { value: "in_review", label: "In review" },
  { value: "planned", label: "Planned" },
  { value: "fixed", label: "Fixed" },
  { value: "rejected", label: "Rejected" },
  { value: "closed", label: "Closed" },
];

export const PRIORITIES: Option[] = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

const MAX_MESSAGE = 2000;
const MAX_RELATED = 200;

function has(options: Option[], value: string): boolean {
  return options.some((o) => o.value === value);
}
function label(options: Option[], value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}

export const isValidCategory = (v: string): boolean => has(CATEGORIES, v);
export const isValidStatus = (v: string): boolean => has(STATUSES, v);
export const isValidPriority = (v: string): boolean => has(PRIORITIES, v);

export const categoryLabel = (v: string): string => label(CATEGORIES, v);
export const statusLabel = (v: string): string => label(STATUSES, v);
export const priorityLabel = (v: string): string => label(PRIORITIES, v);

export type FeedbackInput = {
  category: string;
  message: string;
  relatedItem?: string | null;
};

export function validateFeedback(
  input: FeedbackInput,
): { ok: true } | { ok: false; error: string } {
  if (!isValidCategory(input.category)) return { ok: false, error: "Pick a category." };
  const msg = input.message.trim();
  if (!msg) return { ok: false, error: "Please enter a message." };
  if (msg.length > MAX_MESSAGE) return { ok: false, error: "Message is too long." };
  if ((input.relatedItem ?? "").length > MAX_RELATED) {
    return { ok: false, error: "Related item is too long." };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/support/tickets.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/support/tickets.ts lib/support/tickets.test.ts
git commit -m "feat(support): pure ticket domain (values, labels, feedback validation)"
```

---

## Task 2: ticketStatusNotification

**Files:**
- Modify: `lib/notifications/messages.ts`
- Test: `lib/notifications/messages.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `lib/notifications/messages.test.ts` (keep the existing imports + tests; add `ticketStatusNotification` to the import and add this describe block):

```ts
import { ticketStatusNotification } from "./messages";

describe("ticketStatusNotification", () => {
  it("describes the ticket update with human-readable category + status", () => {
    const n = ticketStatusNotification("bug", "fixed");
    expect(n.type).toBe("support_update");
    expect(n.body).toContain("bug report");
    expect(n.body).toContain("Fixed");
    expect(n.data).toEqual({ category: "bug", status: "fixed" });
  });
});
```

(If the existing import line is `import { creditAdjustmentNotification } from "./messages";`, change it to `import { creditAdjustmentNotification, ticketStatusNotification } from "./messages";` instead of adding a second import line.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/notifications/messages.test.ts`
Expected: FAIL — `ticketStatusNotification is not a function` / not exported.

- [ ] **Step 3: Add the implementation**

Append to `lib/notifications/messages.ts` (after `creditAdjustmentNotification`):

```ts
import { categoryLabel, statusLabel } from "@/lib/support/tickets";

export function ticketStatusNotification(
  category: string,
  status: string,
): NotificationPayload {
  const cat = categoryLabel(category).toLowerCase();
  const st = statusLabel(status);
  return {
    type: "support_update",
    title: "Update on your feedback",
    body: `Your ${cat} was marked ${st}.`,
    data: { category, status },
  };
}
```

NOTE: put the `import` at the TOP of the file with the other imports (move it up if your editor appended it at the bottom) — `lib/support/tickets.ts` is pure, so importing it here is safe.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/notifications/messages.test.ts`
Expected: PASS (both the credit and the new ticket tests).

- [ ] **Step 5: Commit**

```bash
git add lib/notifications/messages.ts lib/notifications/messages.test.ts
git commit -m "feat(support): ticket-status notification payload"
```

---

## Task 3: Database migration

**Files:**
- Create: `supabase/migrations/0028_support_tickets.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 0028_support_tickets.sql
-- User-submitted support/feedback tickets + admin-only internal notes.

create table if not exists public.support_tickets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  category     text not null check (category in ('bug','feature','data','suggestion','general','complaint')),
  message      text not null,
  related_item text,
  priority     text not null default 'normal' check (priority in ('low','normal','high')),
  status       text not null default 'new' check (status in ('new','in_review','planned','fixed','rejected','closed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_support_tickets_status
  on public.support_tickets (status, created_at desc);

create or replace function public.touch_support_tickets_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_support_tickets_touch on public.support_tickets;
create trigger trg_support_tickets_touch
  before update on public.support_tickets
  for each row execute procedure public.touch_support_tickets_updated_at();

alter table public.support_tickets enable row level security;

-- Users may submit + read their own tickets. Admin reads/writes go through the
-- service-role client (bypasses RLS), so there are no admin policies here.
create policy "Users can insert own tickets"
  on public.support_tickets for insert
  with check (auth.uid() = user_id);

create policy "Users can view own tickets"
  on public.support_tickets for select
  using (auth.uid() = user_id);

-- Internal notes: admin-only. RLS enabled with NO policies => service-role only.
create table if not exists public.support_ticket_notes (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  author_id  uuid references auth.users(id),
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_ticket_notes_ticket
  on public.support_ticket_notes (ticket_id, created_at);

alter table public.support_ticket_notes enable row level security;
```

- [ ] **Step 2: Apply the migration to the GT Vault project**

Apply via the Supabase MCP `apply_migration` (project_id `bzoizaakcqzlvpraysjn`, name `0028_support_tickets`). If it errors, report the exact message — do not retry destructively.

- [ ] **Step 3: Verify the schema (non-destructive)**

Run via MCP `execute_sql` (project `bzoizaakcqzlvpraysjn`):

```sql
select
  (select count(*) from information_schema.tables where table_schema='public' and table_name='support_tickets') as tickets_tbl,
  (select count(*) from information_schema.tables where table_schema='public' and table_name='support_ticket_notes') as notes_tbl,
  (select count(*) from pg_policies where tablename='support_tickets') as ticket_policies;
```
Expected: `tickets_tbl = 1`, `notes_tbl = 1`, `ticket_policies = 2`. (Do NOT insert test rows — submission is exercised by the manual smoke later.)

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0028_support_tickets.sql
git commit -m "feat(support): migration for support_tickets + ticket notes"
```

---

## Task 4: User submission (action + widget + wiring)

**Files:**
- Create: `lib/support/feedback-actions.ts`
- Create: `components/app-shell/feedback.tsx`
- Modify: `components/app-shell/app-shell.tsx`
- Modify: `components/app-shell/user-menu.tsx`

- [ ] **Step 1: Create the submit server action**

```ts
// lib/support/feedback-actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { validateFeedback } from "@/lib/support/tickets";

export type FeedbackResult = { ok: true } | { error: string };

export async function submitFeedback(input: {
  category: string;
  message: string;
  relatedItem: string;
}): Promise<FeedbackResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in." };

  const v = validateFeedback({
    category: input.category,
    message: input.message,
    relatedItem: input.relatedItem,
  });
  if (!v.ok) return { error: v.error };

  const related = input.relatedItem.trim() || null;
  const { error } = await supabase.from("support_tickets").insert({
    user_id: user.id,
    category: input.category,
    message: input.message.trim(),
    related_item: related,
  });
  if (error) return { error: error.message };
  return { ok: true };
}
```

- [ ] **Step 2: Create the provider + widget**

```tsx
// components/app-shell/feedback.tsx
"use client";

import { MessageSquarePlus, X } from "lucide-react";
import { createContext, useContext, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/support/tickets";
import { submitFeedback } from "@/lib/support/feedback-actions";

type FeedbackContextValue = { open: () => void };
const FeedbackContext = createContext<FeedbackContextValue | null>(null);

export function useFeedback(): FeedbackContextValue {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error("useFeedback must be used within FeedbackProvider");
  return ctx;
}

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <FeedbackContext.Provider value={{ open: () => setIsOpen(true) }}>
      {children}
      <FeedbackWidget open={isOpen} onOpenChange={setIsOpen} />
    </FeedbackContext.Provider>
  );
}

function FeedbackWidget({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [category, setCategory] = useState(CATEGORIES[0].value);
  const [message, setMessage] = useState("");
  const [relatedItem, setRelatedItem] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setCategory(CATEGORIES[0].value);
    setMessage("");
    setRelatedItem("");
    setError(null);
    setDone(false);
  };

  const close = () => {
    onOpenChange(false);
    setTimeout(reset, 200);
  };

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const res = await submitFeedback({ category, message, relatedItem });
      if ("error" in res) setError(res.error);
      else setDone(true);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        aria-label="Send feedback"
        className="fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-[#84cc16] text-black shadow-lg transition-transform hover:scale-105"
      >
        <MessageSquarePlus className="h-5 w-5" />
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={close}
        >
          <div
            className="w-full max-w-md rounded-lg border bg-card p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold">Send feedback</h2>
              <button type="button" onClick={close} aria-label="Close">
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {done ? (
              <div className="py-6 text-center">
                <p className="text-sm">Thanks! Your feedback has been sent. 🙌</p>
                <Button className="mt-4" onClick={close}>
                  Done
                </Button>
              </div>
            ) : (
              <>
                <label className="mt-4 block text-sm font-medium">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <label className="mt-3 block text-sm font-medium">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  placeholder="Tell us what's on your mind…"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />

                <label className="mt-3 block text-sm font-medium">
                  Related item <span className="text-muted-foreground">(optional)</span>
                </label>
                <input
                  value={relatedItem}
                  onChange={(e) => setRelatedItem(e.target.value)}
                  placeholder="e.g. a vehicle name or page"
                  className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
                />

                {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={close} disabled={pending}>
                    Cancel
                  </Button>
                  <Button onClick={submit} disabled={pending}>
                    {pending ? "Sending…" : "Send"}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 3: Wrap the shell in the provider**

In `components/app-shell/app-shell.tsx`:

Add the import near the other `./` imports:
```tsx
import { FeedbackProvider } from "./feedback";
```

Wrap the entire returned tree. Change the `return (` opening from:
```tsx
  return (
    <div className="flex min-h-screen">
```
to:
```tsx
  return (
    <FeedbackProvider>
    <div className="flex min-h-screen">
```
and change the matching close at the end from:
```tsx
      <ConfirmDialogHost />
    </div>
  );
```
to:
```tsx
      <ConfirmDialogHost />
    </div>
    </FeedbackProvider>
  );
```

- [ ] **Step 4: Add the "Send feedback" item to the user menu**

In `components/app-shell/user-menu.tsx`:

Change the icon import line:
```tsx
import { LogOut, User as UserIcon } from "lucide-react";
```
to:
```tsx
import { LogOut, MessageSquarePlus, User as UserIcon } from "lucide-react";
```

Add the feedback import near the other imports:
```tsx
import { useFeedback } from "./feedback";
```

Inside the component, after `const initials = ...`:
```tsx
  const feedback = useFeedback();
```

Add a "Send feedback" item. Change this block:
```tsx
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <UserIcon className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
```
to:
```tsx
        <DropdownMenuItem asChild>
          <Link href="/profile" className="cursor-pointer">
            <UserIcon className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => feedback.open()}
          className="cursor-pointer"
        >
          <MessageSquarePlus className="mr-2 h-4 w-4" />
          Send feedback
        </DropdownMenuItem>
        <DropdownMenuSeparator />
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add lib/support/feedback-actions.ts components/app-shell/feedback.tsx components/app-shell/app-shell.tsx components/app-shell/user-menu.tsx
git commit -m "feat(support): user feedback widget (floating button + menu) + submit action"
```

---

## Task 5: Admin inbox (page + actions + list + sidebar)

**Files:**
- Create: `app/admin/support/actions.ts`
- Create: `app/admin/support/admin-support-list.tsx`
- Create: `app/admin/support/page.tsx`
- Modify: `app/admin/layout.tsx`

- [ ] **Step 1: Create the server actions**

```ts
// app/admin/support/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidStatus, isValidPriority } from "@/lib/support/tickets";
import { createNotification } from "@/lib/notifications/server";
import { ticketStatusNotification } from "@/lib/notifications/messages";

type Result = { ok: true } | { error: string };

export async function setTicketStatus(id: string, status: string): Promise<Result> {
  await requireAdmin();
  if (!isValidStatus(status)) return { error: "Invalid status." };

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
  await createNotification(t.user_id, ticketStatusNotification(t.category, status));

  revalidatePath("/admin/support");
  return { ok: true };
}

export async function setTicketPriority(id: string, priority: string): Promise<Result> {
  await requireAdmin();
  if (!isValidPriority(priority)) return { error: "Invalid priority." };

  const supabase = createAdminClient();
  const { error } = await supabase.from("support_tickets").update({ priority }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/admin/support");
  return { ok: true };
}

export async function addTicketNote(id: string, body: string): Promise<Result> {
  await requireAdmin();
  const text = body.trim();
  if (!text) return { error: "Note can't be empty." };

  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  const supabase = createAdminClient();
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

- [ ] **Step 2: Create the client triage list**

```tsx
// app/admin/support/admin-support-list.tsx
"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import {
  STATUSES,
  PRIORITIES,
  categoryLabel,
  statusLabel,
  priorityLabel,
} from "@/lib/support/tickets";
import { setTicketStatus, setTicketPriority, addTicketNote } from "./actions";

export type SupportTicketView = {
  id: string;
  email: string;
  category: string;
  message: string;
  relatedItem: string | null;
  priority: string;
  status: string;
  createdAt: string;
  notes: { id: string; body: string; createdAt: string }[];
};

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString();
}

export function AdminSupportList({ tickets }: { tickets: SupportTicketView[] }) {
  const [filter, setFilter] = useState("all");
  const shown = tickets.filter((t) => filter === "all" || t.status === filter);

  return (
    <div className="space-y-4">
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="rounded-md border bg-background px-3 py-2 text-sm"
      >
        <option value="all">All statuses</option>
        {STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <div className="space-y-3">
        {shown.map((t) => (
          <TicketCard key={t.id} ticket={t} />
        ))}
        {shown.length === 0 && (
          <p className="rounded-lg border p-6 text-center text-sm text-muted-foreground">
            No tickets{filter !== "all" ? " with this status" : ""}.
          </p>
        )}
      </div>
    </div>
  );
}

function TicketCard({ ticket }: { ticket: SupportTicketView }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const run = (fn: () => Promise<{ ok: true } | { error: string }>) => {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if ("error" in res) setError(res.error);
      else setNote("");
    });
  };

  return (
    <div className="rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{categoryLabel(ticket.category)}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{statusLabel(ticket.status)}</span>
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
          {priorityLabel(ticket.priority)}
        </span>
        <span className="text-muted-foreground">{ticket.email}</span>
        <span className="ml-auto text-xs text-muted-foreground">{fmtDate(ticket.createdAt)}</span>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm">{ticket.message}</p>
      {ticket.relatedItem && (
        <p className="mt-1 text-xs text-muted-foreground">Related: {ticket.relatedItem}</p>
      )}

      <div className="mt-3 flex flex-wrap gap-3">
        <label className="text-xs text-muted-foreground">
          Status
          <select
            value={ticket.status}
            disabled={pending}
            onChange={(e) => run(() => setTicketStatus(ticket.id, e.target.value))}
            className="ml-1 rounded border bg-background px-1.5 py-1 text-xs"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-muted-foreground">
          Priority
          <select
            value={ticket.priority}
            disabled={pending}
            onChange={(e) => run(() => setTicketPriority(ticket.id, e.target.value))}
            className="ml-1 rounded border bg-background px-1.5 py-1 text-xs"
          >
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {ticket.notes.length > 0 && (
        <div className="mt-3 space-y-1 border-l-2 pl-3">
          {ticket.notes.map((n) => (
            <p key={n.id} className="text-xs text-muted-foreground">
              {n.body} <span className="opacity-60">· {fmtDate(n.createdAt)}</span>
            </p>
          ))}
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add an internal note…"
          className="flex-1 rounded-md border bg-background px-3 py-1.5 text-sm"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={pending || !note.trim()}
          onClick={() => run(() => addTicketNote(ticket.id, note))}
        >
          Add
        </Button>
      </div>

      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 3: Create the page**

```tsx
// app/admin/support/page.tsx
import { requireAdmin } from "@/lib/admin/guard";
import { createAdminClient } from "@/lib/supabase/admin";

import { AdminSupportList, type SupportTicketView } from "./admin-support-list";

type TicketRow = {
  id: string;
  user_id: string;
  category: string;
  message: string;
  related_item: string | null;
  priority: string;
  status: string;
  created_at: string;
};
type NoteRow = { id: string; ticket_id: string; body: string; created_at: string };

export default async function AdminSupportPage() {
  await requireAdmin();

  const supabase = createAdminClient();
  const [{ data: tickets }, { data: notes }, { data: authData }] = await Promise.all([
    supabase.from("support_tickets").select("*").order("created_at", { ascending: false }),
    supabase
      .from("support_ticket_notes")
      .select("*")
      .order("created_at", { ascending: true }),
    supabase.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);

  const emailById = new Map((authData?.users ?? []).map((u) => [u.id, u.email ?? ""]));
  const notesByTicket = new Map<string, NoteRow[]>();
  for (const n of (notes ?? []) as NoteRow[]) {
    const arr = notesByTicket.get(n.ticket_id) ?? [];
    arr.push(n);
    notesByTicket.set(n.ticket_id, arr);
  }

  const rows: SupportTicketView[] = ((tickets ?? []) as TicketRow[]).map((t) => ({
    id: t.id,
    email: emailById.get(t.user_id) ?? "—",
    category: t.category,
    message: t.message,
    relatedItem: t.related_item,
    priority: t.priority,
    status: t.status,
    createdAt: t.created_at,
    notes: (notesByTicket.get(t.id) ?? []).map((n) => ({
      id: n.id,
      body: n.body,
      createdAt: n.created_at,
    })),
  }));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Support inbox</h1>
      <p className="text-sm text-muted-foreground">{rows.length} tickets</p>
      <AdminSupportList tickets={rows} />
    </div>
  );
}
```

- [ ] **Step 4: Add the sidebar link**

In `app/admin/layout.tsx`, find the Content group:
```tsx
          <div>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Content
            </p>
            <AdminNavLink href="/admin/vehicles">Vehicles</AdminNavLink>
            <AdminNavLink href="/admin/properties">Properties &amp; Businesses</AdminNavLink>
            <AdminNavLink href="/admin/upgrades">Upgrades</AdminNavLink>
          </div>
```
Add this block immediately AFTER it (still in `<nav>`, always shown to admins):
```tsx
          <div>
            <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
              Support
            </p>
            <AdminNavLink href="/admin/support">Inbox</AdminNavLink>
          </div>
```

- [ ] **Step 5: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Full test suite**

Run: `npm test`
Expected: all green, including `lib/support/tickets.test.ts` and the extended `lib/notifications/messages.test.ts`.

- [ ] **Step 7: Manual smoke (note for the executor — needs a browser)**

As a normal user: open the floating button AND the account-menu "Send feedback" — both open the modal; submit a bug with a message. As owner/editor: `/admin` sidebar shows **Support → Inbox**; the ticket appears; change its status → the submitter gets a 🔔 notification; set priority; add an internal note. A normal user can't reach `/admin`. (Do not block the commit on this step.)

- [ ] **Step 8: Commit**

```bash
git add app/admin/support/actions.ts app/admin/support/admin-support-list.tsx app/admin/support/page.tsx app/admin/layout.tsx
git commit -m "feat(support): owner/editor support inbox with status, priority & notes"
```

---

## Self-Review Notes (for the executor)

- **Spec coverage:** submission from floating button + menu (Task 4), category/message/related-item (Tasks 1, 4), tickets + notes tables + RLS (Task 3), inbox for owner+editor (Task 5 `requireAdmin`), status/priority/notes + status filter (Task 5), notify-on-status-change (Tasks 2, 5), internal notes admin-only (Task 3 no-policy + service-role reads), validation (Task 1).
- **Type consistency:** support values/labels defined once in `lib/support/tickets.ts`; `SupportTicketView` defined once in `admin-support-list.tsx` and imported by the page; `NotificationPayload` reused from `messages.ts`; action result shape `{ ok: true } | { error: string }` consistent.
- **Reuses Slice 2:** `createNotification` + `NotificationPayload`; the bell already renders any notification type, so `support_update` shows with no bell changes.
- **DB ↔ code sync:** the category/status/priority strings in `lib/support/tickets.ts` exactly match the migration's check constraints.
- **Deferred per spec:** assignment, "my tickets" page, email, attachments, logged-out contact form.
