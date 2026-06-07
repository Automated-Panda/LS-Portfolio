// lib/queries/highlights.ts
//
// "Highlights" are user-defined custom tags stored as a text[] on each
// user_owned_vehicles row. This query rolls them up so /profile can show
// every distinct tag the user has, with its usage count, sorted by usage
// then alphabetically.
import { createClient } from "@/lib/supabase/server";

export type UserHighlight = {
  tag: string;
  usage: number;
};

export async function getUserHighlights(
  characterId: string,
): Promise<UserHighlight[]> {
  const supabase = await createClient();

  // Pull every row's custom_tags and reduce in JS — much simpler than
  // unnesting via PostgREST. Volume is small per user (dozens at most).
  const { data, error } = await supabase
    .from("user_owned_vehicles")
    .select("custom_tags")
    .eq("character_id", characterId);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const tags = (row.custom_tags ?? []) as string[];
    for (const t of tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([tag, usage]) => ({ tag, usage }))
    .sort((a, b) => b.usage - a.usage || a.tag.localeCompare(b.tag));
}
