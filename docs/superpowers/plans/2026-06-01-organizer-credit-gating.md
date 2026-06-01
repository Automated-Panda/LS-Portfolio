# Organizer Credit Gating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Charge credits for AI Organizer usage (built on the Plan 1 ledger), show an always-visible balance, gracefully wall users who run out, and give the owner unlimited credits.

**Architecture:** A pure policy module (`access.ts`) decides who is "unlimited" (the owner, via `ADMIN_EMAIL`). A thin server gate (`gate.ts`) wraps the Plan 1 `getBalance`/`spendCredits` with owner-bypass and a display shape. The Organizer server actions charge through that gate at the right moments; the chat UI shows the balance in the input footer, reflects each charge, and renders an inline "out of credits" notice.

**Tech Stack:** Next.js 15 (App Router, server actions) · Supabase · TypeScript · Vitest (for the pure policy module).

**Approved design:** see the conversation of 2026-06-01 (brainstorming). Pricing rules: `docs/superpowers/specs/2026-06-01-pro-credit-pricing-design.md`. Foundation: `docs/superpowers/plans/2026-06-01-credit-ledger-foundation.md`.

---

## Locked behavior (from the approved design)

- **Owner = `ADMIN_EMAIL` (`james@automatedpanda.com`)** → unlimited; all charging bypassed; footer shows "Unlimited ⚡". (Reuses the existing admin-email identity; future Editor/Developer roles will generalize `access.ts`.)
- **Charge model** (one charge per submitted message, owner bypassed, gated by `spendCredits`):
  - Pre-check **before parse**: balance ≥ 1, else show the wall (no API call).
  - Parse → **clarifying question** (no plan) → charge **1**.
  - Parse → intent, then **plan generated** → charge **`planCost(intent.criteria.length)`** = `5 + 2×(N−1)`.
  - **Tweak** (a `supersedePlanId` refinement) → charge **1** (`TWEAK_COST`).
  - **Planner failure** (e.g. insufficient capacity) → charge **1** (the conversation floor — it consumed Haiku calls).
  - Apply / undo / browse → **0**.
  - Insufficient balance for a plan → **charge nothing, don't generate**, show the wall.
- **UI:** balance in the input footer; "N used · M left" on the plan result; inline "out of credits" notice (forward-compatible with Plan 3's "Get credits" button).
- **Charge-then-insert ordering** in `generatePlan`: spend is the gate, so we spend first, then insert the plan. A rare insert-failure after a successful spend over-charges by the plan cost — acceptable for now and noted (a transactional RPC is the Plan 3 hardening, same as `grantCredits`).

---

## File Structure

| File | Responsibility |
|---|---|
| `lib/credits/access.ts` (create) | Pure policy: `isUnlimitedEmail(email)` + `CreditDisplay` type. No I/O. |
| `lib/credits/access.test.ts` (create) | Vitest unit tests for `isUnlimitedEmail`. |
| `lib/credits/gate.ts` (create) | Server-only: `organizerBalance` + `chargeOrganizer` — wrap Plan 1's `getBalance`/`spendCredits` with owner-bypass and the display shape. |
| `app/(app)/organize/actions.ts` (modify) | Charge through the gate in `parseIntent` (pre-check + clarify charge) and `generatePlan` (plan/tweak/failure charge); extend return types with `balance` + out-of-credits variants. |
| `app/(app)/organize/page.tsx` (modify) | Fetch the display balance and pass it to `OrganizeChat`. |
| `app/(app)/organize/organize-chat.tsx` (modify) | Balance footer, balance state, out-of-credits phase + notice, "used/left" on the plan result. |

---

### Task 1: Credit access policy (`access.ts`)

**Files:**
- Create: `lib/credits/access.ts`
- Create: `lib/credits/access.test.ts`

- [ ] **Step 1: Write the failing test**

`lib/credits/access.test.ts`:
```ts
import { describe, it, expect, afterEach } from "vitest";
import { isUnlimitedEmail } from "./access";

const ORIGINAL = process.env.ADMIN_EMAIL;
afterEach(() => {
  process.env.ADMIN_EMAIL = ORIGINAL;
});

describe("isUnlimitedEmail", () => {
  it("is true for the owner email (case-insensitive)", () => {
    process.env.ADMIN_EMAIL = "james@automatedpanda.com";
    expect(isUnlimitedEmail("james@automatedpanda.com")).toBe(true);
    expect(isUnlimitedEmail("James@AutomatedPanda.com")).toBe(true);
  });
  it("is false for any other email", () => {
    process.env.ADMIN_EMAIL = "james@automatedpanda.com";
    expect(isUnlimitedEmail("someone@else.com")).toBe(false);
  });
  it("is false for null/undefined email or unset ADMIN_EMAIL", () => {
    process.env.ADMIN_EMAIL = "james@automatedpanda.com";
    expect(isUnlimitedEmail(null)).toBe(false);
    expect(isUnlimitedEmail(undefined)).toBe(false);
    delete process.env.ADMIN_EMAIL;
    expect(isUnlimitedEmail("james@automatedpanda.com")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- access`
Expected: FAIL — cannot find module `./access`.

- [ ] **Step 3: Write the implementation**

`lib/credits/access.ts`:
```ts
// lib/credits/access.ts
// Pure credit-access policy. Decides who has unlimited AI credits.
// Today that's just the owner (ADMIN_EMAIL). Future Editor/Developer roles
// will extend this module (they get generous *finite* monthly credits, not
// unlimited — see project memory). No I/O so it stays unit-testable.

/** Balance shape passed to the UI. `unlimited` users ignore `total`. */
export type CreditDisplay = { total: number; unlimited: boolean };

/** True if this email is the owner (unlimited credits, never charged/gated). */
export function isUnlimitedEmail(email: string | null | undefined): boolean {
  const owner = process.env.ADMIN_EMAIL;
  if (!owner || !email) return false;
  return email.toLowerCase() === owner.toLowerCase();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- access`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/credits/access.ts lib/credits/access.test.ts
git commit -m "feat(credits): add credit-access policy (owner unlimited)"
```
(End the commit body with `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.)

