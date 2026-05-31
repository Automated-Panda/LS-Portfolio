# AI Organizer Chat Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/organize` as a ChatGPT-style two-panel assistant — a conversation-thread rail, iMessage-style message bubbles, an animated thinking state, persisted/continuable threads, and pending-plan refinement.

**Architecture:** Add a `conversations` table + `organizer_plans.conversation_id`; the transcript is rebuilt from a thread's ordered plan rows (no messages table). The deterministic planner and intent parser are reused unchanged. New presentational components (rail, bubble, thinking, plan-card) compose inside the existing `organize-chat.tsx` client orchestrator, whose phase state gains thread + refinement tracking.

**Tech Stack:** Next.js 15 (App Router, RSC, server actions), Supabase (Postgres + RLS), TypeScript, Tailwind/shadcn-ui, lucide-react.

---

## Conventions for this plan

- **No unit-test runner exists.** "Verify" = `npm run typecheck`, `npm run build`, and the stated manual `npm run dev` checks. Do NOT add a test framework.
- **`npm run lint` is broken** (no ESLint config → interactive hang). Do NOT run it.
- **Branch:** all work on `feat/organizer-chat` (created Task 0). Commit per task with the message in its Commit step. Don't push until Task 12.
- **Live DB:** the migration (Task 1) is applied to the hosted Supabase via the Supabase MCP plugin (`apply_migration`) — the controller does this, not a subagent. Project ref: `bzoizaakcqzlvpraysjn`.
- **Brand green** is the literal `#84cc16` (user bubbles, send button, "New plan"). AI surfaces: `bg-[#161616]`, `border-[#262626]`. Keep the existing emerald accents inside the plan move-list. Icons: lucide-react (no emoji as structural icons; the ✨ avatar may stay as a `Sparkles` lucide icon).
- **Reduced motion:** the thinking dots/cycle must collapse to a static "Working…" under `prefers-reduced-motion` (Tailwind `motion-reduce:` variants).

---

## File Structure

- `supabase/migrations/0024_organizer_conversations.sql` — CREATE: `conversations` table + `organizer_plans.conversation_id`.
- `lib/queries/organizer.ts` — MODIFY: add `getConversations`, `getConversationTranscript`, types.
- `lib/organizer/types.ts` — MODIFY: add a `TranscriptEntry` UI type.
- `app/(app)/organize/actions.ts` — MODIFY: thread `conversation_id` through `generatePlan`; supersede pending plan on refine.
- `app/(app)/organize/page.tsx` — MODIFY: load conversations + active thread; pass to chat.
- `app/(app)/organize/organize-chat.tsx` — MODIFY: two-panel shell, transcript state, thread select, refinement phase.
- `components/portfolio/...` — none.
- `app/(app)/organize/conversation-rail.tsx` — CREATE: thread list + New plan + mobile drawer.
- `app/(app)/organize/message-bubble.tsx` — CREATE: one bubble (user/assistant).
- `app/(app)/organize/thinking-bubble.tsx` — CREATE: dots + rotating status.
- `app/(app)/organize/plan-card.tsx` — CREATE: restyled plan renderer (replaces `plan-renderer.tsx`).
- DELETE later: `app/(app)/organize/plan-renderer.tsx`, `recent-plans-list.tsx` (superseded; removed in Task 11).

---

## Task 0: Branch setup

- [ ] **Step 1: Create branch**

Run: `git checkout -b feat/organizer-chat`
Expected: `Switched to a new branch 'feat/organizer-chat'`

- [ ] **Step 2: Baseline**

Run: `npm run typecheck`
Expected: exits 0.

---

## Task 1: Conversations migration

