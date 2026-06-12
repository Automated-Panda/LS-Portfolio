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
        // Older snapshots (pre slot-capture) omit these — restore as unplaced.
        slot_number: v.slot_number ?? null,
        sub_slot: v.sub_slot ?? null,
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
