// app/admin/users/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/lib/admin/guard";
import type { Role } from "@/lib/admin/roles";
import { adminAdjustCredits } from "@/lib/credits/server";
import { parseCreditDelta } from "@/lib/credits/adjust";
import { createNotification } from "@/lib/notifications/server";
import { creditAdjustmentNotification } from "@/lib/notifications/messages";
import { sendCreditsAdjustedEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAdminActivity } from "@/lib/admin/activity";

type Result = { ok: true } | { error: string };

const ASSIGNABLE_ROLES: Role[] = ["user", "editor", "owner"];
const BAN_FOREVER = "876000h"; // ~100 years

/** Adjust a user's credits by a signed amount, notify them in-app + by email. */
export async function adjustUserCredits(
  userId: string,
  amountInput: string,
  note: string,
): Promise<Result> {
  await requireOwner();

  const parsed = parseCreditDelta(amountInput);
  if (!parsed.ok) return { error: parsed.error };
  const trimmedNote = note.trim() || null;

  const { total } = await adminAdjustCredits(userId, parsed.delta, trimmedNote);

  // Alert the user — in-app always, email best-effort (never blocks).
  await createNotification(userId, creditAdjustmentNotification(parsed.delta, total));

  try {
    const supabase = createAdminClient();
    const { data } = await supabase.auth.admin.getUserById(userId);
    const email = data.user?.email;
    if (email) {
      await sendCreditsAdjustedEmail(email, {
        delta: parsed.delta,
        newBalance: total,
        note: trimmedNote,
      });
    }
  } catch (e) {
    console.error("[admin] credit-adjust email failed (non-fatal):", e);
  }

  await logAdminActivity({
    action: "user.credits",
    targetId: userId,
    targetLabel: userId,
    changes: { delta: parsed.delta, note: trimmedNote, newTotal: total },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

/** Change a user's role (service-role update bypasses the escalation trigger). */
export async function setUserRole(userId: string, role: Role): Promise<Result> {
  await requireOwner();
  if (!ASSIGNABLE_ROLES.includes(role)) return { error: "Invalid role." };

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  const { error } = await supabase.from("profiles").update({ role }).eq("id", userId);
  if (error) return { error: error.message };

  await logAdminActivity({
    action: "user.role",
    targetId: userId,
    targetLabel: userId,
    changes: { from: (before as { role?: string } | null)?.role ?? null, to: role },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}

/** Disable (ban) or re-enable a user account. */
export async function setUserDisabled(
  userId: string,
  disabled: boolean,
): Promise<Result> {
  await requireOwner();

  const supabase = createAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: disabled ? BAN_FOREVER : "none",
  });
  if (error) return { error: error.message };

  await logAdminActivity({
    action: "user.disabled",
    targetId: userId,
    targetLabel: userId,
    changes: { to: disabled },
  });

  revalidatePath("/admin/users");
  return { ok: true };
}