**Files:**
- Create: `supabase/migrations/0024_organizer_conversations.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Threads for the AI organizer. A conversation groups multiple plan rows
-- (organizer_plans.conversation_id) into one continuable transcript.
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_conversations_user
  on public.conversations(user_id, updated_at desc);

alter table public.conversations enable row level security;

create policy "Users can view own conversations"
  on public.conversations for select using (auth.uid() = user_id);
create policy "Users can insert own conversations"
  on public.conversations for insert with check (auth.uid() = user_id);
create policy "Users can update own conversations"
  on public.conversations for update using (auth.uid() = user_id);
create policy "Users can delete own conversations"
  on public.conversations for delete using (auth.uid() = user_id);

create or replace function public.touch_conversation_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_conversations_touch on public.conversations;
create trigger trg_conversations_touch
  before update on public.conversations
  for each row execute procedure public.touch_conversation_updated_at();

alter table public.organizer_plans
  add column if not exists conversation_id uuid
    references public.conversations(id) on delete cascade;

create index if not exists idx_organizer_plans_conversation
  on public.organizer_plans(conversation_id, created_at);
```

- [ ] **Step 2: Apply to hosted DB (CONTROLLER does this)**

The controller applies this via the Supabase MCP `apply_migration` tool (name `organizer_conversations`, project `bzoizaakcqzlvpraysjn`), then verifies `conversations` exists and `organizer_plans.conversation_id` is present. A subagent should report this step as needing the controller and proceed to commit the file.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0024_organizer_conversations.sql
git commit -m "feat(db): organizer conversations table + plan.conversation_id"
```

---

## Task 2: Conversation queries + transcript type

**Files:**
- Modify: `lib/organizer/types.ts`
- Modify: `lib/queries/organizer.ts`

- [ ] **Step 1: Add the transcript UI type**

Append to `lib/organizer/types.ts`:

```ts
// ----- Rendered transcript entry (one request + its plan), UI-side -----

export type TranscriptEntry = {
  planId: string;
  prompt: string;
  steps: PlanStep[];
  summary: PlanSummary;
  status: string; // organizer_plan_status
};
```

- [ ] **Step 2: Add conversation queries**

In `lib/queries/organizer.ts`, add the `PlanSummary` import at the top (it already imports `PlanStep`):

```ts
import type { PlanStep, PlanSummary } from "@/lib/organizer/types";
```
Then append these exports:

```ts
export type ConversationRow = {
  id: string;
  title: string;
  updated_at: string;
};

export async function getConversations(
  userId: string,
  limit = 30,
): Promise<ConversationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// Rebuilds a thread's transcript from its ordered plan rows. Summary is
// derived from plan_steps (matches how the planner computes it).
export async function getConversationTranscript(
  conversationId: string,
): Promise<import("@/lib/organizer/types").TranscriptEntry[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("organizer_plans")
    .select("id, prompt, plan_steps, status")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });
  if (error || !data) return [];

  return data.map((row) => {
    const steps = (row.plan_steps as PlanStep[]) ?? [];
    const summary: PlanSummary = {
      total_steps: steps.length,
      cars_moved: steps.filter((s) => s.type === "move" && s.reason === "user-asked").length,
      cars_unassigned: steps.filter((s) => s.type === "unassign").length,
      displacements: steps.filter((s) => s.reason === "displaced").length,
      conflicts: [],
    };
    return { planId: row.id, prompt: row.prompt, steps, summary, status: row.status };
  });
}
```

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck`
Expected: exits 0.
```bash
git add lib/organizer/types.ts lib/queries/organizer.ts
git commit -m "feat(organizer): conversation queries + transcript type"
```

---

## Task 3: Thread conversation_id through generatePlan + refinement supersede

`generatePlan` must (a) attach plans to a conversation, creating one lazily for a new thread, and (b) when refining, replace the prior pending plan instead of stacking.

**Files:**
- Modify: `app/(app)/organize/actions.ts`

- [ ] **Step 1: Extend the generatePlan signature + result**

In `app/(app)/organize/actions.ts`, change the `GeneratePlanResult` type and `generatePlan` signature to carry conversation + supersede info:

