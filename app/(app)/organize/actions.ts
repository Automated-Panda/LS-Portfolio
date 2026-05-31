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
  | { ok: true; planId: string; conversationId: string; steps: PlanStep[]; summary: PlanSummary }
  | { ok: false; message: string };

export async function generatePlan(
  intent: ParsedIntent,
  prompt: string,
  opts?: { conversationId?: string; supersedePlanId?: string },
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

  // Resolve the conversation: reuse the passed thread, else create one titled
  // from this prompt (first request of a new thread).
  let conversationId: string | null = opts?.conversationId ?? null;
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
    conversationId: conversationId as string,
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
