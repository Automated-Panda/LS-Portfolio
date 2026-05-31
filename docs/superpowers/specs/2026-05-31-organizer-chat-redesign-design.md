# AI Organizer — Chat/Assistant Redesign Design

**Date:** 2026-05-31
**Status:** Approved design, ready for implementation plan
**Owner:** James

---

## 1. Purpose

Redesign the `/organize` screen from a single plain request→plan panel into a proper
chat/assistant UI: a ChatGPT-style two-panel layout (conversation-thread rail on the
left, conversation on the right) with iMessage-style message bubbles, an animated
"thinking" state, and persisted, continuable conversation threads. This makes the
flagship AI Organizer feel like the premium Pro feature it is — and produces a strong
marketing screenshot (a generated plan inside the chat).

### Context

- The Organizer is GT Vault's marquee **Pro** feature (gated/"coming soon" on the
  marketing site). It works (intent parse → deterministic plan → apply/undo) but the
  UI is plain: a bare header, grey example pills, a basic input, and a flat plan card.
- The deterministic planner is correct and stays untouched — this is a UI + persistence
  redesign, not a planner change.

### Success criteria

- `/organize` shows a two-panel layout: thread rail + conversation, with bubble-style
  messages and an animated thinking indicator.
- Conversations persist: reloading or returning to a thread rebuilds its full
  transcript; the rail lists past threads and a new thread can be started.
- A pending (unapplied) plan can be refined by a follow-up message, re-planned against
  the live portfolio; context resets on apply/checklist/cancel/new.
- Mobile: the rail collapses; the conversation is usable full-width.
- A loaded thread (request + generated plan) is screenshot-worthy.

---

## 2. Layout & UX

Desktop two-panel inside `/organize`:

- **Left rail (~200–260px):**
  - "+ New plan" button (brand green) — starts a fresh thread.
  - "Recent" list of **conversation threads**, newest first, active one highlighted.
    Each item shows the thread title (auto from its first prompt) — truncated.
  - On **mobile** (`< md`): the rail is hidden behind a hamburger/drawer toggle in the
    conversation header; the conversation is full-width. Opening the drawer overlays
    the thread list; picking a thread closes it.

- **Right panel (conversation):**
  - Header: ✨ "AI Organizer" + a status line ("● Ready" when idle; the rotating
    status during thinking).
  - Scrolling **transcript**: messages as bubbles —
    - User requests: brand-green bubbles, right-aligned, tail bottom-right.
    - AI replies: dark surface (`#161616` / `border #262626`) bubbles, left-aligned
      with a ✨ avatar, tail bottom-left.
  - **Thinking state:** when a request is in flight, an AI bubble shows three pulsing
    green dots + a rotating status line cycling: "Reading your portfolio…" →
    "Understanding the request…" → "Planning the moves…". Honors
    `prefers-reduced-motion` (dots/cycle reduce to a static "Working…").
  - **Input:** rounded chat bar + circular send button (↑), pinned at the bottom of
    the panel. Enter submits.

- **Plan card (inside an AI bubble):** the existing `PlanRenderer` content — "Move N
  cars" summary line, conflicts, the move list (🟢 move / 🔴 displace, capped with
  "…N more"), and the actions Apply now / Checklist / Cancel — restyled to sit inside
  the assistant bubble rather than as a standalone bordered card.

- **Clarification & failure states** keep their existing behavior, rendered as AI
  bubbles (a question bubble with suggestion pills; a "can't fit that" bubble with a
  retry affordance).

---

## 3. Conversations & threading (data model — Option 2)

Threads group requests so history stays organized (vs. one rail entry per plan, which
would clutter).

### Schema

- **New table `conversations`:**
  - `id uuid pk default gen_random_uuid()`
  - `user_id uuid not null references auth.users(id) on delete cascade`
  - `title text not null` — auto-set from the first prompt (truncated, e.g. 80 chars)
  - `created_at timestamptz not null default now()`
  - `updated_at timestamptz not null default now()` (touch trigger like
    `organizer_plans`)
  - Index `(user_id, updated_at desc)`. RLS: owner-only select/insert/update/delete
    (mirror `organizer_plans` policies).
- **`organizer_plans` gains** `conversation_id uuid references conversations(id) on
  delete cascade` (nullable; existing rows stay null — legacy, still readable).
- Migration `0024_organizer_conversations.sql`.

### Behavior

- The **rail** lists `conversations` (newest `updated_at` first), not individual plans.
- Sending the **first** request with no active thread creates a `conversations` row
  (title from that prompt) and the plan row references it.
- Clicking a rail item loads that conversation's transcript.
- **Transcript = the conversation's ordered `organizer_plans` rows.** Each row already
  stores `prompt`, `plan_steps`, `parsed_intent`, `status` — enough to rebuild the
  bubbles (user prompt bubble + AI plan bubble) on load. **No separate messages table.**
- A thread's `updated_at` is touched when a new plan is added to it, so active threads
  float to the top.

### Migration of existing code

- `getRecentPlans` (today: flat list of plans) is superseded by a
  `getConversations(userId)` query for the rail; `getPlan`/`getActiveUndoablePlan`
  remain. A `getConversationTranscript(conversationId)` returns the ordered plan rows
  for the open thread. The legacy `RecentPlansList` component is replaced by the rail.