```ts
export type GeneratePlanResult =
  | { ok: true; planId: string; conversationId: string; steps: PlanStep[]; summary: PlanSummary }
  | { ok: false; message: string };

export async function generatePlan(
  intent: ParsedIntent,
  prompt: string,
  opts?: { conversationId?: string; supersedePlanId?: string },
): Promise<GeneratePlanResult> {
```

- [ ] **Step 2: Create/resolve the conversation + supersede on refine**

Replace the persistence block (the `// Persist the plan with status='pending'.` insert and its error check, through the `return { ok: true, ... }`) with:

```ts
  // Resolve the conversation: reuse the passed thread, else create one titled
  // from this prompt (first request of a new thread).
  let conversationId = opts?.conversationId ?? null;
  if (!conversationId) {
    const { data: convo, error: convoErr } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, title: prompt.slice(0, 80) })
      .select("id")
      .single();
    if (convoErr || !convo) {
      return { ok: false, message: convoErr?.message ?? "Failed to start conversation." };
    }
    conversationId = convo.id;
  } else {
    // Touch the thread so it floats to the top of the rail.
    await supabase
      .from("conversations")
      .update({ title: undefined })
      .eq("id", conversationId)
      .eq("user_id", user.id);
  }

  // Refinement: drop the superseded pending plan so dead rows don't accumulate.
  if (opts?.supersedePlanId) {
    await supabase
      .from("organizer_plans")
      .delete()
      .eq("id", opts.supersedePlanId)
      .eq("user_id", user.id)
      .eq("status", "pending");
  }

  const { data: insertRow, error: insertErr } = await supabase
    .from("organizer_plans")
    .insert({
      user_id: user.id,
      conversation_id: conversationId,
      prompt,
      parsed_intent: intent,
      plan_steps: result.steps,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertErr || !insertRow) {
    return { ok: false, message: insertErr?.message ?? "Failed to save plan." };
  }

  return {
    ok: true,
    planId: insertRow.id,
    conversationId,
    steps: result.steps,
    summary: result.summary,
  };
```

> NOTE: the `.update({ title: undefined })` is a no-op write whose only purpose is to fire the `updated_at` touch trigger. If Supabase rejects an all-undefined update, replace it with `.update({ updated_at: new Date().toISOString() })`.

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck`
Expected: exits 0.
```bash
git add "app/(app)/organize/actions.ts"
git commit -m "feat(organizer): attach plans to conversations + supersede on refine"
```

---

## Task 4: Plan card component (restyled, in-bubble)

Replaces `plan-renderer.tsx`'s standalone styling with a version that sits inside an assistant bubble. Same data/actions.

**Files:**
- Create: `app/(app)/organize/plan-card.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/(app)/organize/plan-card.tsx
"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlanStep, PlanSummary } from "@/lib/organizer/types";

type Props = {
  summary: PlanSummary;
  steps: PlanStep[];
  onApply?: () => void;
  onChecklist?: () => void;
  onCancel?: () => void;
  isPending?: boolean;
  /** Read-only: rendered from history, no action buttons. */
  readOnly?: boolean;
};

