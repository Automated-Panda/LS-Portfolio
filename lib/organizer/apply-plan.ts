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
    .select("id, stored_in_property_id, assigned_upgrade_id, slot_number, sub_slot")
    .in("id", affectedVehicleIds)
    .eq("user_id", user.id);
  if (snapErr) return { error: snapErr.message };

  const snapshot: UndoSnapshot = {
    vehicles: (currentRows ?? []).map((r) => ({
      owned_vehicle_id: r.id,
      stored_in_property_id: r.stored_in_property_id,
      assigned_upgrade_id: r.assigned_upgrade_id,
      slot_number: r.slot_number,
      sub_slot: r.sub_slot,
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
    // Drop the area-scoped numbered slot / sub-slot on every move, or the car
    // carries its old slot into the target floor and trips the
    // (property, upgrade, slot) unique index when two moved cars collide.
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
