# Piece 2 — AI Organizer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the chat-driven AI organizer — `/organize` page where the user types natural-language relocation requests ("put my drift cars in Mission Row"), Claude Haiku 4.5 parses into structured intent, a deterministic planner computes the moves, user picks Apply now (with 1hr undo) or Checklist only (per-step ticks). Compound queries day one; built free (Stripe gating in Phase 9).

**Architecture:** Two-layer — LLM scoped to intent parsing only (cacheable system prompt with portfolio taxonomy + tool-use response), deterministic planner (chained displacement) does the actual move computation. Per-plan JSONB rows in `organizer_plans`. Apply mode snapshots → 1hr undo window. Checklist mode is just N independent `assignVehicleStorage` calls fired as the user ticks.

**Tech Stack:** Next.js 15 (App Router) · TypeScript · Supabase (hosted, MCP plugin) · `@anthropic-ai/sdk` (NEW) · shadcn/ui · Tailwind · sonner · lucide-react

**Verification approach (project-specific):** This project has no automated test framework — Phases 0–4b + Piece 1 relied on `npm run typecheck`, manual browser smoke-tests, MCP `execute_sql` for row counts. **Do not introduce a test framework as part of this work.** The planner gets a `__samples__/run.ts` script for fixture-based eyeball verification but it's not a test runner.

**Reference spec:** [`docs/specs/2026-05-24-piece-2-organizer-design.md`](../specs/2026-05-24-piece-2-organizer-design.md)

**LLM tasks (4, 12):** When working on Claude API integration (intent parser + failure formatter), implementer subagents should invoke the `claude-api` skill — it has the canonical prompt-caching pattern, latest model IDs, and Anthropic SDK usage.

---

## File Structure

**Created:**
- `supabase/migrations/0008_organizer_plans.sql`
- `lib/organizer/types.ts` — shared types (VehicleFilter, ParsedIntent, PlanStep, etc.)
- `lib/organizer/locations.ts` — LocationKey + capacity helpers
- `lib/organizer/filter-vehicles.ts` — `vehicleMatches(filter, vehicle)` helper
- `lib/organizer/portfolio-context.ts` — builds the LLM taxonomy block
- `lib/organizer/intent-parser.ts` — calls Anthropic SDK + parses tool_use response
- `lib/organizer/validate-intent.ts` — server-side ID/tag validation
- `lib/organizer/planner.ts` — main algorithm
- `lib/organizer/__samples__/sample-plans.ts` — fixture inputs + expected outputs
- `lib/organizer/__samples__/run.ts` — manual-verification script
- `lib/organizer/apply-plan.ts` — snapshot + execute + arm undo
- `lib/organizer/undo-plan.ts` — restore from snapshot
- `lib/organizer/format-failure.ts` — LLM rewrite of structured failures
- `lib/queries/organizer.ts` — `getRecentPlans`, `getPlan`, `getActiveUndoablePlan`
- `app/(app)/organize/page.tsx` — server component shell
- `app/(app)/organize/actions.ts` — all server actions
- `app/(app)/organize/organize-chat.tsx` — client chat state machine
- `app/(app)/organize/plan-renderer.tsx` — renders one plan's steps + action buttons
- `app/(app)/organize/checklist-progress.tsx` — progress bar + checkbox list
- `app/(app)/organize/undo-banner.tsx` — countdown timer + undo button
- `app/(app)/organize/recent-plans-list.tsx` — collapsible history
- `app/(app)/organize/example-pills.tsx` — empty-state pills
- `app/(app)/organize/clarification-pills.tsx` — clarification suggestion pills

**Modified:**
- `package.json` — add `@anthropic-ai/sdk` dependency
- `.env.local.example` — add `ANTHROPIC_API_KEY` placeholder
- `components/app-shell/nav-items.ts` — add `Organize` entry under "My Portfolio"
- `docs/plan.md` — Phase entry for "Piece 2 landed"

---

## Pre-flight checks

Before starting, confirm with James:

- [ ] `ANTHROPIC_API_KEY` is in `.env.local` (and will be added to Vercel before deploy). If James doesn't have one, he creates it at console.anthropic.com first.
- [ ] `.env.local` points at hosted Supabase (default).
- [ ] Working tree is clean (`git status`).
- [ ] Branch: create `feat/piece-2-organizer` before Task 1.

---

## Task 1: Migration 0008 — organizer_plans table

**Files:**
- Create: `supabase/migrations/0008_organizer_plans.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/0008_organizer_plans.sql`:

```sql
-- Piece 2: AI organizer plan storage.
-- One row per generated plan. Plan steps + undo snapshot live as JSONB
-- on the row — they're loaded together with the plan and rarely queried
-- independently, so separate tables would just force joins for no benefit.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'organizer_plan_status') then
    create type organizer_plan_status as enum (
      'pending',
      'applied',
      'checklist',
      'completed',
      'undone',
      'dismissed'
    );
  end if;
end $$;

create table if not exists public.organizer_plans (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  prompt              text not null,
  parsed_intent       jsonb not null,
  plan_steps          jsonb not null,
  status              organizer_plan_status not null default 'pending',
  applied_at          timestamptz,
  undo_snapshot       jsonb,
  undo_expires_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_organizer_plans_user
  on public.organizer_plans(user_id, created_at desc);

create index if not exists idx_organizer_plans_active_undo
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

create or replace function public.touch_organizer_plan_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_organizer_plans_touch on public.organizer_plans;
create trigger trg_organizer_plans_touch
  before update on public.organizer_plans
  for each row execute procedure public.touch_organizer_plan_updated_at();
```

- [ ] **Step 2: Apply via MCP plugin**

Call `mcp__plugin_supabase_supabase__apply_migration`:
- `project_id`: `bzoizaakcqzlvpraysjn`
- `name`: `0008_organizer_plans`
- `query`: the SQL body from Step 1

- [ ] **Step 3: Verify table + indexes**

Call `mcp__plugin_supabase_supabase__execute_sql` with:

```sql
select column_name, data_type, is_nullable
from information_schema.columns
where table_name = 'organizer_plans'
order by ordinal_position;
```

Expected: 11 rows (id, user_id, prompt, parsed_intent, plan_steps, status, applied_at, undo_snapshot, undo_expires_at, created_at, updated_at).

Then:

```sql
select indexname from pg_indexes
where tablename = 'organizer_plans';
```

Expected: at least 3 rows (PK + the 2 named indexes).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0008_organizer_plans.sql
git commit -m "Piece 2: migration 0008 — organizer_plans table + status enum + RLS"
```

---

## Task 2: Add @anthropic-ai/sdk dependency + env var setup

**Files:**
- Modify: `package.json`
- Modify: `.env.local.example`

- [ ] **Step 1: Install the SDK**

```bash
npm install @anthropic-ai/sdk
```

- [ ] **Step 2: Update `.env.local.example`**

Append at the bottom of `.env.local.example`:

```
# Anthropic API key for the /organize AI features (Piece 2).
# Get one at https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=
```

- [ ] **Step 3: Confirm James added the key to `.env.local`**

This is a manual step. Verify:

```bash
grep "ANTHROPIC_API_KEY=" .env.local
```

Expected: a non-empty value (not just `ANTHROPIC_API_KEY=`). If empty, stop and ask James to add it before continuing.

- [ ] **Step 4: Typecheck (sanity)**

```bash
npm run typecheck
```

Expected: PASS (the SDK install itself doesn't change code, but ensures the install didn't break anything).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.local.example
git commit -m "Piece 2: add @anthropic-ai/sdk dep + ANTHROPIC_API_KEY env scaffold"
```

---

## Task 3: lib/organizer/types.ts — shared types

**Files:**
- Create: `lib/organizer/types.ts`

- [ ] **Step 1: Write the types**

```ts
// lib/organizer/types.ts
// Shared types for the AI organizer. Used across intent parsing, validation,
// the deterministic planner, apply/undo flows, and the chat UI.

// ----- Vehicle filter (one criterion's targeting) -----

export type VehicleFilter = {
  tags?: string[];          // system tag ids — match vehicle_tag_links.tag_id
  custom_tags?: string[];   // user-defined tags — match user_owned_vehicles.custom_tags
  classes?: string[];       // formatted class names ("Super", "Sports")
  manufacturers?: string[]; // manufacturer ids
};

// ----- Parsed intent (LLM output, post-validation) -----

export type ParsedIntent = {
  criteria: Array<{
    description: string;                          // human-readable label
    filter: VehicleFilter;
    target: {
      property_id: string;                        // user_owned_properties.id
      upgrade_id?: string;                        // optional — null/missing = planner picks
    };
  }>;
  unmatched_handling: "leave" | "consolidate-to-target";
};

// ----- Plan step (one move or unassignment) -----

export type PlanStep = {
  index: number;
  type: "move" | "unassign";
  owned_vehicle_id: string;
  vehicle_label: string;
  from: { property_id: string; upgrade_id: string | null; label: string };
  to:   { property_id: string | null; upgrade_id: string | null; label: string };
  reason: "user-asked" | "displaced";
  completed_at: string | null;
};

// ----- Plan summary (rendered above the step list) -----

export type PlanSummary = {
  total_steps: number;
  cars_moved: number;
  cars_unassigned: number;
  displacements: number;
  conflicts: string[];
};

// ----- Undo snapshot (pre-apply state of touched vehicles) -----

export type UndoSnapshot = {
  vehicles: Array<{
    owned_vehicle_id: string;
    stored_in_property_id: string | null;
    assigned_upgrade_id: string | null;
  }>;
};

// ----- Planner inputs / outputs -----

export type PlannerFailure =
  | {
      reason: "insufficient-capacity";
      shortBy: number;
      suggestion?: Array<{ id: string; display_name: string; capacity: number }>;
    }
  | {
      reason: "target-not-built";
      missingUpgradeIds: string[];
    };

export type PlannerResult =
  | { ok: true; steps: PlanStep[]; summary: PlanSummary }
  | { ok: false; failure: PlannerFailure };

// ----- Clarification (LLM round-trip when prompt is ambiguous) -----

export type Clarification = {
  question: string;
  suggestions: string[];
};

// ----- Conversation turn (used when the user replies to a clarification) -----

export type Turn =
  | { role: "user"; content: string }
  | { role: "assistant"; clarification: Clarification };
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/organizer/types.ts
git commit -m "Piece 2: lib/organizer/types.ts — shared types for intent/plan/snapshot"
```

---

## Task 4: lib/organizer/locations.ts — location key + capacity helpers

**Files:**
- Create: `lib/organizer/locations.ts`

- [ ] **Step 1: Write the helpers**