export function PlanCard({
  summary, steps, onApply, onChecklist, onCancel, isPending, readOnly,
}: Props) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-neutral-100">
        Move {summary.cars_moved} cars
        {summary.displacements > 0 && ` · Displace ${summary.displacements}`}
        {summary.cars_unassigned > 0 && ` · ${summary.cars_unassigned} unassigned`}
      </p>
      {summary.conflicts.length > 0 && (
        <ul className="mb-2 text-xs text-amber-400">
          {summary.conflicts.map((c, i) => <li key={i}>⚠ {c}</li>)}
        </ul>
      )}
      <div className="mb-3 max-h-48 overflow-y-auto font-mono text-xs leading-relaxed text-neutral-400">
        {steps.slice(0, 8).map((s) => (
          <div key={s.index}>
            <span className={cn(s.reason === "displaced" ? "text-red-400" : "text-emerald-400")}>
              {s.reason === "displaced" ? "🔴 Displace" : "🟢 Move"}
            </span>{" "}
            {s.vehicle_label} · {s.from.label} → {s.to.label}
          </div>
        ))}
        {steps.length > 8 && (
          <div className="text-neutral-600">…{steps.length - 8} more</div>
        )}
      </div>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="bg-[#84cc16] text-black hover:bg-[#84cc16]/90"
            onClick={onApply}
            disabled={isPending}
          >
            ✓ Apply now
          </Button>
          <Button size="sm" variant="outline" onClick={onChecklist} disabled={isPending}>
            ☐ Just give me the checklist
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck`
Expected: exits 0.
```bash
git add "app/(app)/organize/plan-card.tsx"
git commit -m "feat(organizer): in-bubble plan card component"
```

---

## Task 5: Message bubble component

**Files:**
- Create: `app/(app)/organize/message-bubble.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/(app)/organize/message-bubble.tsx
import { Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

type Props = {
  role: "user" | "assistant";
  children: React.ReactNode;
  className?: string;
};

/**
 * One chat bubble. User messages: brand-green, right-aligned. Assistant:
 * dark surface with a Sparkles avatar, left-aligned. Children carry the text
 * or a rich card (plan / clarification).
 */
export function MessageBubble({ role, children, className }: Props) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div
          className={cn(
            "max-w-[80%] rounded-[14px_14px_4px_14px] bg-[#84cc16] px-3.5 py-2.5 text-sm font-medium text-black",
            className,
          )}
        >
          {children}
        </div>
      </div>
    );
  }
  return (
    <div className="flex max-w-[88%] gap-2">
      <Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#84cc16]" />
      <div
        className={cn(
          "rounded-[14px_14px_14px_4px] border border-[#262626] bg-[#161616] px-3.5 py-2.5 text-sm text-neutral-200",
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck`
Expected: exits 0.
```bash
git add "app/(app)/organize/message-bubble.tsx"
git commit -m "feat(organizer): message bubble component"
```

---

## Task 6: Thinking bubble component

**Files:**
- Create: `app/(app)/organize/thinking-bubble.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/(app)/organize/thinking-bubble.tsx
"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";

const PHASES = [
  "Reading your portfolio…",
  "Understanding the request…",
  "Planning the moves…",
];

export function ThinkingBubble() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % PHASES.length), 1600);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="flex max-w-[88%] gap-2">
      <Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#84cc16]" />
      <div className="rounded-[14px_14px_14px_4px] border border-[#262626] bg-[#161616] px-3.5 py-2.5">
        <div className="mb-1 flex gap-1 motion-reduce:hidden">
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#84cc16] [animation-delay:-0.3s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#84cc16] [animation-delay:-0.15s]" />
          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#84cc16]" />
        </div>
        <p className="text-xs text-neutral-400 motion-reduce:hidden">{PHASES[i]}</p>
        <p className="hidden text-xs text-neutral-400 motion-reduce:block">Working…</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck`
Expected: exits 0.
```bash
git add "app/(app)/organize/thinking-bubble.tsx"
git commit -m "feat(organizer): animated thinking bubble (reduced-motion aware)"
```

---

## Task 7: Conversation rail component

**Files:**
- Create: `app/(app)/organize/conversation-rail.tsx`

- [ ] **Step 1: Create the component**

```tsx
// app/(app)/organize/conversation-rail.tsx
"use client";

import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ConversationRow } from "@/lib/queries/organizer";

type Props = {
  conversations: ConversationRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
};

