// lib/notifications/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

/** Mark all of the current user's unread notifications as read. */
export async function markAllNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null)
    .eq("user_id", user.id);
  if (error) throw new Error(`markAllNotificationsRead failed: ${error.message}`);
  revalidatePath("/", "layout");
}