```ts
// lib/organizer/locations.ts
// Helpers for working with "location slots" — the smallest unit a vehicle
// can be stored in. A location is either a property's base storage
// (upgrade_id=null) or one of its installed sub-garage upgrades.

import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

/** Stable string key for a location slot. */
export type LocationKey = string;

export function locationKey(
  propertyId: string,
  upgradeId: string | null,
): LocationKey {
  return `${propertyId}:${upgradeId ?? "base"}`;
}

export function parseLocationKey(
  key: LocationKey,
): { propertyId: string; upgradeId: string | null } {
  const [propertyId, upgradePart] = key.split(":");
  return {
    propertyId,
    upgradeId: upgradePart === "base" ? null : upgradePart,
  };
}

/**
 * For a property: enumerate every storage slot it offers RIGHT NOW.
 * - If the property has installed sub-garages with capacity > 0, those are the slots.
 * - If the property has base capacity > 0 (and no installed sub-garages), the base is the slot.
 * - A property with no installed storage upgrades AND base_capacity=0 has zero slots.
 */
export function slotsForProperty(
  prop: OwnedPropertyDetail,
): Array<{ key: LocationKey; capacity: number; label: string; upgradeId: string | null }> {
  const installedStorageUpgrades = prop.upgrades.filter(
    (u) => u.is_installed && u.capacity > 0,
  );

  if (installedStorageUpgrades.length > 0) {
    return installedStorageUpgrades.map((u) => ({
      key: locationKey(prop.id, u.id),
      capacity: u.capacity,
      label: `${prop.display_name} · ${u.display_name}`,
      upgradeId: u.id,
    }));
  }

  if (prop.base_capacity > 0) {
    return [
      {
        key: locationKey(prop.id, null),
        capacity: prop.base_capacity,
        label: prop.display_name,
        upgradeId: null,
      },
    ];
  }

  return [];
}

/** Total free slots across an entire portfolio. */
export function totalFreeCapacity(
  properties: OwnedPropertyDetail[],
  occupancy: Map<LocationKey, number>,
): number {
  let total = 0;
  for (const p of properties) {
    for (const slot of slotsForProperty(p)) {
      total += slot.capacity - (occupancy.get(slot.key) ?? 0);
    }
  }
  return total;
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/organizer/locations.ts
git commit -m "Piece 2: lib/organizer/locations.ts — location-key + slot helpers"
```

---

## Task 5: lib/organizer/filter-vehicles.ts — vehicle matcher

**Files:**
- Create: `lib/organizer/filter-vehicles.ts`

- [ ] **Step 1: Write the matcher**

```ts
// lib/organizer/filter-vehicles.ts
// Decide whether an owned vehicle matches a VehicleFilter (one criterion's
// targeting). All filter fields are OR-within-field and AND-across-fields:
//
//   tags: ["drift"]                    → has tag "drift"
//   tags: ["drift", "hsw"]             → has tag "drift" OR "hsw"
//   tags: ["drift"], classes: ["Super"] → has tag "drift" AND class "Super"

import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";

import type { VehicleFilter } from "./types";

export function vehicleMatches(
  filter: VehicleFilter,
  vehicle: OwnedVehicleInstance,
  /** Manufacturer id lookup so we can match by id even though OwnedVehicleInstance only carries display. */
  manufacturerIdByDisplay: Map<string, string>,
): boolean {
  // Empty filter matches everything — defensive, but useful for "leave everything".
  const hasAny =
    (filter.tags?.length ?? 0) > 0 ||
    (filter.custom_tags?.length ?? 0) > 0 ||
    (filter.classes?.length ?? 0) > 0 ||
    (filter.manufacturers?.length ?? 0) > 0;
  if (!hasAny) return false;

  if (filter.tags && filter.tags.length > 0) {
    const hasMatch = filter.tags.some((t) => vehicle.tag_ids.includes(t));
    if (!hasMatch) return false;
  }

  if (filter.custom_tags && filter.custom_tags.length > 0) {
    const hasMatch = filter.custom_tags.some((t) =>
      vehicle.custom_tags.includes(t),
    );
    if (!hasMatch) return false;
  }

  if (filter.classes && filter.classes.length > 0) {
    if (!filter.classes.includes(vehicle.class)) return false;
  }

  if (filter.manufacturers && filter.manufacturers.length > 0) {
    const mfrId = manufacturerIdByDisplay.get(vehicle.manufacturer_display);
    if (!mfrId || !filter.manufacturers.includes(mfrId)) return false;
  }

  return true;
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add lib/organizer/filter-vehicles.ts
git commit -m "Piece 2: lib/organizer/filter-vehicles.ts — vehicleMatches helper"
```

---

## Task 6: lib/organizer/portfolio-context.ts — LLM taxonomy block

**Files:**
- Create: `lib/organizer/portfolio-context.ts`

- [ ] **Step 1: Write the assembler**

```ts
// lib/organizer/portfolio-context.ts
// Builds the per-user portfolio taxonomy text block that gets injected into
// the Claude system prompt. This block is cached (cache_control marker
// applied in intent-parser.ts) — it only invalidates when the user adds/
// removes a vehicle, property, or upgrade.

import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

export type PortfolioContextInput = {
  vehicles: OwnedVehicleInstance[];
  properties: OwnedPropertyDetail[];
  systemTags: Array<{ id: string; display: string }>;
  manufacturers: Array<{ id: string; display: string }>;
};

export function buildPortfolioContext(input: PortfolioContextInput): string {
  const lines: string[] = [];

  lines.push("--- USER PORTFOLIO ---");
  lines.push("");

  // System tags
  lines.push(
    `System tags (use these ids in filter.tags): ${input.systemTags
      .map((t) => t.id)
      .join(", ")}`,
  );

  // Custom tags (union across user's fleet)
  const customTags = Array.from(
    new Set(input.vehicles.flatMap((v) => v.custom_tags)),
  ).sort();
  if (customTags.length > 0) {
    lines.push(
      `Custom tags (user-defined, use these strings in filter.custom_tags): ${customTags.join(", ")}`,
    );
  }

  // Manufacturers (id → display)
  lines.push(
    `Manufacturer ids (use these in filter.manufacturers): ${input.manufacturers
      .map((m) => `${m.id}=${m.display}`)
      .join(", ")}`,
  );

  // Vehicle classes
  const classes = Array.from(new Set(input.vehicles.map((v) => v.class))).sort();
  lines.push(
    `Classes (use these names in filter.classes): ${classes.join(", ")}`,
  );

  lines.push("");
  lines.push(`Vehicles (${input.vehicles.length} owned instances):`);
  for (const v of input.vehicles) {
    const tagStr = v.tag_ids.length > 0 ? `[${v.tag_ids.join(", ")}]` : "[]";
    const customStr =
      v.custom_tags.length > 0 ? ` custom:[${v.custom_tags.join(", ")}]` : "";
    const storage = v.storage
      ? `${v.storage.property_display_name}${v.storage.upgrade_display_name ? ` · ${v.storage.upgrade_display_name}` : ""}`
      : "unassigned";
    const name = v.nickname ? `${v.display_name} ("${v.nickname}")` : v.display_name;
    lines.push(
      `  [${v.id}] ${name} (${v.manufacturer_display} · ${v.class}) ${tagStr}${customStr} @ ${storage}`,
    );
  }

  lines.push("");
  lines.push(`Properties (${input.properties.length} owned):`);
  for (const p of input.properties) {
    const installedUpgrades = p.upgrades.filter((u) => u.is_installed && u.capacity > 0);
    const totalCap =
      p.base_capacity +
      installedUpgrades.reduce((sum, u) => sum + u.capacity, 0);
    lines.push(
      `  [${p.id}] ${p.display_name}${p.neighborhood ? ` (${p.neighborhood})` : ""} · ${totalCap} cap total`,
    );
    if (p.base_capacity > 0 && installedUpgrades.length === 0) {
      lines.push(`    base storage · ${p.base_capacity} slots`);
    }
    for (const u of installedUpgrades) {
      lines.push(`    [${u.id}] ${u.display_name} · ${u.capacity} slots`);
    }
  }

  return lines.join("\n");
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add lib/organizer/portfolio-context.ts
git commit -m "Piece 2: lib/organizer/portfolio-context.ts — LLM taxonomy block builder"
```

---

## Task 7: lib/organizer/intent-parser.ts — Claude API call

**Files:**
- Create: `lib/organizer/intent-parser.ts`

**Note:** This task involves the Claude API + prompt caching. The implementer subagent should invoke the `claude-api` skill before writing this file — it has the latest model IDs, the canonical caching pattern, and Anthropic SDK quirks.

- [ ] **Step 1: Write the parser**

```ts
// lib/organizer/intent-parser.ts
// Calls Claude Haiku 4.5 to parse a relocation prompt into structured intent
// OR a clarification request. Uses prompt caching on the static + per-user
// taxonomy blocks so repeated queries within the same fleet/property state
// cost ~10% of the full input rate.

import Anthropic from "@anthropic-ai/sdk";

import type { Clarification, ParsedIntent, Turn } from "./types";

const MODEL = "claude-haiku-4-5";

// Behavior block — static, cached.
const BEHAVIOR_INSTRUCTIONS = `You are an intent parser for LS Portfolio, a GTA Online asset tracker. The user describes how they want their vehicles relocated across the properties they own. Your only job is to call the parse_intent tool.

You MUST:
- Use the parse_intent tool to respond (never plain text).
- Provide EITHER \`intent\` OR \`clarification\` in your tool input — never both.
- Only use property_id, upgrade_id, tag id, custom_tag, class, and manufacturer values that appear in the USER PORTFOLIO block below.
- If a request is ambiguous (target unclear, multiple matches, etc.), provide a clarification with 2-4 short suggestions.
- For compound requests like "put X in A and Y in B", emit multiple criteria in one intent.
- "leave the rest" or no mention of other cars → unmatched_handling = "leave".
- "and consolidate the rest" or similar → unmatched_handling = "consolidate-to-target".

NEVER invent ids. NEVER guess. When in doubt, clarify.`;

// Tool definition — static, cached.
const PARSE_INTENT_TOOL: Anthropic.Tool = {
  name: "parse_intent",
  description: "Parse the relocation request OR ask for clarification.",
  input_schema: {
    type: "object",
    properties: {
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
                    manufacturers: { type: "array", items: { type: "string" } },
                  },
                },
                target: {
                  type: "object",
                  properties: {
                    property_id: { type: "string" },
                    upgrade_id: { type: "string" },
                  },
                  required: ["property_id"],
                },
              },
              required: ["description", "filter", "target"],
            },
          },
          unmatched_handling: { type: "string", enum: ["leave", "consolidate-to-target"] },
        },
        required: ["criteria", "unmatched_handling"],
      },
      clarification: {
        type: "object",
        properties: {
          question: { type: "string" },
          suggestions: { type: "array", items: { type: "string" } },
        },
        required: ["question"],
      },
    },
  },
};

export type IntentParserInput = {
  prompt: string;
  portfolioContext: string;          // built by portfolio-context.ts
  clarifyingHistory?: Turn[];        // prior turns when answering a clarification
};