export function ConversationRail({ conversations, activeId, onSelect, onNew }: Props) {
  return (
    <div className="flex h-full flex-col bg-[#0d0d0d]">
      <div className="p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#84cc16] px-3 py-2 text-xs font-bold text-black hover:bg-[#84cc16]/90"
        >
          <Plus className="h-3.5 w-3.5" /> New plan
        </button>
      </div>
      <div className="px-3 pb-1 text-[10px] uppercase tracking-[0.18em] text-neutral-600">
        Recent
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="px-2 py-3 text-xs text-neutral-600">No plans yet.</p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "mb-0.5 block w-full truncate rounded-md px-2.5 py-2 text-left text-xs",
                c.id === activeId
                  ? "bg-[#1a1a1a] text-neutral-100"
                  : "text-neutral-400 hover:bg-[#161616] hover:text-neutral-200",
              )}
              title={c.title}
            >
              {c.title}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck`
Expected: exits 0.
```bash
git add "app/(app)/organize/conversation-rail.tsx"
git commit -m "feat(organizer): conversation rail component"
```

---

## Task 8: Rebuild organize-chat as the two-panel shell

The orchestrator gains: a transcript list, the active thread, the two-panel layout (rail + conversation with bubbles), and refinement tracking. This is the largest task.

**Files:**
- Modify: `app/(app)/organize/organize-chat.tsx`

- [ ] **Step 1: Replace the component**

Replace the entire contents of `app/(app)/organize/organize-chat.tsx` with:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  Clarification,
  ParsedIntent,
  PlanStep,
  PlanSummary,
  TranscriptEntry,
  Turn,
} from "@/lib/organizer/types";
import type { ConversationRow } from "@/lib/queries/organizer";
import type { OrganizerPlan } from "@/lib/queries/organizer";

import {
  applyPlan,
  dismissPlan,
  generatePlan,
  parseIntent,
} from "./actions";
import { getTranscript } from "./transcript-action";
import { ChecklistProgress } from "./checklist-progress";
import { ClarificationPills } from "./clarification-pills";
import { ConversationRail } from "./conversation-rail";
import { ExamplePills } from "./example-pills";
import { MessageBubble } from "./message-bubble";
import { PlanCard } from "./plan-card";
import { ThinkingBubble } from "./thinking-bubble";
import { UndoBanner } from "./undo-banner";

type Phase =
  | { kind: "idle" }
  | { kind: "thinking" }
  | { kind: "clarifying"; clarification: Clarification; history: Turn[]; originalPrompt: string }
  | { kind: "plan-ready"; planId: string; prompt: string; steps: PlanStep[]; summary: PlanSummary; priorTurns: Turn[] }
  | { kind: "applied"; planId: string; carsMoved: number; undoExpiresAt: string }
  | { kind: "checklist"; planId: string; steps: PlanStep[] }
  | { kind: "failed"; message: string };

type Props = {
  initialConversations: ConversationRow[];
  initialUndoablePlan: OrganizerPlan | null;
};

export function OrganizeChat({ initialConversations, initialUndoablePlan }: Props) {
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [input, setInput] = useState("");
  const [railOpen, setRailOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase>(() => {
    if (initialUndoablePlan) {
      const carsMoved = initialUndoablePlan.plan_steps.filter(
        (s) => s.type === "move" && s.reason === "user-asked",
      ).length;
      return {
        kind: "applied",
        planId: initialUndoablePlan.id,
        carsMoved,
        undoExpiresAt: initialUndoablePlan.undo_expires_at!,
      };
    }
    return { kind: "idle" };
  });

  const resetToNew = () => {
    setActiveConversationId(null);
    setTranscript([]);
    setPhase({ kind: "idle" });
    setInput("");
    setRailOpen(false);
  };

  const selectThread = (id: string) => {
    setRailOpen(false);
    startTransition(async () => {
      const entries = await getTranscript(id);
      setActiveConversationId(id);
      setTranscript(entries);
      setPhase({ kind: "idle" });
    });
  };

  const submit = (promptText: string) => {
    // Refinement: a follow-up while a plan is pending refines that same plan.
    const refining = phase.kind === "plan-ready";
    const priorTurns: Turn[] =
      phase.kind === "clarifying"
        ? [
            ...phase.history,
            { role: "assistant", clarification: phase.clarification },
            { role: "user", content: promptText },
          ]
        : phase.kind === "plan-ready"
          ? [...phase.priorTurns, { role: "user", content: promptText }]
          : [];

    const parsePrompt =
      phase.kind === "clarifying" ? phase.originalPrompt : promptText;
    const supersedePlanId = refining && phase.kind === "plan-ready" ? phase.planId : undefined;

    // Push the user's message into the transcript immediately.
    setTranscript((t) => [
      ...t,
      { planId: `tmp-${t.length}`, prompt: promptText, steps: [], summary: emptySummary(), status: "pending" },
    ]);
    setInput("");
    setPhase({ kind: "thinking" });

    startTransition(async () => {
      const parsed = await parseIntent(parsePrompt, priorTurns.length ? priorTurns : undefined);
      if ("error" in parsed) {
        toast.error(parsed.error);
        setPhase({ kind: "idle" });
        return;
      }
      if (!parsed.ok) {
        setPhase({
          kind: "clarifying",
          clarification: parsed.clarification,
          history: priorTurns,
          originalPrompt: parsePrompt,
        });
        return;
      }

      const planResult = await generatePlan(parsed.intent, parsePrompt, {
        conversationId: activeConversationId ?? undefined,
        supersedePlanId,
      });
      if (!planResult.ok) {
        setPhase({ kind: "failed", message: planResult.message });
        return;
      }
      setActiveConversationId(planResult.conversationId);
      setPhase({
        kind: "plan-ready",
        planId: planResult.planId,
        prompt: parsePrompt,
        steps: planResult.steps,
        summary: planResult.summary,
        priorTurns,
      });
      // Refresh the rail (new thread / bumped order).
      router.refresh();
    });
  };

  const handleApply = (planId: string, carsMoved: number) => {
    startTransition(async () => {
      const r = await applyPlan(planId);
      if ("ok" in r) {
        setPhase({ kind: "applied", planId, carsMoved, undoExpiresAt: r.undoExpiresAt });
        toast.success("Plan applied.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  const handleCancel = (planId: string) => {
    startTransition(async () => {
      await dismissPlan(planId);
      setPhase({ kind: "idle" });
      router.refresh();
    });
  };

  // The settled plan that belongs to the latest transcript turn, if any.
  const liveCard =
    phase.kind === "plan-ready"
      ? { steps: phase.steps, summary: phase.summary }
      : null;

  return (
    <div className="mx-auto flex h-[calc(100vh-3.5rem)] max-w-5xl overflow-hidden rounded-lg border border-[#1f1f1f]">
      {/* RAIL — desktop static, mobile drawer */}
      <aside className="hidden w-60 shrink-0 border-r border-[#1f1f1f] md:block">
        <ConversationRail
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={selectThread}
          onNew={resetToNew}
        />
      </aside>
      {railOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setRailOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-[#1f1f1f]" onClick={(e) => e.stopPropagation()}>
            <ConversationRail
              conversations={conversations}
              activeId={activeConversationId}
              onSelect={selectThread}
              onNew={resetToNew}
            />
          </aside>
        </div>
      )}

      {/* CONVERSATION */}
      <div className="flex flex-1 flex-col bg-[#0a0a0a]">
        {/* header */}
        <div className="flex items-center gap-2 border-b border-[#1f1f1f] px-4 py-3">
          <button type="button" className="text-neutral-300 md:hidden" onClick={() => setRailOpen(true)} aria-label="Open plans">
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <div className="text-sm font-bold text-neutral-100">AI Organizer</div>
            <div className="text-[11px] text-[#84cc16]">
              {phase.kind === "thinking" ? "● Thinking…" : "● Ready"}
            </div>
          </div>
        </div>

        {/* transcript */}
        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
          {transcript.length === 0 && phase.kind === "idle" && (
            <div className="flex flex-col gap-3">
              <MessageBubble role="assistant">
                Describe how you want your cars laid out — I&apos;ll plan the moves.
              </MessageBubble>
              <ExamplePills onPick={(p) => submit(p)} />
            </div>
          )}

          {transcript.map((entry, idx) => {
            const isLast = idx === transcript.length - 1;
            return (
              <div key={entry.planId} className="flex flex-col gap-3.5">
                <MessageBubble role="user">{entry.prompt}</MessageBubble>
                {/* settled (historical) plans render read-only; the live pending one renders with actions below */}
                {!(isLast && (phase.kind === "thinking" || phase.kind === "plan-ready")) &&
                  entry.steps.length > 0 && (
                    <MessageBubble role="assistant">
                      <PlanCard summary={entry.summary} steps={entry.steps} readOnly />
                    </MessageBubble>
                  )}
              </div>
            );
          })}

          {phase.kind === "thinking" && <ThinkingBubble />}

          {phase.kind === "clarifying" && (
            <MessageBubble role="assistant">
              <p className="mb-2">{phase.clarification.question}</p>
              {phase.clarification.suggestions.length > 0 && (
                <ClarificationPills
                  suggestions={phase.clarification.suggestions}
                  onPick={(s) => submit(s)}
                />
              )}
            </MessageBubble>
          )}

          {phase.kind === "plan-ready" && liveCard && (
            <MessageBubble role="assistant">
              <PlanCard
                summary={liveCard.summary}
                steps={liveCard.steps}
                onApply={() => handleApply(phase.planId, liveCard.summary.cars_moved)}
                onChecklist={() => setPhase({ kind: "checklist", planId: phase.planId, steps: liveCard.steps })}
                onCancel={() => handleCancel(phase.planId)}
                isPending={pending}
              />
            </MessageBubble>
          )}

          {phase.kind === "checklist" && (
            <MessageBubble role="assistant">
              <ChecklistProgress planId={phase.planId} steps={phase.steps} />
            </MessageBubble>
          )}

          {phase.kind === "applied" && (
            <UndoBanner planId={phase.planId} undoExpiresAt={phase.undoExpiresAt} carsMoved={phase.carsMoved} />
          )}

          {phase.kind === "failed" && (
            <MessageBubble role="assistant">
              <p className="mb-2 whitespace-pre-line">{phase.message}</p>
              <Button size="sm" variant="outline" onClick={() => setPhase({ kind: "idle" })}>
                Try a different plan
              </Button>
            </MessageBubble>
          )}
        </div>

        {/* input */}
        <div className="flex gap-2 border-t border-[#1f1f1f] p-3">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && input.trim()) {
                e.preventDefault();
                submit(input.trim());
              }
            }}
            placeholder={
              phase.kind === "clarifying"
                ? "Answer the question…"
                : phase.kind === "plan-ready"
                  ? "Refine this plan, or apply it…"
                  : "Describe how to organize…"
            }
            disabled={pending || phase.kind === "thinking"}
            className="rounded-full"
          />
          <Button
            onClick={() => input.trim() && submit(input.trim())}
            disabled={!input.trim() || pending || phase.kind === "thinking"}
            className={cn("shrink-0 rounded-full bg-[#84cc16] text-black hover:bg-[#84cc16]/90")}
          >
            ↑
          </Button>
        </div>
      </div>
    </div>
  );
}

function emptySummary(): PlanSummary {
  return { total_steps: 0, cars_moved: 0, cars_unassigned: 0, displacements: 0, conflicts: [] };
}
```

