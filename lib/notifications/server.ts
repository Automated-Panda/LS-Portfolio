// lib/notifications/server.ts
// Service-role insert + user-scoped (RLS) reads of notifications.
import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { NotificationPayload } from "./messages";
import type { NotificationRow } from "./types";

/** Insert a notification for a user (service-role; bypasses RLS). */
export async function createNotification(
  userId: string,
  payload: NotificationPayload,
): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.from("notifications").insert({
    user_id: userId,
    type: payload.type,
    title: payload.title,
    body: payload.body,
    data: payload.data,
  });
  if (error) throw new Error(`createNotification failed: ${error.message}`);
}

/** The current user's most recent notifications (RLS-scoped). */
export async function listNotifications(limit = 20): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listNotifications failed: ${error.message}`);
  return (data as NotificationRow[]) ?? [];
}

/** Count of the current user's unread notifications (RLS-scoped). */
export async function unreadCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .is("read_at", null);
  if (error) throw new Error(`unreadCount failed: ${error.message}`);
  return count ?? 0;
}