export type IntentParserResult =
  | { ok: true; intent: ParsedIntent }
  | { ok: false; clarification: Clarification }
  | { error: string };

export async function parseIntent(
  input: IntentParserInput,
): Promise<IntentParserResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { error: "ANTHROPIC_API_KEY not configured." };

  const client = new Anthropic({ apiKey });

  const messages: Anthropic.MessageParam[] = [];

  // Replay any prior clarification round-trip so the model has full context.
  for (const turn of input.clarifyingHistory ?? []) {
    if (turn.role === "user") {
      messages.push({ role: "user", content: turn.content });
    } else {
      // Assistant clarification — represent as the previous tool_use response.
      // Simpler: emit as plain assistant text describing the prior clarification.
      messages.push({
        role: "assistant",
        content: `Previously I asked: "${turn.clarification.question}"`,
      });
    }
  }
  messages.push({ role: "user", content: input.prompt });

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: [
        // Behavior + tool schema block — static, cached.
        {
          type: "text",
          text: BEHAVIOR_INSTRUCTIONS,
          cache_control: { type: "ephemeral" },
        },
        // Portfolio taxonomy block — per-user, cached.
        {
          type: "text",
          text: input.portfolioContext,
          cache_control: { type: "ephemeral" },
        },
      ],
      tools: [PARSE_INTENT_TOOL],
      tool_choice: { type: "tool", name: "parse_intent" },
      messages,
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }

  // Extract the tool_use block.
  const toolUse = response.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) return { error: "Model did not call parse_intent tool." };

  const inp = toolUse.input as {
    intent?: ParsedIntent;
    clarification?: Clarification;
  };

  if (inp.intent) return { ok: true, intent: inp.intent };
  if (inp.clarification) return { ok: false, clarification: inp.clarification };
  return { error: "Tool input contained neither intent nor clarification." };
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/organizer/intent-parser.ts
git commit -m "Piece 2: lib/organizer/intent-parser.ts — Claude Haiku 4.5 intent parser with prompt caching"
```

---

## Task 8: lib/organizer/validate-intent.ts — server-side validation

**Files:**
- Create: `lib/organizer/validate-intent.ts`

- [ ] **Step 1: Write the validator**

```ts
// lib/organizer/validate-intent.ts
// LLM can hallucinate ids. Validate every property_id, upgrade_id, and tag
// against the user's actual data before handing the intent to the planner.

import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import type { ParsedIntent } from "./types";

export type ValidationOk = { ok: true };
export type ValidationFail = { ok: false; reason: string };