- [ ] **Step 2: Typecheck (expects a missing import error next)**

Run: `npm run typecheck`
Expected: FAILS — `./transcript-action` does not exist yet (created in Task 9). This is expected; do not commit yet.

- [ ] **Step 3: Commit after Task 9**

(See Task 9 — commit Tasks 8+9 together once typecheck passes.)

---

## Task 9: Transcript server action

`getConversationTranscript` is a query needing the server; expose it to the client via a thin server action.

**Files:**
- Create: `app/(app)/organize/transcript-action.ts`

- [ ] **Step 1: Create the action**

```ts
// app/(app)/organize/transcript-action.ts
"use server";

import { getConversationTranscript } from "@/lib/queries/organizer";
import type { TranscriptEntry } from "@/lib/organizer/types";

export async function getTranscript(conversationId: string): Promise<TranscriptEntry[]> {
  return getConversationTranscript(conversationId);
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: exits 0 (Task 8's import now resolves).

- [ ] **Step 3: Commit (Tasks 8 + 9)**

```bash
git add "app/(app)/organize/organize-chat.tsx" "app/(app)/organize/transcript-action.ts"
git commit -m "feat(organizer): two-panel chat shell + transcript loading + refinement"
```

---

## Task 10: Wire the page to load conversations

**Files:**
- Modify: `app/(app)/organize/page.tsx`

- [ ] **Step 1: Replace the page**

```tsx
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  getActiveUndoablePlan,
  getConversations,
} from "@/lib/queries/organizer";

