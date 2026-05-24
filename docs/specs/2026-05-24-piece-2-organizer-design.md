# Piece 2 — AI Organizer

**Status:** Design approved 2026-05-24. Ready for implementation plan.
**Brainstorm source:** [`docs/specs/2026-05-17-organize-owned-cars-brainstorm.md`](./2026-05-17-organize-owned-cars-brainstorm.md) (Piece 2 hints section)
**Builds on:** [Piece 1 — Foundation](./2026-05-24-foundation-track-and-link-cars-design.md). Requires multi-instance ownership, storage links, and trade-in flow to be in place.

---

## Context

Piece 1 made the app a usable GTA portfolio tracker. Piece 2 is the marquee AI feature: a chat-driven organizer that takes natural-language requests like *"put my drift cars in Mission Row"* and produces a deterministic relocation plan the user can apply directly or execute manually in-game.

**Two-layer architecture:**
1. **LLM (Claude Haiku 4.5)** parses the user's prompt into structured intent. Cheap, fast, single-purpose.
2. **Deterministic planner** computes the actual relocation plan (chained displacement algorithm). No AI, just constraint satisfaction.

The user picks execution mode per plan: *Apply now* (DB updates instantly + 1hr undo window) or *Checklist only* (DB unchanged; user ticks steps as they execute in GTA's interact menu).

---

## Goals

1. **Natural-language input** — user types a prompt, gets a plan in seconds
2. **Compound queries** — "put drift cars in Mission Row AND consolidate supers in Eclipse" works in a single prompt
3. **Chained displacement** — if target is full, planner moves resident cars elsewhere (preferring cars that don't match any criterion)
4. **Two execution modes** — Apply now (instant DB + undo) OR Checklist only (per-step ticks)
5. **1-hour undo window** on Apply mode
6. **Plan history** — past plans viewable indefinitely; rerunning rebuilds against current state
7. **Failure UX with suggestions** — when capacity is insufficient, suggest unowned properties that would fit
8. **Cost discipline** — sub-cent per query via prompt caching

---

## Decisions Locked

| # | Question | Decision | Rationale |
|---|---|---|---|
| 1 | Execution mode | **User picks per plan** — Apply now OR Checklist only | Apply mode is for users who trust the plan and want their tracker updated immediately. Checklist mode keeps DB and in-game state aligned step-by-step. Both have legitimate users. |
| 2 | Surface | **Dedicated `/organize` page** in sidebar | Plenty of room for chat + plan + checklist + history. Sidebar entry is discoverable. Floating buttons on other pages can be added later. |
| 3 | Input shape | **Pure chat + example pills on empty state** | AI-first feel. Pills solve the cold-start "what can I type?" problem; fade once user starts typing. Structured criterion builder rejected as feeling "free tier". |
| 4 | Compound queries | **Day one** | One prompt covers multiple criteria; LLM parses array, planner processes sequentially. More natural than forcing 2 prompts. |
| 5 | History + undo | **History indefinite, undo within 1 hour of apply** | History is cheap (a few KB JSONB per plan). Undo window matches the "I haven't physically moved them yet" window. |
| 6 | Pro paywall | **Built free; wrap with `<RequiresPro>` in Phase 9** | Skipping the env-var feature flag — gating cost is one small wrap when Stripe lands. Free trial pre-launch builds an honest funnel. |
| 7 | Architecture | **Single LLM call → deterministic planner**, with clarify-then-plan loop for ambiguous prompts | LLM scope kept tight (intent parsing only). Deterministic planner is testable and predictable. Clarification handles 95% of ambiguity in one extra round-trip. |
| 8 | Undo banner location | **`/organize` only** | Keeps surface contained. Avoids stale 1hr banner lingering on other pages. |
| 9 | Clarification render | **Inline AI message + suggestion pills** | Matches the conversation feel without modal jarring. Pills enable one-click answers. |
| 10 | Failure UX | **Apologetic message + suggest properties to buy** | LLM has portfolio context — can compute "you need K more slots" and surface unowned properties from the catalogue. Highest-value moment for the upsell narrative. |

---

## Schema Changes

One new table. Plan steps and undo snapshot live as JSONB on the plan row — no separate step or completion tables.

### Migration 0008 — `organizer_plans`

```sql
create type organizer_plan_status as enum (
  'pending',     -- generated but not yet acted on (user is looking at it)
  'applied',     -- DB updates done (Apply mode); undo window may be active
  'checklist',   -- DB unchanged; user is ticking steps off
  'completed',   -- all checklist steps ticked — terminal
  'undone',      -- applied then reverted within window — terminal
  'dismissed'    -- user closed without acting — terminal
);

create table public.organizer_plans (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  prompt              text not null,                  -- what user typed
  parsed_intent       jsonb not null,                 -- LLM's parsed criteria
  plan_steps          jsonb not null,                 -- ordered list of moves
  status              organizer_plan_status not null default 'pending',
  applied_at          timestamptz,                    -- when Apply ran
  undo_snapshot       jsonb,                          -- pre-apply state of affected vehicles
  undo_expires_at     timestamptz,                    -- applied_at + 1 hour
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_organizer_plans_user
  on public.organizer_plans(user_id, created_at desc);

create index idx_organizer_plans_active_undo
  on public.organizer_plans(user_id)
  where status = 'applied' and undo_expires_at > now();

alter table public.organizer_plans enable row level security;

create policy "Users can view own plans"
  on public.organizer_plans for select using (auth.uid() = user_id);
create policy "Users can insert own plans"
  on public.organizer_plans for insert with check (auth.uid() = user_id);
create policy "Users can update own plans"
  on public.organizer_plans for update using (auth.uid() = user_id);
create policy "Users can delete own plans"
  on public.organizer_plans for delete using (auth.uid() = user_id);

-- Auto-update updated_at on row changes.
create or replace function public.touch_organizer_plan_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

create trigger trg_organizer_plans_touch
  before update on public.organizer_plans
  for each row execute procedure public.touch_organizer_plan_updated_at();
```

### JSONB type shapes (enforced in app code, not DB)

```ts
// Used to filter vehicles for one criterion
type VehicleFilter = {
  tags?: string[];          // system tag ids (matches vehicle_tag_links)
  custom_tags?: string[];   // user-defined tags (matches user_owned_vehicles.custom_tags)
  classes?: string[];       // formatted class names ("Super", "Sports", etc.)
  manufacturers?: string[]; // manufacturer ids
};

type ParsedIntent = {
  criteria: Array<{
    description: string;    // human-readable label e.g. "drift cars"
    filter: VehicleFilter;
    target: {
      property_id: string;            // user_owned_properties.id
      upgrade_id?: string;            // optional — null/missing = planner picks
    };
  }>;
  unmatched_handling: "leave" | "consolidate-to-target";
};

type PlanStep = {
  index: number;                                // 0..N-1; defines execution order
  type: "move" | "unassign";
  owned_vehicle_id: string;
  vehicle_label: string;                        // nickname || vehicle display_name
  from: { property_id: string; upgrade_id: string | null; label: string };
  to:   { property_id: string | null; upgrade_id: string | null; label: string }; // null+null = unassign
  reason: "user-asked" | "displaced";
  completed_at: string | null;                  // ISO timestamp (checklist mode)
};

type UndoSnapshot = {
  vehicles: Array<{
    owned_vehicle_id: string;
    stored_in_property_id: string | null;
    assigned_upgrade_id: string | null;
  }>;
};

type PlanSummary = {
  total_steps: number;
  cars_moved: number;
  cars_unassigned: number;
  displacements: number;
  conflicts: string[];                          // human-readable notes e.g. "Used 'drift' for cars matching both 'drift' and 'supers'"
};
```

---

## LLM Intent Parser

### Model

**`claude-haiku-4-5`** — the lightest current Claude. Sufficient for structured-output parsing. No reasoning workload required.

### System prompt structure (cacheable)

```
[Behavior instructions — static]
You are an intent parser for a GTA Online portfolio manager. Take the user's
natural-language relocation request and output a structured intent via the
parse_intent tool. If the request is ambiguous, ask a clarification instead.
Never invent vehicles, properties, or tags that aren't listed below.

[Filter vocabulary — static]
- tags: system tags from the vehicle_tags reference table
- custom_tags: user-defined tags on owned vehicle instances
- classes: vehicle classes (Super, Sports, Muscle, Sport Classic, Coupe, ...)
- manufacturers: manufacturer ids
- Special target language: "the largest free", "any property", "spread evenly"

[Tool schema — static]
parse_intent(input: ...)  — see Tool definition below

[Portfolio taxonomy — per-user, invalidates when fleet/properties change]
System tags: drift, bennys, hsw, imani_tech, weaponized, arena, lowrider, open_wheel
Custom tags: f1-wheels, gymkhana, daily-driver, ...

Vehicles (N owned instances):
  [<owned_vehicle_id>] <display_name> (<manufacturer> · <class>) [<tags>] @ <storage_label or "unassigned">
  ...

Properties (M owned):
  [<owned_property_id>] <display_name> · <max_capacity> cap
    [<upgrade_id>] <upgrade_display_name> (<capacity>)   ← if installed
    ...
```

### Tool definition

```ts
{
  name: "parse_intent",
  description: "Parse the relocation request OR ask for clarification.",
  input_schema: {
    type: "object",
    properties: {
      // Discriminated: provide EITHER intent OR clarification, not both
      intent: {
        type: "object",
        properties: {
          criteria: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                filter: {
                  type: "object",
                  properties: {
                    tags: { type: "array", items: { type: "string" } },
                    custom_tags: { type: "array", items: { type: "string" } },
                    classes: { type: "array", items: { type: "string" } },
                    manufacturers: { type: "array", items: { type: "string" } }
                  }
                },
                target: {
                  type: "object",
                  properties: {
                    property_id: { type: "string" },
                    upgrade_id: { type: "string" }
                  },
                  required: ["property_id"]
                }
              },
              required: ["description", "filter", "target"]
            }
          },
          unmatched_handling: { enum: ["leave", "consolidate-to-target"] }
        },
        required: ["criteria", "unmatched_handling"]
      },
      clarification: {
        type: "object",
        properties: {
          question: { type: "string" },
          suggestions: { type: "array", items: { type: "string" } }
        },
        required: ["question"]
      }
    }
  }
}
```

The server checks which key is present in `tool_use.input`. If `intent` → validate IDs + hand to planner. If `clarification` → return to chat for user reply.

### Prompt caching

| Block | Cached? | Invalidated when |
|---|---|---|
| Behavior + tool schema | ✅ | Never |
| Filter vocabulary | ✅ | New system tag added (rare) |
| Portfolio taxonomy | ✅ | User adds/removes a vehicle or property |
| User prompt + history | ❌ | Every turn |

Use Anthropic's `cache_control` markers on each cached block. Cache hits cost ~10% of full input.

### Cost estimate (Haiku 4.5, prompt caching on)

- Cached input: ~4K tokens (taxonomy heavy for users with 30+ cars)
- Fresh input (per turn): ~50 tokens
- Output: ~200 tokens
- **Per-query cost: ~$0.001 (one-tenth of a cent)**

Sub-cent enough that we don't need per-query usage caps or charges.

### Server-side validation

LLM can hallucinate. Before handing intent to the planner, server checks:

- Every `property_id` exists in `user_owned_properties` for this user
- Every `upgrade_id` exists in `property_upgrades` AND is currently installed (`user_owned_property_upgrades` row exists for it)
- Every `tag` in `filter.tags` exists in the `vehicle_tags` reference table
- `unmatched_handling` is one of the two allowed values

If any check fails → return `{ error: "I misread the request — try rephrasing." }` and log the offending intent for diagnostics.

### Files

```
lib/organizer/
  intent-parser.ts        — builds the system prompt + calls Anthropic SDK
  portfolio-context.ts    — assembles the taxonomy block from user fleet + properties
  validate-intent.ts      — server-side ID/tag checks
```

### Dependency + env

- Add `@anthropic-ai/sdk` to package.json
- New env var `ANTHROPIC_API_KEY` in `.env.local` AND Vercel project settings (server-only, never exposed to client)

---

## Deterministic Planner

The brain. Pure code, no LLM. Lives at `lib/organizer/planner.ts`.

### Input / output

```ts
type PlannerInput = {
  intent: ParsedIntent;
  portfolio: {
    vehicles: OwnedVehicleInstance[];     // includes current storage
    properties: OwnedPropertyDetail[];    // includes installed upgrades + capacities
  };
};

type PlannerOutput =
  | { ok: true; steps: PlanStep[]; summary: PlanSummary }
  | { ok: false; reason: "insufficient-capacity"; shortBy: number; suggestion?: Property[] }
  | { ok: false; reason: "target-not-built"; missingUpgradeIds: string[] };
```

### Working state

```ts
type LocationKey = string;  // `${propertyId}:${upgradeId ?? "base"}`

type WorkingState = {
  vehicleLocation: Map<OwnedVehicleId, LocationKey | "unassigned">;
  occupancy: Map<LocationKey, number>;
  capacity: Map<LocationKey, number>;
  steps: PlanStep[];
  conflicts: string[];
};
```

### Algorithm

1. **Build WorkingState** from portfolio.
2. **For each criterion in `intent.criteria` (in order):**
   - **Resolve filter** → set `V` of matching vehicles
   - **Drop vehicles already at target** → `V'` (needs-to-move set)
   - **Resolve target slot:**
     - If `upgrade_id` specified → use that slot
     - Else if property has installed sub-garages → use the largest free one; spill across additional sub-garages within the same property as needed
     - Else → use base storage on the property
   - **For each vehicle v in V':**
     - If target slot has free space → emit `move` step, update WorkingState
     - Else (target full):
       - **Pick a displacement victim** at the target slot:
         - Prefer vehicles NOT matching ANY criterion in `intent.criteria`
         - Within those, oldest `created_at` first
       - **Find a new home for the victim:**
         - Best-fit-largest-free: iterate all owned locations, pick the one with the most free slots that has ≥1 available. Ties broken by location key (deterministic).
         - If every location is full → emit `unassign` step for the victim
       - Emit displacement step (`reason: "displaced"`) then placement step for v (`reason: "user-asked"`)
3. **Apply `unmatched_handling`:**
   - `"leave"` → no further moves
   - `"consolidate-to-target"` → take unmatched vehicles, try to fit them into the same target as the LAST criterion
4. **Order steps:** all displacements first (in emission order), then all placements. Guarantees each step is executable when its turn comes.
5. **Build summary** (cars moved, cars unassigned, displacement count, conflict notes), return `{ ok: true, steps, summary, conflicts }`.

### Failure modes

- **Insufficient total capacity:** before running the algorithm, compare total free space (target slots + all other free slots) against total vehicles to move. If short → return `{ ok: false, reason: "insufficient-capacity", shortBy: N, suggestion: [unowned properties that would fit] }`.
- **Target requires uninstalled upgrade:** if `intent.target.upgrade_id` references an upgrade the user hasn't installed → return `{ ok: false, reason: "target-not-built", missingUpgradeIds: [...] }` with a hint to install the upgrade first.

### Conflict notes (surface in summary)

- Vehicle matches multiple criteria → first claim wins. Note: *"3 cars matched both 'drift' and 'supers' — used 'drift'."*
- Two criteria target the same slot → process in order; second criterion may displace first criterion's cars. Note: *"Mission Row L2 was used by both 'drift' and 'supers' — supers displaced drift cars to L1."*

### Files

```
lib/organizer/
  planner.ts              — main algorithm
  filter-vehicles.ts      — vehicleMatches(filter, vehicle) helper
  locations.ts            — LocationKey, capacity / occupancy math
```

### Verification

Pure functions. No automated tests (per project convention), but the planner gets a `lib/organizer/__samples__/sample-plans.ts` fixture file:

```ts
// 5-6 hand-crafted (portfolio, intent) tuples with expected outputs.
// James runs `tsx lib/organizer/__samples__/run.ts` to print actual vs expected.
```

This is the closest we get to testing without introducing Vitest.

---

## /organize Page UX

### Layout

- Single chat column, max-width ~800px, centered
- **Input pinned at bottom** (sticky)
- **Plan + history above** the input, scrollable
- New nav item under "My Portfolio" section: `Organize` (icon: Sparkles)

### Empty state

```
Organize
Describe how you want your cars laid out. Examples:

[Put my drift cars in Mission Row]
[Move all Pegassi cars to Eclipse Towers, Apt 30]
[Put weaponized cars in my facility, drift cars in Mission Row]
[Consolidate my supers in one place]

──────────────────────────────────────────────────
[ Describe how to organize...              ] [Send]
```

Pills click → prefill input + auto-submit. Pills fade once user types or after first plan.

Pill #3 demonstrates a compound query. Pill #4 ("consolidate") is ambiguous about *where* — exercises the clarification path (LLM will ask "Which property?"). Real pill copy should be tuned per user (suggest example properties they actually own); listed here as placeholders for the implementer to derive from the user's actual fleet.

### Plan generated state

```
You: put my drift cars in mission row

▶ Plan: Move 8 drift cars to Mission Row · Displace 2 cars to Eclipse
  🔴 Displace Banshee · Mission Row L1 → Eclipse
  🔴 Displace T20    · Mission Row L1 → Eclipse
  🟢 Move Zentorno · Eclipse → Mission Row L1
  ...6 more steps

  [ ✓ Apply now ]   [ ☐ Just give me the checklist ]   [ Cancel ]
```

### Clarification state

```
You: organize my drift cars

▶ Clarification: Mission Row has 3 sub-garages (L1/L2/L3). Which one?
  Or pick: [L1 (10 cars)] [L2 (10 cars)] [L3 (11 cars)]

──────────────────────────────────────────────────
[ Or type a different answer...           ] [Send]
```

Pill click → submits as the next user message in the same conversation. The next `parseIntent` call passes `clarifyingHistory: [{role:"assistant", clarification}, {role:"user", reply}]`.

### Apply mode (post-apply)

Banner at top of /organize page:

```
✅ Plan applied · 10 cars moved              [ ↶ Undo (59:43) ]
```

Live countdown timer. Banner hides after 1 hour OR after Undo click. Banner is page-scoped (per Decision #8 — `/organize` only, no global banner).

Below the banner: the plan steps are shown read-only as an "in-game reference" — *"Replicate these moves in GTA's interact menu."*

### Checklist mode

```
3 / 10 complete  [▰▰▰░░░░░░░]

  ☑ Displace Banshee · Mission Row L1 → Eclipse        (struck through, muted)
  ☑ Displace T20    · Mission Row L1 → Eclipse
  ☑ Move Zentorno · Eclipse → Mission Row L1
  ☐ Move Sultan RS · La Mesa → Mission Row L1
  ☐ ...
```

Each checkbox tick fires `markStepComplete(planId, stepIndex)` server action. When all ticked → status auto-flips to `completed`. User can also `Dismiss` mid-flight (status → `dismissed`; already-applied step DB writes stay).

### Failure state

```
You: put 50 drift cars in one apartment

▶ Can't fit that one
  You have 12 drift cars matching but your largest apartment slot
  holds 10. You'd need ~2 more slots — try buying the Vinewood Club
  Garage (100 cars) or upgrading Mission Row to L3.

  [ Browse /properties → ]   [ Try a different plan ]
```

LLM rewrites the planner's structured failure into this message (one more LLM call when failure happens — adds ~$0.001).

### Recent plans (below input)

Collapsible "Recent plans" section. Last 10 plans, newest first. Click → expands to show original plan steps + status read-only.

### Components

```
app/(app)/organize/
  page.tsx                        — server component (auth + initial data load)
  organize-chat.tsx               — client state machine (chat → plan → action)
  plan-renderer.tsx               — renders one plan's steps + action buttons
  checklist-progress.tsx          — progress bar + checkbox list
  undo-banner.tsx                 — top banner with countdown timer
  recent-plans-list.tsx           — collapsible history view
  example-pills.tsx               — empty-state pills
  clarification-pills.tsx         — clarification suggestion pills
```

---

## History + Undo Flow

### History view (`/organize` bottom)

Last 10 plans for the user, newest first. Each row shows:
- Date + time
- Original prompt (truncated to 80 chars)
- Status badge (Applied N cars · Checklist M/N · Dismissed · Undone)
- `[view]` button

Click `[view]` → expands inline to show the full plan steps read-only. No edit, no re-apply.

### Re-run a past plan

A `[Re-run this prompt]` button on the expanded view prefills the chat input with the original prompt (but doesn't auto-submit). User edits if needed and submits → fresh plan generated against current portfolio state. We deliberately don't store-and-replay exact steps because the portfolio may have changed.

### Undo mechanics

When user clicks **Apply now** on a `pending` plan:

```
BEGIN transaction-like sequence:
  1. Read current { stored_in_property_id, assigned_upgrade_id } for every
     vehicle referenced in plan_steps. Build UndoSnapshot.
  2. Write undo_snapshot + undo_expires_at = now() + interval '1 hour'.
  3. For each step in plan_steps (in index order):
     - Call assignVehicleStorage(...) equivalent
     - If any call errors: abort, rollback already-applied steps using the
       snapshot we just wrote, return { error }
  4. Set status = 'applied', applied_at = now()
COMMIT
```

(Wrapping all of this in a true Postgres transaction is ideal — implementer should evaluate whether to do it via a single PL/pgSQL function or sequential calls with manual rollback.)

When user clicks **Undo** within the 1-hour window:

```
1. Check undo_expires_at > now() AND status = 'applied'. If not → return error.
2. For each vehicle in undo_snapshot.vehicles:
   - Restore stored_in_property_id and assigned_upgrade_id
3. Set status = 'undone'.
4. Leave undo_snapshot in place (history audit), null out undo_expires_at.
```

After the 1-hour window: the undo button disappears. Snapshot is retained on the row for audit purposes.

### Checklist mode (no undo path)

DB hasn't been changed on plan generation. Each step tick is a discrete `assignVehicleStorage` call. Untick reverses it. No snapshot, no global undo. User can dismiss the plan mid-flight; ticked steps stay applied.

---

## Server Actions Surface

All actions in `app/(app)/organize/actions.ts` unless noted.

```ts
parseIntent(prompt: string, clarifyingHistory?: Turn[])
  → { ok: true; intent: ParsedIntent }
  | { ok: false; clarification: { question: string; suggestions: string[] } }
  | { error: string }

generatePlan(intent: ParsedIntent, prompt: string)
  → { ok: true; planId: string; steps: PlanStep[]; summary: PlanSummary }
  | { ok: false; reason: "insufficient-capacity"; shortBy: number; suggestedProperties: SuggestedProperty[] }
  | { ok: false; reason: "target-not-built"; missingUpgradeIds: string[] }

applyPlan(planId: string)
  → { ok: true; undoExpiresAt: string }
  | { error: string }

undoPlan(planId: string)
  → { ok: true }
  | { error: "expired" | "already-undone" | "not-applied" | string }

markStepComplete(planId: string, stepIndex: number)
  → { ok: true; allComplete: boolean }
  | { error: string }

markStepIncomplete(planId: string, stepIndex: number)
  → { ok: true }
  | { error: string }

dismissPlan(planId: string)
  → { ok: true } | { error: string }
```

`lib/queries/organizer.ts`:

```ts
getRecentPlans(userId: string, limit?: number): Promise<PlanSummaryRow[]>
getPlan(planId: string): Promise<OrganizerPlan>
getActiveUndoablePlan(userId: string): Promise<OrganizerPlan | null>
```

---

## Cost Analysis

| Workload | Calls per plan | Tokens (in/out) | Per-call cost (Haiku 4.5) |
|---|---|---|---|
| `parseIntent` happy path | 1 | ~50 fresh + ~4K cached / ~200 | ~$0.001 |
| `parseIntent` with clarification | 2 | same × 2 | ~$0.002 |
| `generatePlan` failure → LLM rewrites message | 1 extra | ~50 / ~150 | ~$0.001 |
| `generatePlan` happy path | 0 (deterministic) | n/a | $0 |
| `applyPlan` / `undoPlan` / step ticks | 0 | n/a | $0 |

**Typical user session (3 plans, 1 clarification, 0 failures): ~$0.004.**

A heavy user generating 100 plans/month = ~$0.40. Well under any reasonable Pro tier price.

---

## Failure UX

When `generatePlan` returns `ok: false`, the page makes ONE extra LLM call to rewrite the structured failure into a friendly message:

```
parseIntent → planner → generatePlan returns { ok: false, reason: "insufficient-capacity", shortBy: 2, suggestedProperties: [...] }

→ formatFailure(reason, context) makes a tiny LLM call (~$0.001) that returns:
  "You have 12 drift cars but your largest apartment slot only holds 10.
   You'd need ~2 more slots — try buying the Vinewood Club Garage (100 cars)
   or upgrading Mission Row to L3."

→ Rendered with action buttons: [Browse /properties →] [Try a different plan]
```

For `target-not-built`, friendly message: *"Mission Row L3 isn't installed on your nightclub yet. Install it from /my-properties first."*

---

## Deferred

Not in Piece 2; named for future scoping.

| Item | Target |
|---|---|
| Pro tier paywall wrap (`<RequiresPro>` boundary on /organize route) | Phase 9 (Stripe) |
| Multi-turn conversational refinement (Approach B from brainstorm) | Piece 2.1 if signal demands |
| Tool-use agent (Approach C — full LLM agent with multiple tools) | Probably never; complexity not worth it |
| `target: { auto_pick: "largest_fit" }` — LLM emits "pick the right property" intent and planner handles | Piece 2.1; for v1 the "consolidate" pill exercises the clarification path instead |
| Distribution intents — "spread my cars evenly across my apartments" — needs a different planner mode (load-balancing, not target-and-displace) | Piece 2.5 |
| Plan history beyond 10 entries (pagination, search) | Piece 2.5 |
| Stale `pending` plans cleanup — a plan generated but never acted on stays in DB forever. Low storage cost; add a scheduled deletion (>7 days old, status='pending') if it ever matters. | Piece 2.5 |
| Cross-user plan sharing ("share this organization with a friend") | Out of scope |
| Auto-organize on schedule ("organize daily at 6am") | Out of scope |
| Voice input | Out of scope |
| Mobile-optimized chat layout | Piece 6 (mobile pass) |

---

## Acceptance Criteria

Piece 2 is done when:

1. Navigating to `/organize` shows the empty state with example pills + input
2. Clicking an example pill prefills the input AND auto-submits
3. A simple prompt ("put my drift cars in Mission Row") generates a plan within ~3 seconds
4. The plan shows summary + ordered step list + the two execution mode buttons
5. **Apply now** updates the DB and shows the undo banner with a live countdown
6. **Undo** within the 1-hour window restores all affected vehicles to their pre-apply state
7. **Just give me the checklist** does NOT update the DB; clicking each checkbox triggers an individual DB update and updates the progress bar
8. An ambiguous prompt ("group my drift cars") returns a clarification with suggestion pills; clicking one continues the conversation
9. A compound prompt ("put drift in Mission Row and supers in Eclipse") generates a plan covering both criteria
10. A capacity-insufficient prompt ("put 50 cars in one apartment") returns the friendly failure message with property suggestions
11. The "Recent plans" section shows the last 10 plans with status badges
12. Clicking `[view]` on a past plan expands the steps inline
13. Clicking `[Re-run this prompt]` prefills the chat input with the original prompt
14. Server validation rejects intents referencing properties/upgrades/tags the user doesn't have access to
15. Total per-session cost stays under $0.01 for typical use

---

## Files Affected — Summary

**New migration:**
- `supabase/migrations/0008_organizer_plans.sql`

**New library:**
- `lib/organizer/intent-parser.ts`
- `lib/organizer/portfolio-context.ts`
- `lib/organizer/validate-intent.ts`
- `lib/organizer/planner.ts`
- `lib/organizer/filter-vehicles.ts`
- `lib/organizer/locations.ts`
- `lib/organizer/apply-plan.ts`
- `lib/organizer/undo-plan.ts`
- `lib/organizer/format-failure.ts` (the LLM-rewrite call for failure UX)
- `lib/organizer/__samples__/sample-plans.ts` (fixture + run script)
- `lib/queries/organizer.ts`

**New page:**
- `app/(app)/organize/page.tsx`
- `app/(app)/organize/actions.ts`
- `app/(app)/organize/organize-chat.tsx`
- `app/(app)/organize/plan-renderer.tsx`
- `app/(app)/organize/checklist-progress.tsx`
- `app/(app)/organize/undo-banner.tsx`
- `app/(app)/organize/recent-plans-list.tsx`
- `app/(app)/organize/example-pills.tsx`
- `app/(app)/organize/clarification-pills.tsx`

**Modified:**
- `components/app-shell/nav-items.ts` — add the `Organize` entry to "My Portfolio" section
- `package.json` — add `@anthropic-ai/sdk` dependency
- `.env.local.example` — add `ANTHROPIC_API_KEY` placeholder
- `docs/plan.md` — Phase entry for "Piece 2 landed"

---

📄 **End of design spec.** Implementation plan to follow via the `writing-plans` skill.