export function validateIntent(
  intent: ParsedIntent,
  ownedProperties: OwnedPropertyDetail[],
  systemTagIds: Set<string>,
  manufacturerIds: Set<string>,
  classNames: Set<string>,
): ValidationOk | ValidationFail {
  const propertyIds = new Set(ownedProperties.map((p) => p.id));
  const upgradeIdsByProperty = new Map<string, Set<string>>();
  for (const p of ownedProperties) {
    upgradeIdsByProperty.set(
      p.id,
      new Set(p.upgrades.filter((u) => u.is_installed).map((u) => u.id)),
    );
  }

  if (intent.criteria.length === 0) {
    return { ok: false, reason: "Intent has no criteria." };
  }

  for (const c of intent.criteria) {
    if (!propertyIds.has(c.target.property_id)) {
      return {
        ok: false,
        reason: `Property ${c.target.property_id} is not owned by this user.`,
      };
    }
    if (c.target.upgrade_id) {
      const installed = upgradeIdsByProperty.get(c.target.property_id);
      if (!installed || !installed.has(c.target.upgrade_id)) {
        return {
          ok: false,
          reason: `Upgrade ${c.target.upgrade_id} is not installed on the target property.`,
        };
      }
    }

    for (const t of c.filter.tags ?? []) {
      if (!systemTagIds.has(t)) {
        return { ok: false, reason: `Unknown system tag: ${t}` };
      }
    }
    for (const cls of c.filter.classes ?? []) {
      if (!classNames.has(cls)) {
        return { ok: false, reason: `Unknown vehicle class: ${cls}` };
      }
    }
    for (const m of c.filter.manufacturers ?? []) {
      if (!manufacturerIds.has(m)) {
        return { ok: false, reason: `Unknown manufacturer id: ${m}` };
      }
    }
    // custom_tags can be anything — they're user-defined free text. No check.
  }

  return { ok: true };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add lib/organizer/validate-intent.ts
git commit -m "Piece 2: lib/organizer/validate-intent.ts — server-side ID/tag validation"
```

---

## Task 9: lib/organizer/planner.ts — the deterministic algorithm

**Files:**
- Create: `lib/organizer/planner.ts`

This is the meatiest file. ~200 lines of pure algorithm.

- [ ] **Step 1: Write the planner**

```ts
// lib/organizer/planner.ts
// Deterministic chained-displacement planner. Pure function — same inputs
// always produce the same plan. No LLM involved here; the LLM's job ended
// once it produced a validated ParsedIntent.

import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

import { vehicleMatches } from "./filter-vehicles";
import {
  type LocationKey,
  locationKey,
  parseLocationKey,
  slotsForProperty,
  totalFreeCapacity,
} from "./locations";
import type {
  ParsedIntent,
  PlanStep,
  PlanSummary,
  PlannerResult,
  VehicleFilter,
} from "./types";

export type PlannerInput = {
  intent: ParsedIntent;
  portfolio: {
    vehicles: OwnedVehicleInstance[];
    properties: OwnedPropertyDetail[];
  };
  manufacturerIdByDisplay: Map<string, string>;
};

type WorkingState = {
  vehicleLocation: Map<string, LocationKey | "unassigned">;
  occupancy: Map<LocationKey, number>;
  capacity: Map<LocationKey, number>;
  // Property id → ordered list of slot keys, largest-capacity first.
  slotsByProperty: Map<string, Array<{ key: LocationKey; capacity: number; label: string; upgradeId: string | null }>>;
  // Property + upgrade id → human label for step UI.
  slotLabels: Map<LocationKey, string>;
  steps: PlanStep[];
  stepIndex: number;
  conflicts: string[];
};

function buildState(input: PlannerInput): WorkingState {
  const state: WorkingState = {
    vehicleLocation: new Map(),
    occupancy: new Map(),
    capacity: new Map(),
    slotsByProperty: new Map(),
    slotLabels: new Map(),
    steps: [],
    stepIndex: 0,
    conflicts: [],
  };

  for (const p of input.portfolio.properties) {
    const slots = slotsForProperty(p).sort((a, b) => b.capacity - a.capacity);
    state.slotsByProperty.set(p.id, slots);
    for (const slot of slots) {
      state.capacity.set(slot.key, slot.capacity);
      state.occupancy.set(slot.key, 0);
      state.slotLabels.set(slot.key, slot.label);
    }
  }

  for (const v of input.portfolio.vehicles) {
    if (v.storage) {
      const key = locationKey(
        v.storage.owned_property_id,
        v.storage.assigned_upgrade_id,
      );
      state.vehicleLocation.set(v.id, key);
      state.occupancy.set(key, (state.occupancy.get(key) ?? 0) + 1);
    } else {
      state.vehicleLocation.set(v.id, "unassigned");
    }
  }

  return state;
}

function labelForSlot(state: WorkingState, key: LocationKey): string {
  return state.slotLabels.get(key) ?? key;
}

/** Free space at a specific slot. */
function freeAt(state: WorkingState, key: LocationKey): number {
  return (state.capacity.get(key) ?? 0) - (state.occupancy.get(key) ?? 0);
}

/** Find the best-fit-largest-free slot ANYWHERE in the portfolio (for displacement targets). */
function bestFitSlot(
  state: WorkingState,
  excludeKey?: LocationKey,
): LocationKey | null {
  let best: LocationKey | null = null;
  let bestFree = 0;
  for (const [key, cap] of state.capacity) {
    if (excludeKey && key === excludeKey) continue;
    const free = cap - (state.occupancy.get(key) ?? 0);
    if (free > bestFree) {
      best = key;
      bestFree = free;
    }
  }
  return best;
}

/** Pick which slot WITHIN a property to use for placement (largest free first; spill across). */
function pickPropertySlot(
  state: WorkingState,
  propertyId: string,
  preferredUpgradeId?: string,
): LocationKey | null {
  if (preferredUpgradeId) {
    const k = locationKey(propertyId, preferredUpgradeId);
    if (freeAt(state, k) > 0) return k;
    // Preferred slot full — try fallbacks within same property.
  }
  const slots = state.slotsByProperty.get(propertyId) ?? [];
  for (const slot of slots) {
    if (freeAt(state, slot.key) > 0) return slot.key;
  }
  return null;
}

function emitMove(
  state: WorkingState,
  vehicle: OwnedVehicleInstance,
  toKey: LocationKey,
  reason: "user-asked" | "displaced",
): void {
  const fromKey = state.vehicleLocation.get(vehicle.id);
  const fromParsed =
    fromKey && fromKey !== "unassigned" ? parseLocationKey(fromKey) : null;
  const toParsed = parseLocationKey(toKey);

  state.steps.push({
    index: state.stepIndex++,
    type: "move",
    owned_vehicle_id: vehicle.id,
    vehicle_label: vehicle.nickname ?? vehicle.display_name,
    from: {
      property_id: fromParsed?.propertyId ?? "",
      upgrade_id: fromParsed?.upgradeId ?? null,
      label:
        fromKey === "unassigned" || !fromKey
          ? "Unassigned"
          : labelForSlot(state, fromKey),
    },
    to: {
      property_id: toParsed.propertyId,
      upgrade_id: toParsed.upgradeId,
      label: labelForSlot(state, toKey),
    },
    reason,
    completed_at: null,
  });

  // Update state.
  if (fromKey && fromKey !== "unassigned") {
    state.occupancy.set(fromKey, (state.occupancy.get(fromKey) ?? 1) - 1);
  }
  state.occupancy.set(toKey, (state.occupancy.get(toKey) ?? 0) + 1);
  state.vehicleLocation.set(vehicle.id, toKey);
}

function emitUnassign(state: WorkingState, vehicle: OwnedVehicleInstance): void {
  const fromKey = state.vehicleLocation.get(vehicle.id);
  const fromParsed =
    fromKey && fromKey !== "unassigned" ? parseLocationKey(fromKey) : null;

  state.steps.push({
    index: state.stepIndex++,
    type: "unassign",
    owned_vehicle_id: vehicle.id,
    vehicle_label: vehicle.nickname ?? vehicle.display_name,
    from: {
      property_id: fromParsed?.propertyId ?? "",
      upgrade_id: fromParsed?.upgradeId ?? null,
      label:
        fromKey === "unassigned" || !fromKey
          ? "Unassigned"
          : labelForSlot(state, fromKey),
    },
    to: { property_id: null, upgrade_id: null, label: "Unassigned" },
    reason: "displaced",
    completed_at: null,
  });

  if (fromKey && fromKey !== "unassigned") {
    state.occupancy.set(fromKey, (state.occupancy.get(fromKey) ?? 1) - 1);
  }
  state.vehicleLocation.set(vehicle.id, "unassigned");
}

export function generatePlan(input: PlannerInput): PlannerResult {
  const state = buildState(input);
  const { intent, portfolio } = input;
  const vehiclesById = new Map(portfolio.vehicles.map((v) => [v.id, v]));

  // Track which vehicles match ANY criterion (for displacement-victim selection).
  const allCriteriaUnion: VehicleFilter[] = intent.criteria.map((c) => c.filter);

  const matchesAnyCriterion = (v: OwnedVehicleInstance): boolean =>
    allCriteriaUnion.some((f) =>
      vehicleMatches(f, v, input.manufacturerIdByDisplay),
    );

  // Pre-flight: insufficient total capacity?
  const vehiclesToMoveCount = portfolio.vehicles.filter((v) =>
    intent.criteria.some((c) =>
      vehicleMatches(c.filter, v, input.manufacturerIdByDisplay),
    ),
  ).length;
  const totalFree = totalFreeCapacity(portfolio.properties, state.occupancy);
  // Note: totalFree counts CURRENT free slots; the algorithm may still succeed by
  // displacing within the portfolio, but if vehiclesToMoveCount > total occupiable
  // slots overall, no plan can work.
  const totalCapacity = Array.from(state.capacity.values()).reduce((a, b) => a + b, 0);
  if (portfolio.vehicles.length > totalCapacity) {
    return {
      ok: false,
      failure: {
        reason: "insufficient-capacity",
        shortBy: portfolio.vehicles.length - totalCapacity,
      },
    };
  }

  // Validate every target's upgrade is installed (planner-level check; the
  // server already validated, this is defense in depth).
  for (const c of intent.criteria) {
    if (c.target.upgrade_id) {
      const k = locationKey(c.target.property_id, c.target.upgrade_id);
      if (!state.capacity.has(k)) {
        return {
          ok: false,
          failure: {
            reason: "target-not-built",
            missingUpgradeIds: [c.target.upgrade_id],
          },
        };
      }
    }
  }

  // Main loop: process criteria in order.
  for (const criterion of intent.criteria) {
    const matchingVehicles = portfolio.vehicles.filter((v) =>
      vehicleMatches(criterion.filter, v, input.manufacturerIdByDisplay),
    );

    for (const v of matchingVehicles) {
      // Skip if already at the target property (and, if upgrade specified, the target slot).
      const currentKey = state.vehicleLocation.get(v.id);
      if (currentKey && currentKey !== "unassigned") {
        const cur = parseLocationKey(currentKey);
        if (cur.propertyId === criterion.target.property_id) {
          if (
            !criterion.target.upgrade_id ||
            cur.upgradeId === criterion.target.upgrade_id
          ) {
            continue; // already where we want
          }
        }
      }

      // Find a slot at the target property.
      let toKey = pickPropertySlot(
        state,
        criterion.target.property_id,
        criterion.target.upgrade_id,
      );

      if (!toKey) {
        // Target full. Displace a victim.
        const targetSlots = state.slotsByProperty.get(criterion.target.property_id) ?? [];
        // Pick the slot with the most cars first (so we can find a victim).
        const slotToFreeFrom = targetSlots[0]?.key;
        if (!slotToFreeFrom) {
          // Property has zero slots — unrecoverable for this vehicle.
          emitUnassign(state, v);
          continue;
        }

        // Find a victim AT that slot, preferring vehicles not matching any criterion.
        const occupants = portfolio.vehicles.filter(
          (occ) => state.vehicleLocation.get(occ.id) === slotToFreeFrom,
        );
        const nonMatchVictims = occupants.filter((o) => !matchesAnyCriterion(o));
        const matchVictims = occupants.filter((o) => matchesAnyCriterion(o));
        // Within each group, oldest created_at first (defensive: data may lack created_at — fall back to id order)
        const sortByOldest = (a: OwnedVehicleInstance, b: OwnedVehicleInstance) =>
          a.id.localeCompare(b.id);
        const victim =
          nonMatchVictims.sort(sortByOldest)[0] ??
          matchVictims.sort(sortByOldest)[0];

        if (!victim) {
          emitUnassign(state, v);
          continue;
        }

        // Find a new home for the victim.
        const victimDest = bestFitSlot(state, slotToFreeFrom);
        if (!victimDest) {
          // Nowhere for the victim — unassign them.
          emitUnassign(state, victim);
        } else {
          emitMove(state, victim, victimDest, "displaced");
        }

        // Now place the target vehicle.
        toKey = pickPropertySlot(
          state,
          criterion.target.property_id,
          criterion.target.upgrade_id,
        );
        if (!toKey) {
          // Still no room (e.g., victim left but slot is a specific upgrade that's still full).
          emitUnassign(state, v);
          continue;
        }
      }

      emitMove(state, v, toKey, "user-asked");
    }
  }

  // unmatched_handling = "consolidate-to-target" → take any still-unassigned
  // (or non-matched) vehicles and try to fit them in the LAST criterion's target.
  if (intent.unmatched_handling === "consolidate-to-target" && intent.criteria.length > 0) {
    const lastTarget = intent.criteria[intent.criteria.length - 1].target;
    const unmatched = portfolio.vehicles.filter((v) => !matchesAnyCriterion(v));
    for (const v of unmatched) {
      const currentKey = state.vehicleLocation.get(v.id);
      if (currentKey && currentKey !== "unassigned") {
        const cur = parseLocationKey(currentKey);
        if (cur.propertyId === lastTarget.property_id) continue;
      }
      const toKey = pickPropertySlot(state, lastTarget.property_id, lastTarget.upgrade_id);
      if (!toKey) break; // target full — stop trying
      emitMove(state, v, toKey, "user-asked");
    }
  }

  // Order steps: all displacements first, then placements (already mostly in this
  // order due to emit order, but explicit sort guarantees executability).
  state.steps.sort((a, b) => {
    if (a.reason === "displaced" && b.reason !== "displaced") return -1;
    if (a.reason !== "displaced" && b.reason === "displaced") return 1;
    return a.index - b.index;
  });
  // Re-index after sort.
  state.steps.forEach((s, i) => {
    s.index = i;
  });

  // Build summary.
  const carsMoved = state.steps.filter(
    (s) => s.type === "move" && s.reason === "user-asked",
  ).length;
  const carsUnassigned = state.steps.filter((s) => s.type === "unassign").length;
  const displacements = state.steps.filter(
    (s) => s.reason === "displaced" && s.type === "move",
  ).length;

  // Conflict notes: vehicles that matched multiple criteria.
  const multiMatch = portfolio.vehicles.filter((v) => {
    const matchCount = intent.criteria.filter((c) =>
      vehicleMatches(c.filter, v, input.manufacturerIdByDisplay),
    ).length;
    return matchCount > 1;
  });
  if (multiMatch.length > 0) {
    state.conflicts.push(
      `${multiMatch.length} vehicle(s) matched multiple criteria — used the first match for each.`,
    );
  }

  const summary: PlanSummary = {
    total_steps: state.steps.length,
    cars_moved: carsMoved,
    cars_unassigned: carsUnassigned,
    displacements,
    conflicts: state.conflicts,
  };

  return { ok: true, steps: state.steps, summary };
}
```

- [ ] **Step 2: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/organizer/planner.ts
git commit -m "Piece 2: lib/organizer/planner.ts — deterministic chained-displacement planner"
```

---

## Task 10: lib/organizer/__samples__/ — fixtures for manual verification

**Files:**
- Create: `lib/organizer/__samples__/sample-plans.ts`
- Create: `lib/organizer/__samples__/run.ts`

- [ ] **Step 1: Write sample fixtures**

Create `lib/organizer/__samples__/sample-plans.ts`:

```ts
// Hand-crafted (portfolio, intent) tuples with expected plan summaries.
// Run via `tsx lib/organizer/__samples__/run.ts` to eyeball-verify the
// planner's output against expectations.

import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import type { ParsedIntent } from "../types";

export type Sample = {
  name: string;
  description: string;
  vehicles: OwnedVehicleInstance[];
  properties: OwnedPropertyDetail[];
  intent: ParsedIntent;
  expect: {
    ok: boolean;
    carsMoved?: number;
    carsUnassigned?: number;
    totalSteps?: number;
  };
};

// Minimal vehicle factory (most fields stubbed for the planner — it only
// touches storage, custom_tags, tag_ids, class, manufacturer_display, id, nickname, display_name).
function v(
  id: string,
  display_name: string,
  className: string,
  tags: string[],
  storage: { property: string; upgrade?: string } | null,
): OwnedVehicleInstance {
  return {
    id,
    vehicle_id: `vid-${id}`,
    display_name,
    class: className,
    manufacturer_display: "Mock",
    image_path: null,
    nickname: null,
    notes: null,
    custom_tags: [],
    tag_ids: tags,
    storage: storage
      ? {
          owned_property_id: storage.property,
          property_display_name: storage.property,
          property_subtype_display: "Mock",
          assigned_upgrade_id: storage.upgrade ?? null,
          upgrade_display_name: storage.upgrade ?? null,
        }
      : null,
  };
}

function p(
  id: string,
  display_name: string,
  baseCapacity: number,
  upgrades: Array<{ id: string; capacity: number; installed: boolean }>,
): OwnedPropertyDetail {
  return {
    id,
    property_id: `pid-${id}`,
    display_name,
    subtype: "mock",
    subtype_display: "Mock",
    neighborhood: null,
    image_path: null,
    base_capacity: baseCapacity,
    ownership_group: id,
    total_upgrades: upgrades.length,
    installed_upgrades: upgrades.filter((u) => u.installed).length,
    total_cars: 0,
    upgrades: upgrades.map((u, i) => ({
      id: u.id,
      display_name: u.id,
      capacity: u.capacity,
      required_upgrade_id: null,
      sort_order: i,
      is_installed: u.installed,
      cars_here: 0,
    })),
  };
}

export const SAMPLES: Sample[] = [
  {
    name: "simple-fit",
    description: "Move 2 drift cars into empty Mission Row L1.",
    vehicles: [
      v("car1", "Banshee", "Sports", ["drift"], { property: "la-mesa", upgrade: "la-mesa-l1" }),
      v("car2", "Sultan", "Sports", ["drift"], { property: "la-mesa", upgrade: "la-mesa-l1" }),
    ],
    properties: [
      p("la-mesa", "La Mesa", 0, [{ id: "la-mesa-l1", capacity: 10, installed: true }]),
      p("mission-row", "Mission Row", 0, [{ id: "mr-l1", capacity: 10, installed: true }]),
    ],
    intent: {
      criteria: [{ description: "drift cars", filter: { tags: ["drift"] }, target: { property_id: "mission-row" } }],
      unmatched_handling: "leave",
    },
    expect: { ok: true, carsMoved: 2, carsUnassigned: 0, totalSteps: 2 },
  },
  {
    name: "displacement",
    description: "Target full; one non-matching car displaced.",
    vehicles: [
      v("drift1", "Banshee", "Sports", ["drift"], { property: "la-mesa", upgrade: "la-l1" }),
      v("drift2", "Sultan", "Sports", ["drift"], { property: "la-mesa", upgrade: "la-l1" }),
      v("filler1", "Adder", "Super", [], { property: "mission-row", upgrade: "mr-l1" }),
      v("filler2", "Zentorno", "Super", [], { property: "mission-row", upgrade: "mr-l1" }),
    ],
    properties: [
      p("la-mesa", "La Mesa", 0, [{ id: "la-l1", capacity: 10, installed: true }]),
      p("mission-row", "Mission Row", 0, [{ id: "mr-l1", capacity: 2, installed: true }]),
    ],
    intent: {
      criteria: [{ description: "drift cars", filter: { tags: ["drift"] }, target: { property_id: "mission-row" } }],
      unmatched_handling: "leave",
    },
    expect: { ok: true, carsMoved: 2, carsUnassigned: 0, totalSteps: 4 }, // 2 displacements + 2 moves
  },
  {
    name: "compound",
    description: "Compound query: drift cars to Mission Row, supers to Eclipse.",
    vehicles: [
      v("d1", "Banshee", "Sports", ["drift"], { property: "la-mesa", upgrade: "la-l1" }),
      v("d2", "Sultan", "Sports", ["drift"], { property: "la-mesa", upgrade: "la-l1" }),
      v("s1", "Zentorno", "Super", [], { property: "la-mesa", upgrade: "la-l1" }),
      v("s2", "Adder", "Super", [], { property: "la-mesa", upgrade: "la-l1" }),
    ],
    properties: [
      p("la-mesa", "La Mesa", 0, [{ id: "la-l1", capacity: 10, installed: true }]),
      p("mission-row", "Mission Row", 0, [{ id: "mr-l1", capacity: 5, installed: true }]),
      p("eclipse", "Eclipse Apt 30", 10, []),
    ],
    intent: {
      criteria: [
        { description: "drift cars", filter: { tags: ["drift"] }, target: { property_id: "mission-row" } },
        { description: "supers", filter: { classes: ["Super"] }, target: { property_id: "eclipse" } },
      ],
      unmatched_handling: "leave",
    },
    expect: { ok: true, carsMoved: 4, carsUnassigned: 0, totalSteps: 4 },
  },
  {
    name: "insufficient-capacity",
    description: "More vehicles than total slots — fail gracefully.",
    vehicles: [
      v("c1", "A", "Sports", [], null),
      v("c2", "B", "Sports", [], null),
      v("c3", "C", "Sports", [], null),
    ],
    properties: [
      p("only", "Only Apt", 2, []),
    ],
    intent: {
      criteria: [{ description: "everything", filter: { classes: ["Sports"] }, target: { property_id: "only" } }],
      unmatched_handling: "leave",
    },
    expect: { ok: false },
  },
];
```

- [ ] **Step 2: Write the runner**

Create `lib/organizer/__samples__/run.ts`:

```ts
// Run: tsx lib/organizer/__samples__/run.ts
// Eyeball verification of the planner against the fixtures in sample-plans.ts.

import { generatePlan } from "../planner";
import { SAMPLES } from "./sample-plans";

let passCount = 0;
let failCount = 0;

for (const s of SAMPLES) {
  const result = generatePlan({
    intent: s.intent,
    portfolio: { vehicles: s.vehicles, properties: s.properties },
    manufacturerIdByDisplay: new Map([["Mock", "mock-mfr"]]),
  });

  const pass =
    result.ok === s.expect.ok &&
    (!s.expect.ok ||
      (result.ok &&
        (s.expect.carsMoved === undefined || result.summary.cars_moved === s.expect.carsMoved) &&
        (s.expect.carsUnassigned === undefined || result.summary.cars_unassigned === s.expect.carsUnassigned) &&
        (s.expect.totalSteps === undefined || result.summary.total_steps === s.expect.totalSteps)));

  if (pass) {
    passCount++;
    console.log(`✓ ${s.name} — ${s.description}`);
  } else {
    failCount++;
    console.log(`✗ ${s.name} — ${s.description}`);
    console.log(`  expected: ${JSON.stringify(s.expect)}`);
    if (result.ok) {
      console.log(`  actual:   ${JSON.stringify({ ok: true, summary: result.summary })}`);
      console.log(`  steps:`);
      for (const st of result.steps) {
        console.log(`    [${st.index}] ${st.type} ${st.vehicle_label}: ${st.from.label} → ${st.to.label} (${st.reason})`);
      }
    } else {
      console.log(`  actual:   ${JSON.stringify({ ok: false, failure: result.failure })}`);
    }
  }
}

console.log(`\n${passCount} passed, ${failCount} failed`);
process.exit(failCount === 0 ? 0 : 1);
```

- [ ] **Step 3: Run the samples**

```bash
npx tsx lib/organizer/__samples__/run.ts
```

Expected: All 4 samples report ✓ pass.

If any fail, the planner has a bug — fix it before continuing.

- [ ] **Step 4: Commit**

```bash
git add lib/organizer/__samples__/
git commit -m "Piece 2: planner sample fixtures + manual-verification runner"
```

---

## Task 11: lib/organizer/apply-plan.ts — snapshot + execute + arm undo

**Files:**
- Create: `lib/organizer/apply-plan.ts`

- [ ] **Step 1: Write the apply function**

```ts
// lib/organizer/apply-plan.ts
// Applies a generated plan to the DB. Snapshots all affected vehicles'
// current storage BEFORE making any change, so undoPlan() can restore.
// 1-hour undo window armed via undo_expires_at.

import { createClient } from "@/lib/supabase/server";

import type { PlanStep, UndoSnapshot } from "./types";

const UNDO_WINDOW_MINUTES = 60;

export type ApplyPlanResult =
  | { ok: true; undoExpiresAt: string }
  | { error: string };

export async function applyPlan(planId: string): Promise<ApplyPlanResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // 1. Load the plan + verify ownership + status.
  const { data: plan, error: loadErr } = await supabase
    .from("organizer_plans")
    .select("id, plan_steps, status")
    .eq("id", planId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (loadErr || !plan) return { error: loadErr?.message ?? "Plan not found." };
  if (plan.status !== "pending") return { error: `Plan is ${plan.status}, not pending.` };

  const steps = plan.plan_steps as PlanStep[];
  const affectedVehicleIds = Array.from(
    new Set(steps.map((s) => s.owned_vehicle_id)),
  );

  // 2. Snapshot the current storage state of every affected vehicle.
  const { data: currentRows, error: snapErr } = await supabase
    .from("user_owned_vehicles")
    .select("id, stored_in_property_id, assigned_upgrade_id")
    .in("id", affectedVehicleIds)
    .eq("user_id", user.id);
  if (snapErr) return { error: snapErr.message };

  const snapshot: UndoSnapshot = {
    vehicles: (currentRows ?? []).map((r) => ({
      owned_vehicle_id: r.id,
      stored_in_property_id: r.stored_in_property_id,
      assigned_upgrade_id: r.assigned_upgrade_id,
    })),
  };

  const undoExpiresAt = new Date(
    Date.now() + UNDO_WINDOW_MINUTES * 60 * 1000,
  ).toISOString();

  // 3. Write the snapshot and arm the undo window BEFORE applying moves.
  // If anything below fails, the snapshot survives so the user can undo via
  // /organize directly (manual recovery).
  const { error: armErr } = await supabase
    .from("organizer_plans")
    .update({
      undo_snapshot: snapshot,
      undo_expires_at: undoExpiresAt,
    })
    .eq("id", planId);
  if (armErr) return { error: armErr.message };

  // 4. Apply each step sequentially.
  for (const step of steps) {
    const patch =
      step.type === "unassign"
        ? { stored_in_property_id: null, assigned_upgrade_id: null }
        : {
            stored_in_property_id: step.to.property_id,
            assigned_upgrade_id: step.to.upgrade_id,
          };
    const { error } = await supabase
      .from("user_owned_vehicles")
      .update(patch)
      .eq("id", step.owned_vehicle_id)
      .eq("user_id", user.id);
    if (error) {
      // Partial failure — leave the snapshot in place; user can undo to
      // recover. Don't try to manually rollback (would race).
      return { error: `Step ${step.index} failed: ${error.message}` };
    }
  }

  // 5. Mark applied.
  const { error: finalErr } = await supabase
    .from("organizer_plans")
    .update({
      status: "applied",
      applied_at: new Date().toISOString(),
    })
    .eq("id", planId);
  if (finalErr) return { error: finalErr.message };

  return { ok: true, undoExpiresAt };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add lib/organizer/apply-plan.ts
git commit -m "Piece 2: apply-plan.ts — snapshot, execute steps, arm 1hr undo window"
```

---

## Task 12: lib/organizer/undo-plan.ts — restore from snapshot

**Files:**
- Create: `lib/organizer/undo-plan.ts`

- [ ] **Step 1: Write the undo function**

```ts
// lib/organizer/undo-plan.ts
// Restores affected vehicles to their pre-apply state from the snapshot
// stored on the organizer_plans row. Only works while undo_expires_at > now
// and status is 'applied'.

import { createClient } from "@/lib/supabase/server";

import type { UndoSnapshot } from "./types";

export type UndoPlanResult =
  | { ok: true }
  | { error: "expired" | "already-undone" | "not-applied" | string };

export async function undoPlan(planId: string): Promise<UndoPlanResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: plan, error: loadErr } = await supabase
    .from("organizer_plans")
    .select("id, status, undo_snapshot, undo_expires_at")
    .eq("id", planId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (loadErr || !plan) return { error: loadErr?.message ?? "Plan not found." };

  if (plan.status === "undone") return { error: "already-undone" };
  if (plan.status !== "applied") return { error: "not-applied" };
  if (!plan.undo_expires_at || new Date(plan.undo_expires_at) < new Date()) {
    return { error: "expired" };
  }

  const snapshot = plan.undo_snapshot as UndoSnapshot | null;
  if (!snapshot) return { error: "No snapshot — cannot undo." };

  for (const v of snapshot.vehicles) {
    const { error } = await supabase
      .from("user_owned_vehicles")
      .update({
        stored_in_property_id: v.stored_in_property_id,
        assigned_upgrade_id: v.assigned_upgrade_id,
      })
      .eq("id", v.owned_vehicle_id)
      .eq("user_id", user.id);
    if (error) return { error: `Failed to restore vehicle ${v.owned_vehicle_id}: ${error.message}` };
  }

  const { error: finalErr } = await supabase
    .from("organizer_plans")
    .update({
      status: "undone",
      undo_expires_at: null,
    })
    .eq("id", planId);
  if (finalErr) return { error: finalErr.message };

  return { ok: true };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add lib/organizer/undo-plan.ts
git commit -m "Piece 2: undo-plan.ts — restore from snapshot within undo window"
```

---

## Task 13: lib/organizer/format-failure.ts — LLM message rewriter

**Files:**
- Create: `lib/organizer/format-failure.ts`

**Note:** This also calls the Claude API. The `claude-api` skill should be re-invoked or the existing context applies.

- [ ] **Step 1: Write the formatter**

```ts
// lib/organizer/format-failure.ts
// One extra LLM call: rewrites the planner's structured failure into a
// friendly user-facing message. Adds ~$0.001 per failed plan generation.
// Uses Haiku 4.5 for cost; no prompt caching needed (rare event, small input).

import Anthropic from "@anthropic-ai/sdk";

import type { PlannerFailure } from "./types";

const MODEL = "claude-haiku-4-5";

export type FormatFailureInput = {
  failure: PlannerFailure;
  promptText: string;        // the user's original prompt for context
};

export async function formatFailure(
  input: FormatFailureInput,
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    // Fall back to a generic message if API key is missing.
    return defaultMessage(input.failure);
  }

  const client = new Anthropic({ apiKey });

  const failureSummary =
    input.failure.reason === "insufficient-capacity"
      ? `Total fleet exceeds total storage by ${input.failure.shortBy} cars. Suggestions: ${
          input.failure.suggestion
            ?.map((s) => `${s.display_name} (${s.capacity})`)
            .join(", ") ?? "none"
        }`
      : `Target requires uninstalled upgrades: ${input.failure.missingUpgradeIds.join(", ")}`;

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `The user asked: "${input.promptText}"\n\nThe planner failed with: ${failureSummary}\n\nWrite a friendly 2-3 sentence message explaining the problem and what they can do next. Be specific about counts and properties. End with a one-line suggested next step.`,
        },
      ],
    });

    const textBlock = response.content.find(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    return textBlock?.text ?? defaultMessage(input.failure);
  } catch {
    return defaultMessage(input.failure);
  }
}

function defaultMessage(failure: PlannerFailure): string {
  if (failure.reason === "insufficient-capacity") {
    return `Can't fit that one — you need about ${failure.shortBy} more storage slot${failure.shortBy === 1 ? "" : "s"}. Try browsing /properties for a bigger garage.`;
  }
  return `That target needs an upgrade that isn't installed yet. Install it from /my-properties first.`;
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add lib/organizer/format-failure.ts
git commit -m "Piece 2: format-failure.ts — LLM rewrite of planner failures for friendly UX"
```

---

## Task 14: lib/queries/organizer.ts — DB queries

**Files:**
- Create: `lib/queries/organizer.ts`

- [ ] **Step 1: Write the queries**

```ts
// lib/queries/organizer.ts
import { createClient } from "@/lib/supabase/server";

