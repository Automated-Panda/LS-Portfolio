// lib/admin/activity.ts
// Best-effort audit logging. Resolves the acting admin and appends a row via the
// service-role client. NEVER throws — a logging failure must not break the action.
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FieldChange } from "./activity-format";

export type AdminActivityInput = {
  action: string;
  targetLabel?: string | null;
  targetId?: string | null;
  changes?: Record<string, unknown> | FieldChange[];
};

export async function logAdminActivity(input: AdminActivityInput): Promise<void> {
  try {
    const userClient = await createClient();
    const {
      data: { user },
    } = await userClient.auth.getUser();

    const supabase = createAdminClient();
    const { error } = await supabase.from("admin_activity_log").insert({
      actor_id: user?.id ?? null,
      actor_email: user?.email ?? null,
      action: input.action,
      target_label: input.targetLabel ?? null,
      target_id: input.targetId ?? null,
      changes: input.changes ?? {},
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("[admin] activity log failed (non-fatal):", e);
  }
}
