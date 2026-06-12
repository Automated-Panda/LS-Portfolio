"use server";

import { revalidatePath } from "next/cache";

import { applyPlan as applyPlanLib } from "@/lib/organizer/apply-plan";
import { formatFailure } from "@/lib/organizer/format-failure";
import { parseIntent as parseIntentLib } from "@/lib/organizer/intent-parser";
import { generatePlan as generatePlanLib } from "@/lib/organizer/planner";
import { buildPortfolioContext } from "@/lib/organizer/portfolio-context";
import { conversationTitle } from "@/lib/organizer/conversation-title";
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
import { getScope } from "@/lib/scope";
import { createClient } from "@/lib/supabase/server";
import { planCost, TWEAK_COST } from "@/lib/credits/constants";
import { organizerBalance, chargeOrganizer } from "@/lib/credits/gate";
import type { CreditDisplay } from "@/lib/credits/access";

// ----- parseIntent -----

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
  const { characterId } = (await getScope())!;

  // Pre-check: need at least 1 credit to send a message at all (owner bypassed).
  const balance = await organizerBalance(user.id, user.email);
  if (!balance.unlimited && balance.total < 1) {
    return { outOfCredits: true, needed: 1, balance };
  }

  // Load everything the LLM needs.
  const [vehicles, properties, { data: systemTags }, { data: manufacturers }] = await Promise.all([
    getOwnedVehicleInstances(characterId),
    getOwnedPropertiesWithStorage(characterId),
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
    // The pre-check above guarantees ≥1 credit, so this charge effectively always
    // succeeds; if a race ever made it fail we'd still show the clarification
    // un-charged (the safe-for-the-user outcome), so charge.ok isn't inspected.
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

// ----- generatePlan -----

export type GeneratePlanResult =
  | { ok: true; planId: string; conversationId: string; steps: PlanStep[]; summary: PlanSummary; charged: number; balance: CreditDisplay }
  | { ok: false; message: string; balance: CreditDisplay }
  | { outOfCredits: true; needed: number; balance: CreditDisplay };

export async function generatePlan(
  intent: ParsedIntent,
  prompt: string,
  opts?: { conversationId?: string; supersedePlanId?: string },
): Promise<GeneratePlanResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Not signed in.", balance: { total: 0, unlimited: false } };
  const { characterId } = (await getScope())!;

  const [vehicles, properties, { data: manufacturers }] = await Promise.all([
    getOwnedVehicleInstances(characterId),
    getOwnedPropertiesWithStorage(characterId),
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
    // Planner failure = no usable plan, but Haiku calls fired → charge the floor.
    // Build the message FIRST so a formatFailure throw doesn't debit a user who
    // never sees a result.
    const message = await formatFailure({ failure: result.failure, promptText: prompt });
    const charge = await chargeOrganizer(user.id, user.email, 1, "failure");
    return { ok: false, message, balance: charge.balance };
  }

  // Plan is generatable — charge for it BEFORE persisting (the spend is the gate).
  // Tweak (refinement) is a flat TWEAK_COST; a fresh plan is planCost(intents).
  const cost = opts?.supersedePlanId ? TWEAK_COST : planCost(intent.criteria.length);
  const charge = await chargeOrganizer(user.id, user.email, cost, opts?.supersedePlanId ? "tweak" : "plan");
  if (!charge.ok) {
    return { outOfCredits: true, needed: charge.needed, balance: charge.balance };
  }

  // Resolve the conversation: reuse the passed thread, else create one with a
  // title derived from the parsed intent (e.g. "Drift cars → Mission Row").
  let conversationId: string | null = opts?.conversationId ?? null;
  if (!conversationId) {
    const propertyNameById = new Map(properties.map((p) => [p.id, p.display_name]));
    const title = conversationTitle(intent, propertyNameById, prompt);
    const { data: convo, error: convoErr } = await supabase
      .from("conversations")
      .insert({ user_id: user.id, character_id: characterId, title })
      .select("id")
      .single();
    if (convoErr || !convo) {
      return { ok: false, message: convoErr?.message ?? "Failed to start conversation.", balance: charge.balance };
    }
    conversationId = convo.id;
  } else {
    // Touch the thread so it floats to the top of the rail.
    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
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
      character_id: characterId,
      conversation_id: conversationId,
      prompt,
      parsed_intent: intent,
      plan_steps: result.steps,
      status: "pending",
    })
    .select("id")
    .single();
  if (insertErr || !insertRow) {
    return { ok: false, message: insertErr?.message ?? "Failed to save plan.", balance: charge.balance };
  }

  return {
    ok: true,
    planId: insertRow.id,
    conversationId: conversationId as string,
    steps: result.steps,
    summary: result.summary,
    charged: cost,
    balance: charge.balance,
  };
}

// ----- renameConversation / deleteConversation -----

export type ConversationActionResult = { ok: true } | { error: string };

export async function renameConversation(
  conversationId: string,
  title: string,
): Promise<ConversationActionResult> {
  const trimmed = title.trim().slice(0, 80);
  if (!trimmed) return { error: "Title can't be empty." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { error } = await supabase
    .from("conversations")
    .update({ title: trimmed })
    .eq("id", conversationId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/organize");
  return { ok: true };
}

export async function deleteConversation(
  conversationId: string,
): Promise<ConversationActionResult> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // organizer_plans.conversation_id is ON DELETE CASCADE, so the thread's
  // plans go with it.
  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };

  revalidatePath("/organize");
  return { ok: true };
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
    // A numbered slot / sub-slot is scoped to one (property, upgrade) area, so a
    // move must drop both — otherwise the car carries its old slot number into
    // the target floor and trips the (property, upgrade, slot) unique index as
    // soon as two moved cars collide on the same spot.
    const patch =
      step.type === "unassign"
        ? { stored_in_property_id: null, assigned_upgrade_id: null, sub_slot: null, slot_number: null }
        : {
            stored_in_property_id: step.to.property_id,
            assigned_upgrade_id: step.to.upgrade_id,
            sub_slot: null,
            slot_number: null,
          };
    const { error } = await supabase
      .from("user_owned_vehicles")
      .update(patch)
      .eq("id", step.owned_vehicle_id)
      .eq("user_id", user.id);
    if (error) return { error: error.message };
  } else {
    // Untick: restore from the step's `from` (since checklist mode never
    // snapshots; we trust the step's own from-state). The slot was dropped on
    // the forward move, so the car returns to its old area unplaced.
    const patch = {
      stored_in_property_id: step.from.property_id || null,
      assigned_upgrade_id: step.from.upgrade_id,
      sub_slot: null,
      slot_number: null,
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