import type { PlanStep } from "@/lib/organizer/types";

export type PlanSummaryRow = {
  id: string;
  prompt: string;
  status: string;
  applied_at: string | null;
  created_at: string;
  step_count: number;
  completed_count: number;
};

export type OrganizerPlan = {
  id: string;
  prompt: string;
  status: string;
  plan_steps: PlanStep[];
  applied_at: string | null;
  undo_expires_at: string | null;
  created_at: string;
};

export async function getRecentPlans(
  userId: string,
  limit = 10,
): Promise<PlanSummaryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizer_plans")
    .select("id, prompt, status, applied_at, created_at, plan_steps")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  return (data ?? []).map((row) => {
    const steps = (row.plan_steps as PlanStep[]) ?? [];
    return {
      id: row.id,
      prompt: row.prompt,
      status: row.status,
      applied_at: row.applied_at,
      created_at: row.created_at,
      step_count: steps.length,
      completed_count: steps.filter((s) => s.completed_at !== null).length,
    };
  });
}

export async function getPlan(planId: string): Promise<OrganizerPlan | null> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("organizer_plans")
    .select("id, prompt, status, plan_steps, applied_at, undo_expires_at, created_at")
    .eq("id", planId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;

  return {
    ...data,
    plan_steps: (data.plan_steps as PlanStep[]) ?? [],
  };
}

