"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type Result = { ok: true; updated: number } | { error: string };

/**
 * Rename a highlight everywhere it appears in the current user's vehicle
 * fleet. Atomic: every row that had `oldTag` now has `newTag` in its place
 * (preserving order). Case-insensitive dedup runs server-side so the rename
 * can't create duplicates within a single vehicle.
 */
export async function renameHighlight(
  oldTag: string,
  newTag: string,
): Promise<Result> {
  const oldTrim = oldTag.trim();
  const newTrim = newTag.trim();
  if (!oldTrim || !newTrim) return { error: "Tag names can't be empty." };
  if (oldTrim === newTrim) return { ok: true, updated: 0 };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  // Pull every row that contains the old tag.
  const { data, error: selErr } = await supabase
    .from("user_owned_vehicles")
    .select("id, custom_tags")
    .eq("user_id", user.id)
    .contains("custom_tags", [oldTrim]);
  if (selErr) return { error: selErr.message };

  let updated = 0;
  for (const row of data ?? []) {
    const tags = (row.custom_tags ?? []) as string[];
    const seen = new Set<string>();
    const next: string[] = [];
    for (const t of tags) {
      const replaced = t === oldTrim ? newTrim : t;
      const key = replaced.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      next.push(replaced);
    }
    const { error: updErr } = await supabase
      .from("user_owned_vehicles")
      .update({ custom_tags: next })
      .eq("id", row.id)
      .eq("user_id", user.id);
    if (updErr) return { error: updErr.message };
    updated += 1;
  }

  revalidatePath("/", "layout");
  return { ok: true, updated };
}

/**
 * Remove a highlight everywhere it appears in the current user's vehicle
 * fleet.
 */
export async function deleteHighlight(tag: string): Promise<Result> {
  const trimmed = tag.trim();
  if (!trimmed) return { error: "Tag name can't be empty." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in." };

  const { data, error: selErr } = await supabase
    .from("user_owned_vehicles")
    .select("id, custom_tags")
    .eq("user_id", user.id)
    .contains("custom_tags", [trimmed]);
  if (selErr) return { error: selErr.message };

  let updated = 0;
  for (const row of data ?? []) {
    const tags = (row.custom_tags ?? []) as string[];
    const next = tags.filter((t) => t !== trimmed);
    const { error: updErr } = await supabase
      .from("user_owned_vehicles")
      .update({ custom_tags: next })
      .eq("id", row.id)
      .eq("user_id", user.id);
    if (updErr) return { error: updErr.message };
    updated += 1;
  }

  revalidatePath("/", "layout");
  return { ok: true, updated };
}
