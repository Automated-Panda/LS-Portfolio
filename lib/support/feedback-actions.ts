// lib/support/feedback-actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { validateFeedback } from "@/lib/support/tickets";

export type FeedbackResult = { ok: true } | { error: string };

export async function submitFeedback(input: {
  category: string;
  message: string;
  relatedItem: string;
}): Promise<FeedbackResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please sign in." };

  const v = validateFeedback({
    category: input.category,
    message: input.message,
    relatedItem: input.relatedItem,
  });
  if (!v.ok) return { error: v.error };

  const related = input.relatedItem.trim() || null;
  const { error } = await supabase.from("support_tickets").insert({
    user_id: user.id,
    category: input.category,
    message: input.message.trim(),
    related_item: related,
  });
  if (error) return { error: error.message };
  return { ok: true };
}
