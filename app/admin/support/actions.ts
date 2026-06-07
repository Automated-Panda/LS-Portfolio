// app/admin/support/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidStatus, isValidPriority } from "@/lib/support/tickets";
import { createNotification } from "@/lib/notifications/server";
import { ticketStatusNotification } from "@/lib/notifications/messages";
import { logAdminActivity } from "@/lib/admin/activity";

type Result = { ok: true } | { error: string };

/** A readable, identifiable ticket label for the activity log, e.g. "Bug (#60c7e8b5)". */
function ticketLabel(category: string | null | undefined, id: string): string {
  const cat = category?.trim() || "Ticket";
  return `${cat} (#${id.slice(0, 8)})`;
}

export async function setTicketStatus(id: string, status: string): Promise<Result> {
  await requireAdmin();
  if (!isValidStatus(status)) return { error: "Invalid status." };

  const supabase = createAdminClient();
  const { data: ticket, error: fetchErr } = await supabase
    .from("support_tickets")
    .select("user_id, category, status")
    .eq("id", id)
    .maybeSingle();
  if (fetchErr) return { error: fetchErr.message };
  if (!ticket) return { error: "Ticket not found." };

  const { error } = await supabase.from("support_tickets").update({ status }).eq("id", id);
  if (error) return { error: error.message };

  const t = ticket as { user_id: string; category: string; status: string };

  await logAdminActivity({
    action: "ticket.status",
    targetId: id,
    targetLabel: ticketLabel(t.category, id),
    changes: { from: t.status, to: status },
  });
  // Best-effort alert — the status change already succeeded, so a notification
  // failure must not crash the action (mirrors the credit-adjust pattern).
  try {
    await createNotification(t.user_id, ticketStatusNotification(t.category, status));
  } catch (e) {
    console.error("[support] status-change notification failed (non-fatal):", e);
  }

  revalidatePath("/admin/support");
  return { ok: true };
}

/** Mark a ticket read (read=true → stamp read_at now) or unread (read_at null).
 *  Deliberately NOT activity-logged — it fires on every open and would be noise. */
export async function setTicketRead(id: string, read: boolean): Promise<Result> {
  await requireAdmin();
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("support_tickets")
    .update({ read_at: read ? new Date().toISOString() : null })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/admin/support");
  return { ok: true };
}

export async function setTicketPriority(id: string, priority: string): Promise<Result> {
  await requireAdmin();
  if (!isValidPriority(priority)) return { error: "Invalid priority." };

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from("support_tickets")
    .select("category, priority")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("support_tickets").update({ priority }).eq("id", id);
  if (error) return { error: error.message };

  const b = before as { category?: string; priority?: string } | null;
  await logAdminActivity({
    action: "ticket.priority",
    targetId: id,
    targetLabel: ticketLabel(b?.category, id),
    changes: { from: b?.priority ?? null, to: priority },
  });

  revalidatePath("/admin/support");
  return { ok: true };
}

export async function addTicketNote(id: string, body: string): Promise<Result> {
  await requireAdmin();
  const text = body.trim();
  if (!text) return { error: "Note can't be empty." };

  const userClient = await createClient();
  const {
    data: { user },
  } = await userClient.auth.getUser();

  const supabase = createAdminClient();
  const { data: ticket } = await supabase
    .from("support_tickets")
    .select("category")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("support_ticket_notes").insert({
    ticket_id: id,
    author_id: user?.id ?? null,
    body: text,
  });
  if (error) return { error: error.message };

  await logAdminActivity({
    action: "ticket.note",
    targetId: id,
    targetLabel: ticketLabel((ticket as { category?: string } | null)?.category, id),
    changes: { note: text },
  });

  revalidatePath("/admin/support");
  return { ok: true };
}
