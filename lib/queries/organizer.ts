// lib/queries/organizer.ts
import { createClient } from "@/lib/supabase/server";

import type { PlanStep, PlanSummary } from "@/lib/organizer/types";

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
  characterId: string,
  limit = 10,
): Promise<PlanSummaryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizer_plans")
    .select("id, prompt, status, applied_at, created_at, plan_steps")
    .eq("character_id", characterId)
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

export type ConversationRow = {
  id: string;
  title: string;
  updated_at: string;
};

export async function getConversations(
  characterId: string,
  limit = 30,
): Promise<ConversationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, updated_at")
    .eq("character_id", characterId)
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
    .neq("status", "dismissed")
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

export async function getActiveUndoablePlan(
  characterId: string,
): Promise<OrganizerPlan | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizer_plans")
    .select("id, prompt, status, plan_steps, applied_at, undo_expires_at, created_at")
    .eq("character_id", characterId)
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