---

### Task 2: Server credit gate (`gate.ts`)

**Files:**
- Create: `lib/credits/gate.ts`

- [ ] **Step 1: Write the module**

`lib/credits/gate.ts`:
```ts
// lib/credits/gate.ts
// Server-only wrappers that apply the owner-unlimited policy on top of the
// Plan 1 ledger. The Organizer actions charge through these so owner-bypass and
// the display shape live in ONE place.
import "server-only";

import { getBalance, spendCredits } from "./server";
import { isUnlimitedEmail, type CreditDisplay } from "./access";

/** Current balance for display. Owner → unlimited (total is ignored by the UI). */
export async function organizerBalance(
  userId: string,
  email: string | null | undefined,
): Promise<CreditDisplay> {
  if (isUnlimitedEmail(email)) return { total: 0, unlimited: true };
  return { total: await getBalance(userId), unlimited: false };
}

export type ChargeResult =
  | { ok: true; balance: CreditDisplay }
  | { ok: false; needed: number; balance: CreditDisplay };

/**
 * Charge `amount` credits for an Organizer action. Owner → free (unlimited).
 * On insufficient balance, charges nothing and returns ok:false with what was
 * needed and the current balance (for the out-of-credits wall).
 */
export async function chargeOrganizer(
  userId: string,
  email: string | null | undefined,
  amount: number,
  kind: "plan" | "tweak" | "clarify" | "failure",
): Promise<ChargeResult> {
  if (isUnlimitedEmail(email)) return { ok: true, balance: { total: 0, unlimited: true } };

  const result = await spendCredits(userId, amount, "spend", { feature: "organizer", kind });
  if (result.ok) {
    return { ok: true, balance: { total: result.remaining, unlimited: false } };
  }
  return { ok: false, needed: amount, balance: { total: await getBalance(userId), unlimited: false } };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (`spendCredits(userId, amount, "spend", metadata)` and `getBalance(userId)` exist in `lib/credits/server.ts`.)

- [ ] **Step 3: Commit**

```bash
git add lib/credits/gate.ts
git commit -m "feat(credits): add server gate wrapping ledger with owner-bypass"
```
(End body with the Co-Authored-By line.)

---

### Task 3: Charge in the Organizer actions

**Files:**
- Modify: `app/(app)/organize/actions.ts`

- [ ] **Step 1: Add imports**

At the top of `app/(app)/organize/actions.ts`, add to the import block:
```ts
import { planCost, TWEAK_COST } from "@/lib/credits/constants";
import { organizerBalance, chargeOrganizer } from "@/lib/credits/gate";
import type { CreditDisplay } from "@/lib/credits/access";
```

- [ ] **Step 2: Extend `ParseIntentResult` and gate `parseIntent`**

Replace the `ParseIntentResult` type and the body of `parseIntent` (currently lines 26–71) with:
```ts
export type ParseIntentResult =
  | { ok: true; intent: ParsedIntent; balance: CreditDisplay }
  | { ok: false; clarification: Clarification; balance: CreditDisplay }
  | { outOfCredits: true; needed: number; balance: CreditDisplay }
  | { error: string };

