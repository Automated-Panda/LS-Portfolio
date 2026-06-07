// lib/scope.ts
// Resolves the current request's "scope": the signed-in account (userId) and
// its ACTIVE character (characterId). Owned data (vehicles, properties,
// organizer history) is scoped to the active character; account-level data
// (credits, billing, notifications, role) stays scoped to userId.
//
// Every user has an active_character_id after migration 0047 + the signup
// trigger; the fallback here is purely defensive.

import { createClient } from "@/lib/supabase/server";

export type Scope = { userId: string; characterId: string };

/** The current scope, or null when not signed in / no character yet. */
export async function getScope(): Promise<Scope | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: prof } = await supabase
    .from("profiles")
    .select("active_character_id")
    .eq("id", user.id)
    .maybeSingle();

  let characterId = (prof?.active_character_id as string | null) ?? null;

  // Defensive fallback: no active character set → adopt the earliest one and
  // persist it. (Shouldn't happen in normal flow.)
  if (!characterId) {
    const { data: ch } = await supabase
      .from("characters")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    characterId = (ch?.id as string | null) ?? null;
    if (characterId) {
      await supabase
        .from("profiles")
        .update({ active_character_id: characterId })
        .eq("id", user.id);
    }
  }

  if (!characterId) return null;
  return { userId: user.id, characterId };
}