import { OrganizeChat } from "./organize-chat";

export default async function OrganizePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [initialConversations, initialUndoablePlan] = await Promise.all([
    getConversations(user.id),
    getActiveUndoablePlan(user.id),
  ]);

  return (
    <OrganizeChat
      initialConversations={initialConversations}
      initialUndoablePlan={initialUndoablePlan}
    />
  );
}
```

- [ ] **Step 2: Verify + commit**

Run: `npm run typecheck`
Expected: exits 0.
```bash
git add "app/(app)/organize/page.tsx"
git commit -m "feat(organizer): load conversations on the organize page"
```

---

## Task 11: Remove superseded components

**Files:**
- Delete: `app/(app)/organize/plan-renderer.tsx`
- Delete: `app/(app)/organize/recent-plans-list.tsx`

- [ ] **Step 1: Confirm no remaining importers**

Run (PowerShell): `Select-String -Path "app/**/*.tsx","components/**/*.tsx" -Pattern "plan-renderer|recent-plans-list" 2>$null`
Expected: no matches (the new `organize-chat.tsx` imports neither). If any match exists, stop and report.

- [ ] **Step 2: Delete the files**

Run (PowerShell): `Remove-Item "app/(app)/organize/plan-renderer.tsx","app/(app)/organize/recent-plans-list.tsx"`

- [ ] **Step 3: Verify + commit**

Run: `npm run typecheck`
Expected: exits 0.
```bash
git add -A
git commit -m "chore(organizer): remove superseded plan-renderer + recent-plans-list"
```

---

## Task 12: Verification + merge

- [ ] **Step 1: Full static check**

Run: `npm run typecheck && npm run build`
Expected: both exit 0; build completes.

- [ ] **Step 2: Manual matrix (`npm run dev`, logged in)**

- New thread → type a request → thinking dots + rotating status → plan bubble; Apply → undo banner; thread appears in the rail.
- Refinement: with a plan pending, send "actually not the <X>" → plan updates in place; then Apply → context resets (next message is a new request).
- Reload mid-thread (after selecting a thread) → transcript rebuilds from stored rows.
- Rail: multiple threads listed; switching loads the right transcript; "+ New plan" clears to empty.
- Mobile 375px: rail is a drawer (hamburger), conversation full-width, no horizontal scroll.
- Reduced-motion (OS setting) → thinking shows static "Working…".

- [ ] **Step 3: Merge + push**

```bash
git checkout main
git merge --no-ff feat/organizer-chat -m "feat(organizer): chat/assistant redesign"
git push origin main
```

- [ ] **Step 4: Post-deploy + screenshot**

After Vercel deploys, capture the marketing screenshot: a thread with a typed request + generated plan bubble (for `public/marketing/organizer.webp`, swapped in the marketing screenshot task).

---

## Notes / Out of Scope (spec §8)

- Planner/intent model unchanged (reused).
- No cross-plan conversational memory (refinement bounded to one pending plan).
- No streaming output. No thread rename/delete. Legacy null-`conversation_id` plans omitted from the rail (kept in DB).