export async function parseIntent(
  prompt: string,
  clarifyingHistory?: Turn[],
): Promise<ParseIntentResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Pre-check: need at least 1 credit to send a message at all (owner bypassed).
  const balance = await organizerBalance(user.id, user.email);
  if (!balance.unlimited && balance.total < 1) {
    return { outOfCredits: true, needed: 1, balance };
  }

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
  if (!result.ok) {
    // Clarifying question = no plan, but a Haiku call fired → charge the floor.
    const charge = await chargeOrganizer(user.id, user.email, 1, "clarify");
    return { ok: false, clarification: result.clarification, balance: charge.balance };
  }

  // Server-side validation.
  const systemTagIds = new Set((systemTags ?? []).map((t) => t.id));
  const manufacturerIds = new Set((manufacturers ?? []).map((m) => m.id));
  const classNames = new Set(vehicles.map((v) => v.class));
  const validation = validateIntent(result.intent, properties, systemTagIds, manufacturerIds, classNames);
  if (!validation.ok) return { error: validation.reason };

  // Intent parsed — the plan charge happens in generatePlan. No charge here.
  return { ok: true, intent: result.intent, balance };
}
```

- [ ] **Step 3: Extend `GeneratePlanResult` and charge in `generatePlan`**

Replace the `GeneratePlanResult` type (currently lines 75–77) with:
```ts
export type GeneratePlanResult =
  | { ok: true; planId: string; conversationId: string; steps: PlanStep[]; summary: PlanSummary; charged: number; balance: CreditDisplay }
  | { ok: false; message: string; balance: CreditDisplay }
  | { outOfCredits: true; needed: number; balance: CreditDisplay };
```

Then in the `generatePlan` body, make these edits:

(a) After `if (!user) return ...` add the owner/email handle (the `user` already has `.email`). No code change needed beyond using `user.email` below.

(b) Replace the planner-failure block (currently lines 104–108):
```ts
  if (!result.ok) {
    // Use the LLM to rewrite the failure into a friendly message.
    const message = await formatFailure({ failure: result.failure, promptText: prompt });
    return { ok: false, message };
  }
```
with:
```ts
  if (!result.ok) {
    // Planner failure = no usable plan, but Haiku calls fired → charge the floor.
    const charge = await chargeOrganizer(user.id, user.email, 1, "failure");
    const message = await formatFailure({ failure: result.failure, promptText: prompt });
    return { ok: false, message, balance: charge.balance };
  }

  // Plan is generatable — charge for it BEFORE persisting (spend is the gate).
  // Tweak (refinement) is a flat TWEAK_COST; a fresh plan is planCost(intents).
  const cost = opts?.supersedePlanId ? TWEAK_COST : planCost(intent.criteria.length);
  const charge = await chargeOrganizer(user.id, user.email, cost, opts?.supersedePlanId ? "tweak" : "plan");
  if (!charge.ok) {
    return { outOfCredits: true, needed: charge.needed, balance: charge.balance };
  }
```

(c) At the SUCCESS return (currently lines 160–166), add `charged` and `balance`:
```ts
  return {
    ok: true,
    planId: insertRow.id,
    conversationId: conversationId as string,
    steps: result.steps,
    summary: result.summary,
    charged: cost,
    balance: charge.balance,
  };
```

- [ ] **Step 4: Typecheck**

Run: `npm run typecheck`
Expected: PASS. (If the compiler flags that `cost`/`charge` are referenced before all return paths — they are declared after the planner-failure early-return, so all later code sees them. Confirm the success return is after the charge block.)

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/organize/actions.ts"
git commit -m "feat(organizer): charge credits on parse/generate (owner bypassed)"
```
(End body with the Co-Authored-By line.)

---

### Task 4: Balance UI in the page + chat