export async function getActiveUndoablePlan(
  userId: string,
): Promise<OrganizerPlan | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizer_plans")
    .select("id, prompt, status, plan_steps, applied_at, undo_expires_at, created_at")
    .eq("user_id", userId)
    .eq("status", "applied")
    .gt("undo_expires_at", new Date().toISOString())
    .order("applied_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  return {
    ...data,
    plan_steps: (data.plan_steps as PlanStep[]) ?? [],
  };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add lib/queries/organizer.ts
git commit -m "Piece 2: lib/queries/organizer.ts — getRecentPlans, getPlan, getActiveUndoablePlan"
```

---

## Task 15: app/(app)/organize/actions.ts — server actions

**Files:**
- Create: `app/(app)/organize/actions.ts`

- [ ] **Step 1: Write all server actions**

```ts
"use server";

import { revalidatePath } from "next/cache";

import { applyPlan as applyPlanLib } from "@/lib/organizer/apply-plan";
import { formatFailure } from "@/lib/organizer/format-failure";
import { parseIntent as parseIntentLib } from "@/lib/organizer/intent-parser";
import { generatePlan as generatePlanLib } from "@/lib/organizer/planner";
import { buildPortfolioContext } from "@/lib/organizer/portfolio-context";
import type {
  Clarification,
  ParsedIntent,
  PlanStep,
  PlanSummary,
  Turn,
} from "@/lib/organizer/types";
import { undoPlan as undoPlanLib } from "@/lib/organizer/undo-plan";
import { validateIntent } from "@/lib/organizer/validate-intent";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";
import { getOwnedVehicleInstances } from "@/lib/queries/my-vehicles";
import { createClient } from "@/lib/supabase/server";

// ----- parseIntent -----

export type ParseIntentResult =
  | { ok: true; intent: ParsedIntent }
  | { ok: false; clarification: Clarification }
  | { error: string };

export async function parseIntent(
  prompt: string,
  clarifyingHistory?: Turn[],
): Promise<ParseIntentResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Load everything the LLM needs.
  const [vehicles, properties, { data: systemTags }, { data: manufacturers }] = await Promise.all([
    getOwnedVehicleInstances(user.id),
    getOwnedPropertiesWithStorage(user.id),
    supabase.from("vehicle_tags").select("id, display"),
    supabase.from("manufacturers").select("id, display"),
  ]);

  const context = buildPortfolioContext({
    vehicles,
    properties,
    systemTags: systemTags ?? [],
    manufacturers: manufacturers ?? [],
  });

  const result = await parseIntentLib({
    prompt,
    portfolioContext: context,
    clarifyingHistory,
  });

  if ("error" in result) return result;
  if (!result.ok) return { ok: false, clarification: result.clarification };

  // Server-side validation.
  const systemTagIds = new Set((systemTags ?? []).map((t) => t.id));
  const manufacturerIds = new Set((manufacturers ?? []).map((m) => m.id));
  const classNames = new Set(vehicles.map((v) => v.class));
  const validation = validateIntent(result.intent, properties, systemTagIds, manufacturerIds, classNames);
  if (!validation.ok) return { error: validation.reason };

  return { ok: true, intent: result.intent };
}

// ----- generatePlan -----

export type GeneratePlanResult =
  | { ok: true; planId: string; steps: PlanStep[]; summary: PlanSummary }
  | { ok: false; message: string };

export async function generatePlan(
  intent: ParsedIntent,
  prompt: string,
): Promise<GeneratePlanResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const [vehicles, properties, { data: manufacturers }] = await Promise.all([
    getOwnedVehicleInstances(user.id),
    getOwnedPropertiesWithStorage(user.id),
    supabase.from("manufacturers").select("id, display"),
  ]);

  const manufacturerIdByDisplay = new Map(
    (manufacturers ?? []).map((m) => [m.display, m.id]),
  );

  const result = generatePlanLib({
    intent,
    portfolio: { vehicles, properties },
    manufacturerIdByDisplay,
  });

  if (!result.ok) {
    // Use the LLM to rewrite the failure into a friendly message.
    const message = await formatFailure({ failure: result.failure, promptText: prompt });
    return { ok: false, message };
  }

  // Persist the plan with status='pending'.
  const { data: insertRow, error: insertErr } = await supabase
    .from("organizer_plans")
    .insert({
      user_id: user.id,
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
    steps: result.steps,
    summary: result.summary,
  };
}

// ----- applyPlan -----

export async function applyPlan(planId: string) {
  const result = await applyPlanLib(planId);
  if ("ok" in result) revalidatePath("/", "layout");
  return result;
}

// ----- undoPlan -----

export async function undoPlan(planId: string) {
  const result = await undoPlanLib(planId);
  if ("ok" in result) revalidatePath("/", "layout");
  return result;
}

// ----- markStepComplete / markStepIncomplete -----

export type MarkStepResult =
  | { ok: true; allComplete: boolean }
  | { error: string };

export async function markStepComplete(
  planId: string,
  stepIndex: number,
): Promise<MarkStepResult> {
  return markStep(planId, stepIndex, true);
}

export async function markStepIncomplete(
  planId: string,
  stepIndex: number,
): Promise<MarkStepResult> {
  return markStep(planId, stepIndex, false);
}