---

## 4. Refinement (scoped to the pending plan)

Addresses the "actually, not the Zentorno" case without full conversational memory.

- While a plan is **shown but not yet applied**, the next message is a **refinement of
  that same request**, not a new thread entry.
- It re-runs `parseIntent(prompt, history)` where `history: Turn[]` carries the prior
  prompt(s) + the user's correction (the same multi-turn mechanism the clarification
  flow already uses), then re-plans **against the live portfolio** via `generatePlan`.
- The pending plan card updates in place: the correction shows as a new user bubble and
  the AI's revised plan as a new AI bubble, so the exchange reads naturally. The
  superseded plan row is updated/replaced rather than accumulating dead `pending` rows
  (the latest pending plan for the in-progress request is the one stored).
- **Context resets** on **Apply**, **Checklist**, **Cancel**, or **+ New plan**. After
  a reset, the next message is a clean new request planned against live state.
- Drift-safe by construction: refinement context never spans more than one unapplied
  plan, and every plan — refined or not — is computed against the real current
  portfolio.
- This reuses `parseIntent`/`generatePlan` unchanged; the new logic lives in the chat
  component's phase state (tracking "refining the pending plan") + threading prior
  turns into `parseIntent`.

---

## 5. Components & architecture

Within `app/(app)/organize/`:

- `page.tsx` — server: load the user, the conversation list, and (if any) the active
  thread / active undoable plan; render the shell.
- `organize-chat.tsx` — the client orchestrator (exists today). Extended for: the
  two-panel shell, transcript state (list of rendered turns), thread selection, the
  refinement phase. Its phase state machine grows a "refining" notion but keeps the
  existing kinds (idle/thinking/clarifying/plan-ready/applied/checklist/failed).
- New presentational components (each one focused, testable in isolation):
  - `conversation-rail.tsx` — the left thread list + "New plan" + mobile drawer.
  - `message-bubble.tsx` — a single bubble (role: user | assistant), with optional
    avatar/tail; children render plan/clarification/text.
  - `thinking-bubble.tsx` — the dots + rotating status (reduced-motion aware).
  - `plan-card.tsx` — the restyled plan renderer (supersedes `plan-renderer.tsx`'s
    styling; same props/actions).
- Reused unchanged: `actions.ts` (`parseIntent`, `generatePlan`, `applyPlan`,
  `dismissPlan`), `checklist-progress.tsx`, `clarification-pills.tsx`,
  `example-pills.tsx` (shown in an empty thread), `undo-banner.tsx`, the planner libs.
- New/changed server actions: create-conversation-on-first-plan + attach
  `conversation_id` when persisting a plan; `getConversations` +
  `getConversationTranscript` queries in `lib/queries/organizer.ts`.

Visual system: dark tokens consistent with the app; brand green `#84cc16` for the user
bubble + send button + "New plan"; AI surfaces `#161616`/`#262626`; emerald reserved
for the existing in-plan move/positive accents (as already used in `plan-renderer`).
Animations 150–300ms, transform/opacity, reduced-motion respected.

---

## 6. Edge cases

- **Reduced motion:** dots + status cycle collapse to a static "Working…" label.
- **Empty thread / new plan:** shows the example prompts (existing `ExamplePills`) as
  the opening assistant suggestion, not a blank panel.
- **Active undoable plan on load** (existing behavior): surfaces the undo banner; the
  thread it belongs to is the active one.
- **Legacy plans** (null `conversation_id`): not shown in the threaded rail (or grouped
  under a single "Earlier" pseudo-thread — implementation may choose the simpler: omit
  from rail, still reachable by direct plan id if any link exists). Chosen: omit from
  the rail; they remain in the DB, no data loss.
- **Refine after apply:** not allowed — once applied, the next message is a new request
  (correct, since the portfolio changed).
- **Mobile:** no side-by-side; rail is a drawer.

---

## 7. Testing / verification

No unit-test runner in this repo (verify via `npm run typecheck`, `npm run build`, and
manual checks). Manual matrix:
- New thread → request → thinking animation → plan bubble; Apply → undo banner.
- Refinement: pending plan + "actually not the X" updates the plan in place; Apply
  resets context.
- Reload mid-thread → transcript rebuilds from stored plan rows.
- Rail: multiple threads listed; switching loads the right transcript; "+ New plan"
  starts fresh.
- Mobile width (375px): rail drawer works; conversation full-width; no horizontal
  scroll.
- Reduced-motion: static "Working…".

---

## 8. Out of scope

- Changes to the deterministic planner or intent model beyond reusing them.
- Full cross-plan conversational memory (refinement is bounded to one pending plan).
- Streaming token-by-token AI output (the plan is computed server-side, not streamed).
- Renaming/deleting threads from the rail (could be a later nicety; not now).
- Migrating legacy null-`conversation_id` plans into synthetic threads.

---

## 9. Open items for implementation

- Confirm the title-truncation length and rail width against the real lockup spacing.
- Decide where create-conversation happens: in the `generatePlan` action (attach a
  `conversation_id`, creating one when absent) vs. a dedicated `startConversation`
  action called first. Lean: create lazily inside the persistence step when a plan is
  first saved for a new thread, returning the `conversation_id` to the client.
- Confirm reduced-motion fallback copy ("Working…").