**Files:**
- Modify: `app/(app)/organize/page.tsx`
- Modify: `app/(app)/organize/organize-chat.tsx`

- [ ] **Step 1: Fetch + pass the balance in `page.tsx`**

In `app/(app)/organize/page.tsx`, add the import and fetch the balance, then pass it down. Replace the file body with:
```tsx
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  getActiveUndoablePlan,
  getConversations,
} from "@/lib/queries/organizer";
import { organizerBalance } from "@/lib/credits/gate";

import { OrganizeChat } from "./organize-chat";

export default async function OrganizePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [initialConversations, initialUndoablePlan, initialBalance] = await Promise.all([
    getConversations(user.id),
    getActiveUndoablePlan(user.id),
    organizerBalance(user.id, user.email),
  ]);

  return (
    <OrganizeChat
      initialConversations={initialConversations}
      initialUndoablePlan={initialUndoablePlan}
      initialBalance={initialBalance}
    />
  );
}
```

- [ ] **Step 2: Add the balance prop, state, and out-of-credits phase in `organize-chat.tsx`**

In `app/(app)/organize/organize-chat.tsx`:

(a) Add to the imports:
```ts
import type { CreditDisplay } from "@/lib/credits/access";
```

(b) Add an `out-of-credits` phase to the `Phase` union (after the `failed` entry):
```ts
  | { kind: "out-of-credits"; needed: number };
```

(c) Add `initialBalance` to `Props`:
```ts
type Props = {
  initialConversations: ConversationRow[];
  initialUndoablePlan: OrganizerPlan | null;
  initialBalance: CreditDisplay;
};
```

(d) Destructure it and add balance state (after the existing `const [phase, setPhase] = ...` block):
```ts
export function OrganizeChat({ initialConversations, initialUndoablePlan, initialBalance }: Props) {
```
and, alongside the other `useState` calls (e.g. right after `const [input, setInput] = useState("");`):
```ts
  const [balance, setBalance] = useState<CreditDisplay>(initialBalance);
```

- [ ] **Step 3: Handle charges + out-of-credits in `submit`**

In the `submit` function's `startTransition` callback, update the result handling. Replace the block from `const parsed = await parseIntent(...)` through the end of the `generatePlan` handling (currently lines 124–172) with:
```ts
      const parsed = await parseIntent(parsePrompt, priorTurns.length ? priorTurns : undefined);
      if ("error" in parsed) {
        toast.error(parsed.error);
        setPhase({ kind: "idle" });
        return;
      }
      if ("outOfCredits" in parsed) {
        setBalance(parsed.balance);
        setPhase({ kind: "out-of-credits", needed: parsed.needed });
        return;
      }
      setBalance(parsed.balance);
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
      if ("outOfCredits" in planResult) {
        setBalance(planResult.balance);
        setPhase({ kind: "out-of-credits", needed: planResult.needed });
        return;
      }
      setBalance(planResult.balance);
      if (!planResult.ok) {
        setPhase({ kind: "failed", message: planResult.message });
        return;
      }
      setActiveConversationId(planResult.conversationId);
      setTranscript((t) => {
        const next = [...t];
        if (next.length > 0) {
          next[next.length - 1] = {
            planId: planResult.planId,
            prompt: parsePrompt,
            steps: planResult.steps,
            summary: planResult.summary,
            status: "pending",
          };
        }
        return next;
      });
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
```

- [ ] **Step 4: Render the out-of-credits notice**

In the transcript area, after the `phase.kind === "failed"` block (currently lines 340–347), add:
```tsx
          {phase.kind === "out-of-credits" && (
            <MessageBubble role="assistant">
              <p className="mb-2">
                You&apos;re out of credits ⚡ — top-ups and Pro are coming soon!
              </p>
              <Button size="sm" variant="outline" onClick={() => setPhase({ kind: "idle" })}>
                Got it
              </Button>
            </MessageBubble>
          )}
```

- [ ] **Step 5: Show the balance in the input footer + cost on the result**

(a) Replace the input wrapper (currently the `{/* input */}` block, lines 350–378) so the footer shows the balance above the input row:
```tsx
        {/* input */}
        <div className="border-t border-[#1f1f1f] p-3">
          <div className="mb-1.5 px-1 text-[11px] text-neutral-400">
            {balance.unlimited ? "Unlimited ⚡" : `⚡ ${balance.total} credit${balance.total === 1 ? "" : "s"}`}
          </div>
          <div className="flex gap-2">
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
```

