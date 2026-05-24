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