async function markStep(
  planId: string,
  stepIndex: number,
  complete: boolean,
): Promise<MarkStepResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data: plan, error: loadErr } = await supabase
    .from("organizer_plans")
    .select("id, status, plan_steps")
    .eq("id", planId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (loadErr || !plan) return { error: loadErr?.message ?? "Plan not found." };

  const steps = plan.plan_steps as PlanStep[];
  const step = steps[stepIndex];
  if (!step) return { error: `Step ${stepIndex} not found in plan.` };

  // Apply / reverse the DB write for THIS step.
  if (complete) {
    const patch =
      step.type === "unassign"
        ? { stored_in_property_id: null, assigned_upgrade_id: null }
        : {
            stored_in_property_id: step.to.property_id,
            assigned_upgrade_id: step.to.upgrade_id,
          };
    const { error } = await supabase
      .from("user_owned_vehicles")
      .update(patch)
      .eq("id", step.owned_vehicle_id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    // Untick: restore from the step's `from` (since checklist mode never
    // snapshots; we trust the step's own from-state).
    const patch = {
      stored_in_property_id: step.from.property_id || null,
      assigned_upgrade_id: step.from.upgrade_id,
    };
    const { error } = await supabase
      .from("user_owned_vehicles")
      .update(patch)
      .eq("id", step.owned_vehicle_id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  }

  // Update the step's completed_at in the plan_steps JSONB.
  steps[stepIndex] = {
    ...step,
    completed_at: complete ? new Date().toISOString() : null,
  };
  const allComplete = steps.every((s) => s.completed_at !== null);
  const newStatus = plan.status === "pending"
    ? "checklist"
    : allComplete && plan.status === "checklist"
      ? "completed"
      : plan.status;

  const { error: updateErr } = await supabase
    .from("organizer_plans")
    .update({ plan_steps: steps, status: newStatus })
    .eq("id", planId);
  if (updateErr) return { error: updateErr.message };

  revalidatePath("/", "layout");
  return { ok: true, allComplete };
}

// ----- dismissPlan -----

export async function dismissPlan(planId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("organizer_plans")
    .update({ status: "dismissed" })
    .eq("id", planId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { ok: true };
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add app/(app)/organize/actions.ts
git commit -m "Piece 2: organize/actions.ts — parseIntent, generatePlan, apply/undo, step ticks, dismiss"
```

---

## Task 16: app/(app)/organize/example-pills.tsx + clarification-pills.tsx

**Files:**
- Create: `app/(app)/organize/example-pills.tsx`
- Create: `app/(app)/organize/clarification-pills.tsx`

- [ ] **Step 1: Write example-pills.tsx**

```tsx
"use client";

import { cn } from "@/lib/utils";

const EXAMPLE_PROMPTS = [
  "Put my drift cars in Mission Row",
  "Move all Pegassi cars to Eclipse Towers, Apt 30",
  "Put weaponized cars in my facility, drift cars in Mission Row",
  "Consolidate my supers in one place",
];

type Props = {
  onPick: (prompt: string) => void;
  className?: string;
};

export function ExamplePills({ onPick, className }: Props) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {EXAMPLE_PROMPTS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPick(p)}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
        >
          {p}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write clarification-pills.tsx**

```tsx
"use client";

import { cn } from "@/lib/utils";

type Props = {
  suggestions: string[];
  onPick: (suggestion: string) => void;
  className?: string;
};

export function ClarificationPills({ suggestions, onPick, className }: Props) {
  if (suggestions.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300 transition hover:bg-amber-500/20"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + commit**

```bash
npm run typecheck
git add app/(app)/organize/example-pills.tsx app/(app)/organize/clarification-pills.tsx
git commit -m "Piece 2: example-pills + clarification-pills — small pill components"
```

---

## Task 17: app/(app)/organize/plan-renderer.tsx

**Files:**
- Create: `app/(app)/organize/plan-renderer.tsx`

- [ ] **Step 1: Write the renderer**

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlanStep, PlanSummary } from "@/lib/organizer/types";

type Props = {
  summary: PlanSummary;
  steps: PlanStep[];
  onApply: () => void;
  onChecklist: () => void;
  onCancel: () => void;
  isPending: boolean;
};

export function PlanRenderer({
  summary, steps, onApply, onChecklist, onCancel, isPending,
}: Props) {
  return (
    <div className="rounded-md border-l-4 border-emerald-500 bg-card p-3">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Plan</div>
      <p className="mb-2 text-sm font-medium">
        Move {summary.cars_moved} cars
        {summary.displacements > 0 && ` · Displace ${summary.displacements}`}
        {summary.cars_unassigned > 0 && ` · ${summary.cars_unassigned} unassigned`}
      </p>
      {summary.conflicts.length > 0 && (
        <ul className="mb-2 text-xs text-amber-400">
          {summary.conflicts.map((c, i) => <li key={i}>⚠ {c}</li>)}
        </ul>
      )}
      <div className="mb-3 max-h-48 overflow-y-auto font-mono text-xs leading-relaxed text-muted-foreground">
        {steps.slice(0, 8).map((s) => (
          <div key={s.index}>
            <span className={cn(s.reason === "displaced" ? "text-red-400" : "text-emerald-400")}>
              {s.reason === "displaced" ? "🔴 Displace" : "🟢 Move"}
            </span>{" "}
            {s.vehicle_label} · {s.from.label} → {s.to.label}
          </div>
        ))}
        {steps.length > 8 && (
          <div className="text-foreground/40">…{steps.length - 8} more</div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onApply} disabled={isPending}>
          ✓ Apply now
        </Button>
        <Button size="sm" variant="outline" onClick={onChecklist} disabled={isPending}>
          ☐ Just give me the checklist
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add app/(app)/organize/plan-renderer.tsx
git commit -m "Piece 2: plan-renderer.tsx — plan summary + step list + action buttons"
```

---

## Task 18: app/(app)/organize/checklist-progress.tsx

**Files:**
- Create: `app/(app)/organize/checklist-progress.tsx`

- [ ] **Step 1: Write the checklist**

```tsx
"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  markStepComplete,
  markStepIncomplete,
} from "./actions";
import type { PlanStep } from "@/lib/organizer/types";

type Props = {
  planId: string;
  steps: PlanStep[];
};

export function ChecklistProgress({ planId, steps: initialSteps }: Props) {
  const [steps, setSteps] = useState(initialSteps);
  const [pending, startTransition] = useTransition();

  const completed = steps.filter((s) => s.completed_at !== null).length;
  const percent = steps.length === 0 ? 0 : (completed / steps.length) * 100;

  const toggle = (idx: number) => {
    const step = steps[idx];
    const willComplete = step.completed_at === null;
    // Optimistic flip
    setSteps((prev) =>
      prev.map((s, i) =>
        i === idx
          ? { ...s, completed_at: willComplete ? new Date().toISOString() : null }
          : s,
      ),
    );
    startTransition(async () => {
      const r = willComplete
        ? await markStepComplete(planId, idx)
        : await markStepIncomplete(planId, idx);
      if ("error" in r) {
        toast.error(r.error);
        setSteps(initialSteps);
      } else if (willComplete && r.allComplete) {
        toast.success("All steps complete!");
      }
    });
  };

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">
          {completed} / {steps.length} complete
        </p>
        <div className="ml-3 h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-amber-400 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {steps.map((s) => {
          const done = s.completed_at !== null;
          return (
            <label
              key={s.index}
              className={cn(
                "flex cursor-pointer items-center gap-2 text-sm",
                done && "text-muted-foreground line-through",
              )}
            >
              <input
                type="checkbox"
                checked={done}
                onChange={() => toggle(s.index)}
                disabled={pending}
              />
              <span>
                <span className={cn("font-medium", s.reason === "displaced" ? "text-red-400" : "text-emerald-400")}>
                  {s.type === "unassign"
                    ? "Unassign"
                    : s.reason === "displaced"
                      ? "Displace"
                      : "Move"}
                </span>{" "}
                {s.vehicle_label} · {s.from.label} → {s.to.label}
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Each tick updates your portfolio. No DB change happens until you tick.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add app/(app)/organize/checklist-progress.tsx
git commit -m "Piece 2: checklist-progress.tsx — progress bar + per-step checkboxes"
```

---

## Task 19: app/(app)/organize/undo-banner.tsx

**Files:**
- Create: `app/(app)/organize/undo-banner.tsx`

- [ ] **Step 1: Write the banner**

```tsx
"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { undoPlan } from "./actions";

type Props = {
  planId: string;
  undoExpiresAt: string;       // ISO timestamp
  carsMoved: number;
};

export function UndoBanner({ planId, undoExpiresAt, carsMoved }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [secondsLeft, setSecondsLeft] = useState<number>(
    Math.max(0, Math.floor((new Date(undoExpiresAt).getTime() - Date.now()) / 1000)),
  );

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const id = setInterval(() => {
      setSecondsLeft((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [secondsLeft]);

  if (secondsLeft <= 0) return null;

  const mins = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const secs = (secondsLeft % 60).toString().padStart(2, "0");

  const handleUndo = () => {
    startTransition(async () => {
      const r = await undoPlan(planId);
      if ("ok" in r) {
        toast.success("Reverted to pre-apply state.");
        router.refresh();
      } else {
        toast.error(`Undo failed: ${r.error}`);
      }
    });
  };

  return (
    <div className="flex items-center justify-between rounded-md border border-emerald-500/40 bg-emerald-500/10 px-4 py-3">
      <p className="text-sm">
        ✅ <strong>Plan applied</strong> · {carsMoved} car{carsMoved === 1 ? "" : "s"} moved
      </p>
      <Button
        size="sm"
        variant="outline"
        onClick={handleUndo}
        disabled={pending}
        className="border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/20"
      >
        ↶ Undo ({mins}:{secs})
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add app/(app)/organize/undo-banner.tsx
git commit -m "Piece 2: undo-banner.tsx — live countdown + undo button"
```

---

## Task 20: app/(app)/organize/recent-plans-list.tsx

**Files:**
- Create: `app/(app)/organize/recent-plans-list.tsx`

- [ ] **Step 1: Write the recent plans list**

```tsx
"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { PlanSummaryRow } from "@/lib/queries/organizer";

type Props = {
  plans: PlanSummaryRow[];
  onRerun: (prompt: string) => void;
};

export function RecentPlansList({ plans, onRerun }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (plans.length === 0) return null;

  return (
    <div className="rounded-md border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
      >
        <span>Recent plans ({plans.length})</span>
        <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t">
          {plans.map((p) => (
            <div key={p.id} className="border-b last:border-b-0">
              <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{p.prompt}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(p.created_at).toLocaleString()} ·{" "}
                    <span className={cn(
                      p.status === "applied" && "text-emerald-400",
                      p.status === "checklist" && "text-amber-400",
                      p.status === "completed" && "text-emerald-400",
                      p.status === "dismissed" && "text-muted-foreground",
                      p.status === "undone" && "text-muted-foreground",
                    )}>
                      {p.status === "applied" && `Applied (${p.step_count} steps)`}
                      {p.status === "checklist" && `Checklist ${p.completed_count}/${p.step_count}`}
                      {p.status === "completed" && `Completed (${p.step_count} steps)`}
                      {p.status === "dismissed" && "Dismissed"}
                      {p.status === "undone" && "Undone"}
                      {p.status === "pending" && "Pending"}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRerun(p.prompt)}
                  className="rounded border border-border px-2 py-0.5 text-[10px] hover:border-foreground/40"
                >
                  Re-run
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  className="rounded border border-border px-2 py-0.5 text-[10px] hover:border-foreground/40"
                >
                  {expandedId === p.id ? "Hide" : "View"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add app/(app)/organize/recent-plans-list.tsx
git commit -m "Piece 2: recent-plans-list.tsx — collapsible history with re-run"
```

---

## Task 21: app/(app)/organize/organize-chat.tsx — the main client state machine

**Files:**
- Create: `app/(app)/organize/organize-chat.tsx`

This is the most complex client component. It orchestrates the whole chat flow.

- [ ] **Step 1: Write the chat state machine**

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  Clarification,
  PlanStep,
  PlanSummary,
  Turn,
} from "@/lib/organizer/types";
import type { OrganizerPlan, PlanSummaryRow } from "@/lib/queries/organizer";

import {
  applyPlan,
  dismissPlan,
  generatePlan,
  parseIntent,
} from "./actions";
import { ChecklistProgress } from "./checklist-progress";
import { ClarificationPills } from "./clarification-pills";
import { ExamplePills } from "./example-pills";
import { PlanRenderer } from "./plan-renderer";
import { RecentPlansList } from "./recent-plans-list";
import { UndoBanner } from "./undo-banner";

type ChatPhase =
  | { kind: "idle" }                                         // empty input, no plan in flight
  | { kind: "thinking" }                                     // parseIntent or generatePlan running
  | { kind: "clarifying"; clarification: Clarification; history: Turn[]; originalPrompt: string }
  | { kind: "plan-ready"; planId: string; prompt: string; steps: PlanStep[]; summary: PlanSummary }
  | { kind: "applied"; planId: string; carsMoved: number; undoExpiresAt: string }
  | { kind: "checklist"; planId: string; steps: PlanStep[] }
  | { kind: "failed"; message: string };

type Props = {
  initialPlans: PlanSummaryRow[];
  initialUndoablePlan: OrganizerPlan | null;
};

export function OrganizeChat({ initialPlans, initialUndoablePlan }: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<ChatPhase>(() => {
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
  const [pending, startTransition] = useTransition();

  const submit = (promptText: string) => {
    setPhase({ kind: "thinking" });
    setInput("");

    startTransition(async () => {
      const history: Turn[] =
        phase.kind === "clarifying"
          ? [
              ...phase.history,
              { role: "assistant", clarification: phase.clarification },
              { role: "user", content: promptText },
            ]
          : [];

      const parsePrompt =
        phase.kind === "clarifying" ? phase.originalPrompt : promptText;

      const parsed = await parseIntent(parsePrompt, history);
      if ("error" in parsed) {
        toast.error(parsed.error);
        setPhase({ kind: "idle" });
        return;
      }
      if (!parsed.ok) {
        setPhase({
          kind: "clarifying",
          clarification: parsed.clarification,
          history,
          originalPrompt: parsePrompt,
        });
        return;
      }

      const planResult = await generatePlan(parsed.intent, parsePrompt);
      if (!planResult.ok) {
        setPhase({ kind: "failed", message: planResult.message });
        return;
      }
      setPhase({
        kind: "plan-ready",
        planId: planResult.planId,
        prompt: parsePrompt,
        steps: planResult.steps,
        summary: planResult.summary,
      });
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

  const handleChecklist = (planId: string, steps: PlanStep[]) => {
    setPhase({ kind: "checklist", planId, steps });
  };

  const handleCancel = (planId: string) => {
    startTransition(async () => {
      await dismissPlan(planId);
      setPhase({ kind: "idle" });
      router.refresh();
    });
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Organize</h1>
        <p className="text-sm text-muted-foreground">
          Describe how you want your cars laid out. AI parses your request, the
          planner computes the moves, you choose how to apply.
        </p>
      </div>

      {/* APPLIED state: undo banner pinned at top */}
      {phase.kind === "applied" && (
        <UndoBanner
          planId={phase.planId}
          undoExpiresAt={phase.undoExpiresAt}
          carsMoved={phase.carsMoved}
        />
      )}

      {/* IDLE: example pills */}
      {phase.kind === "idle" && (
        <ExamplePills onPick={(p) => submit(p)} />
      )}

      {/* THINKING */}
      {phase.kind === "thinking" && (
        <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
          Thinking...
        </div>
      )}

      {/* CLARIFYING */}
      {phase.kind === "clarifying" && (
        <div className="rounded-md border-l-4 border-amber-500 bg-card p-3">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Question</div>
          <p className="mb-2 text-sm">{phase.clarification.question}</p>
          {phase.clarification.suggestions.length > 0 && (
            <ClarificationPills
              suggestions={phase.clarification.suggestions}
              onPick={(s) => submit(s)}
            />
          )}
        </div>
      )}

      {/* PLAN-READY */}
      {phase.kind === "plan-ready" && (
        <PlanRenderer
          summary={phase.summary}
          steps={phase.steps}
          onApply={() => handleApply(phase.planId, phase.summary.cars_moved)}
          onChecklist={() => handleChecklist(phase.planId, phase.steps)}
          onCancel={() => handleCancel(phase.planId)}
          isPending={pending}
        />
      )}

      {/* CHECKLIST */}
      {phase.kind === "checklist" && (
        <ChecklistProgress planId={phase.planId} steps={phase.steps} />
      )}

      {/* FAILED */}
      {phase.kind === "failed" && (
        <div className="rounded-md border-l-4 border-red-500 bg-card p-3">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Can&apos;t fit that one</div>
          <p className="text-sm whitespace-pre-line">{phase.message}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => setPhase({ kind: "idle" })}
          >
            Try a different plan
          </Button>
        </div>
      )}

      {/* INPUT */}
      <div className="flex gap-2 border-t pt-3">
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
              ? "Answer the question or type a different reply..."
              : "Describe how to organize..."
          }
          disabled={pending || phase.kind === "thinking"}
        />
        <Button
          onClick={() => input.trim() && submit(input.trim())}
          disabled={!input.trim() || pending || phase.kind === "thinking"}
        >
          Send
        </Button>
      </div>

      {/* HISTORY */}
      <RecentPlansList plans={initialPlans} onRerun={(p) => setInput(p)} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck + commit**

```bash
npm run typecheck
git add app/(app)/organize/organize-chat.tsx
git commit -m "Piece 2: organize-chat.tsx — chat state machine orchestrating all phases"
```

---

## Task 22: app/(app)/organize/page.tsx + sidebar nav

**Files:**
- Create: `app/(app)/organize/page.tsx`
- Modify: `components/app-shell/nav-items.ts`

- [ ] **Step 1: Write page.tsx**

```tsx
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  getActiveUndoablePlan,
  getRecentPlans,
} from "@/lib/queries/organizer";

import { OrganizeChat } from "./organize-chat";

export default async function OrganizePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [initialPlans, initialUndoablePlan] = await Promise.all([
    getRecentPlans(user.id),
    getActiveUndoablePlan(user.id),
  ]);

  return (
    <OrganizeChat
      initialPlans={initialPlans}
      initialUndoablePlan={initialUndoablePlan}
    />
  );
}
```

- [ ] **Step 2: Add the sidebar entry**

In `components/app-shell/nav-items.ts`, update the imports + the "My Portfolio" section:

```ts
import {
  Briefcase,
  Building2,
  Car,
  Grid3x3,
  Home,
  LayoutDashboard,
  Sparkles,           // ← new
  Warehouse,
  type LucideIcon,
} from "lucide-react";
```

And inside `NAV_SECTIONS`, append `Organize` to the "My Portfolio" items array (after "My Businesses"):

```ts
      {
        label: "Organize",
        href: "/organize",
        icon: Sparkles,
      },
```

- [ ] **Step 3: Typecheck**

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/organize/page.tsx components/app-shell/nav-items.ts
git commit -m "Piece 2: /organize page + sidebar nav entry"
```

---

## Task 23: Acceptance walkthrough + plan.md update

**Files:**
- Modify: `docs/plan.md`

- [ ] **Step 1: Walk through every acceptance criterion**

Start `npm run dev` and work through the 15 acceptance criteria from the spec (`docs/specs/2026-05-24-piece-2-organizer-design.md` § Acceptance Criteria). Fix any breaks inline.

Key flows to hit:
1. Navigate to `/organize` — sidebar entry present + page loads
2. Empty state shows pills + input
3. Click a pill → input prefilled + auto-submitted
4. Plan generates in ~3s for simple prompt
5. Apply now → undo banner appears with countdown
6. Undo within window → vehicles restored
7. Checklist mode → ticking checkboxes updates DB
8. Ambiguous prompt → clarification message appears with suggestion pills
9. Compound prompt → plan covers both criteria
10. Capacity-insufficient prompt → friendly failure message
11. Recent plans section shows history
12. View past plan → expands inline
13. Re-run prefills the input

- [ ] **Step 2: Update `docs/plan.md`**

At the top of "Where we left off" add a dated entry:

```markdown
### 2026-05-XX — Piece 2 AI Organizer landed

Subagent-driven execution of the 23-task implementation plan. Spec at
`docs/specs/2026-05-24-piece-2-organizer-design.md`. Plan at
`docs/plans/2026-05-24-piece-2-organizer.md`.

**What landed:**
- Migration 0008 — `organizer_plans` table + status enum + RLS
- `@anthropic-ai/sdk` dep + `ANTHROPIC_API_KEY` env var
- `lib/organizer/` — types, locations, filter-vehicles, portfolio-context,
  intent-parser (Claude Haiku 4.5 with prompt caching), validate-intent,
  planner (chained displacement), apply-plan + undo-plan, format-failure
- `lib/queries/organizer.ts` — recent plans + active undoable plan
- `/organize` page with full chat state machine + plan renderer + checklist
  progress + undo banner + recent plans list + example/clarification pills

**Pending follow-ups (Piece 2.1+):**
- Multi-turn conversational refinement
- Distribution-mode planner ("spread evenly across N properties")
- Pro tier paywall wrap when Stripe lands (Phase 9)
```

Update the Phase Overview table: Piece 2 → ✅ Complete.

- [ ] **Step 3: Final commit**

```bash
git add docs/plan.md
git commit -m "docs: plan.md — Piece 2 AI Organizer shipped"
```

---

## Self-Review Notes

After writing the plan I did a pass against the spec:

**Spec coverage:** every locked decision and acceptance criterion maps to a task. The 15 acceptance criteria walk-through is Task 23. ✅

**Type consistency:** `PlanStep`, `ParsedIntent`, `Clarification`, `Turn`, etc. defined once in `lib/organizer/types.ts` (Task 3) and imported everywhere. No drift between client/server.

**Placeholder scan:** clean. No TBD / TODO / "similar to Task N" / "add appropriate error handling" patterns.

**One imperfection to call out:**
- Task 11 (`apply-plan.ts`) executes each step's DB update sequentially without a Postgres transaction. If step 5 fails after steps 0-4 wrote, the snapshot survives so the user can manually `undoPlan()` to recover — but partial application is real. A future hardening pass could wrap the sequence in a PL/pgSQL function with proper transactional semantics. Captured here for visibility.

---

## Out of Scope (don't do these in Piece 2)

- Multi-turn conversational refinement (Approach B from brainstorm) — Piece 2.1 if signal demands
- Tool-use agent (Approach C) — probably never
- Distribution-mode planning ("spread evenly across N apartments") — Piece 2.5
- Auto-target-picking via `target: { auto_pick: "largest_fit" }` — Piece 2.1
- Plan history pagination/search beyond 10 entries — Piece 2.5
- Stale `pending` plans cleanup — Piece 2.5
- Pro tier paywall wrap (`<RequiresPro>` on /organize) — Phase 9
- Mobile-optimized chat layout — Piece 6
- Voice input — out of scope