(b) Show the per-plan cost on the live plan-ready bubble. In the `phase.kind === "plan-ready"` render block (the `MessageBubble` containing `PlanCard`, currently lines 317–328), add a small caption above the PlanCard — only when not unlimited:
```tsx
          {phase.kind === "plan-ready" && liveCard && (
            <MessageBubble role="assistant">
              {!balance.unlimited && (
                <p className="mb-1.5 text-[11px] text-neutral-400">
                  ⚡ {balance.total} credit{balance.total === 1 ? "" : "s"} left
                </p>
              )}
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
```
(Note: the design called for "N used · M left" — but `charged` would need threading into the phase. To keep the phase shape minimal, we show the authoritative remaining balance from the server here; the footer also reflects it. If you want "used" too, thread `planResult.charged` into the `plan-ready` phase — optional, not required.)

- [ ] **Step 6: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "app/(app)/organize/page.tsx" "app/(app)/organize/organize-chat.tsx"
git commit -m "feat(organizer): show credit balance + out-of-credits wall in chat"
```
(End body with the Co-Authored-By line.)

---

### Task 5: Manual verification in the running app

**Files:** none (verification only).

This feature's integration can't be unit-tested (LLM + DB + UI), so verify it by running the app. Requires `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and `ADMIN_EMAIL` in `.env.local`.

- [ ] **Step 1: Start the app** — `npm run dev`, sign in, open `/organize`.
- [ ] **Step 2: Owner unlimited** — signed in as `james@automatedpanda.com`, confirm the footer shows **"Unlimited ⚡"**, and generating several plans never decrements / never walls.
- [ ] **Step 3: Non-owner charging** — using a non-owner account (or temporarily point `ADMIN_EMAIL` at a different value), confirm:
  - Footer shows a number (e.g. `⚡ 30 credits`).
  - A single-intent plan drops the balance by **5**; a 3-intent command by **9**.
  - A clarifying question drops it by **1**; a tweak/refine by **1**.
  - `npm run credits:check -- <that user's email>` matches the footer.
- [ ] **Step 4: Out-of-credits wall** — spend a low-balance account down; confirm a request that can't be afforded shows the inline "out of credits" notice, generates **no** plan, and `credits:check` shows the balance unchanged by the blocked attempt.
- [ ] **Step 5: Apply/undo are free** — applying and undoing a plan never changes the balance.
- [ ] Report results. If a behavior is wrong, capture the exact repro for a fix task.

---

## Self-Review

**Spec coverage:**
- ✅ Owner unlimited — Task 1 (`isUnlimitedEmail`) + Task 2 (`organizerBalance`/`chargeOrganizer` bypass) + Task 4 footer.
- ✅ Charge on plan generation, not apply — Task 3 `generatePlan`.
- ✅ Clarify = 1, tweak = 1, planner-failure = 1, plan = planCost(N) — Task 3 (uses `planCost`/`TWEAK_COST` from Plan 1).
- ✅ Pre-check ≥1 before parse — Task 3 `parseIntent`.
- ✅ Insufficient → charge nothing, no plan, show wall — Task 3 `outOfCredits` + Task 4 notice.
- ✅ Balance in input footer — Task 4 Step 5.
- ✅ Cost feedback on result — Task 4 Step 5(b) (shows remaining; "used" optional).
- ✅ Apply/undo free — unchanged (no charge added to `applyPlan`/`undoPlan`).

**Placeholder scan:** none — all steps show complete code. The one optional item ("used" line) is explicitly marked optional, not a placeholder.

**Type consistency:** `CreditDisplay` (`{total, unlimited}`) is identical across `access.ts`, `gate.ts`, `actions.ts`, and `organize-chat.tsx`. `chargeOrganizer` returns `{ok, balance}` / `{ok:false, needed, balance}`, consumed correctly in `actions.ts`. `parseIntent`/`generatePlan` new return variants (`outOfCredits`, `balance`, `charged`) match what `organize-chat.tsx`'s `submit` reads. `planCost`/`TWEAK_COST` come from `lib/credits/constants.ts` (Plan 1).

**Dependency note:** Owner-unlimited relies on `ADMIN_EMAIL` being set to `james@automatedpanda.com` in `.env.local` (local) and Vercel (prod) — same env var the admin editor already needs.
