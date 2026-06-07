// app/(app)/characters/actions.ts
"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { error: string };
const MAX_CHARS = 2;

async function ctx() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, userId: user.id };
}

export async function setActiveCharacter(characterId: string): Promise<Result> {
  const c = await ctx();
  if (!c) return { error: "Not signed in." };
  const { data: ch } = await c.supabase
    .from("characters")
    .select("id")
    .eq("id", characterId)
    .eq("user_id", c.userId)
    .maybeSingle();
  if (!ch) return { error: "Character not found." };
  const { error } = await c.supabase
    .from("profiles")
    .update({ active_character_id: characterId })
    .eq("id", c.userId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function createCharacter(
  gameProfileId: string,
): Promise<{ ok: true; id: string } | { error: string }> {
  const c = await ctx();
  if (!c) return { error: "Not signed in." };
  const { data: gp } = await c.supabase
    .from("game_profiles")
    .select("id")
    .eq("id", gameProfileId)
    .eq("user_id", c.userId)
    .maybeSingle();
  if (!gp) return { error: "Profile not found." };
  const { data: existing } = await c.supabase
    .from("characters")
    .select("id")
    .eq("game_profile_id", gameProfileId)
    .eq("user_id", c.userId);
  const n = (existing ?? []).length;
  if (n >= MAX_CHARS) return { error: `A profile holds at most ${MAX_CHARS} characters.` };

  const { data: row, error } = await c.supabase
    .from("characters")
    .insert({
      game_profile_id: gameProfileId,
      user_id: c.userId,
      name: `Character ${n + 1}`,
      sort_order: n,
    })
    .select("id")
    .single();
  if (error || !row) return { error: error?.message ?? "Failed to add character." };

  // A new character is a blank slate — switch to it.
  await c.supabase
    .from("profiles")
    .update({ active_character_id: row.id })
    .eq("id", c.userId);
  revalidatePath("/", "layout");
  return { ok: true, id: row.id };
}

export async function renameCharacter(characterId: string, name: string): Promise<Result> {
  const c = await ctx();
  if (!c) return { error: "Not signed in." };
  const v = name.trim();
  if (!v) return { error: "Name can't be empty." };
  const { error } = await c.supabase
    .from("characters")
    .update({ name: v })
    .eq("id", characterId)
    .eq("user_id", c.userId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteCharacter(characterId: string): Promise<Result> {
  const c = await ctx();
  if (!c) return { error: "Not signed in." };
  const { data: all } = await c.supabase
    .from("characters")
    .select("id")
    .eq("user_id", c.userId);
  const ids = (all ?? []).map((r) => r.id as string);
  if (ids.length <= 1) return { error: "You can't delete your only character." };
  if (!ids.includes(characterId)) return { error: "Character not found." };

  // Cascades its vehicles/properties/organizer/conversations (FK ON DELETE CASCADE).
  const { error } = await c.supabase
    .from("characters")
    .delete()
    .eq("id", characterId)
    .eq("user_id", c.userId);
  if (error) return { error: error.message };

  // If it was the active one, active_character_id is now null → pick another.
  const { data: prof } = await c.supabase
    .from("profiles")
    .select("active_character_id")
    .eq("id", c.userId)
    .maybeSingle();
  if (!prof?.active_character_id) {
    const next = ids.find((id) => id !== characterId)!;
    await c.supabase.from("profiles").update({ active_character_id: next }).eq("id", c.userId);
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Create another GTA-account Profile (+ its first character). Gated: owner =
 *  unlimited, else 1 free + purchased slots. Returns "needs-purchase" so the UI
 *  can show the $2.99 prompt (the actual buy is Phase 3). */
export async function createProfile(): Promise<
  { ok: true; id: string } | { error: string }
> {
  const c = await ctx();
  if (!c) return { error: "Not signed in." };
  const { data: prof } = await c.supabase
    .from("profiles")
    .select("role, extra_profile_slots")
    .eq("id", c.userId)
    .maybeSingle();
  const isOwner = ((prof?.role as string) ?? "user") === "owner";
  const { data: gps } = await c.supabase
    .from("game_profiles")
    .select("id")
    .eq("user_id", c.userId);
  const count = (gps ?? []).length;
  if (!isOwner && count >= 1 + ((prof?.extra_profile_slots as number) ?? 0)) {
    return { error: "needs-purchase" };
  }

  const { data: gp, error } = await c.supabase
    .from("game_profiles")
    .insert({ user_id: c.userId, name: `Profile ${count + 1}`, sort_order: count })
    .select("id")
    .single();
  if (error || !gp) return { error: error?.message ?? "Failed to add profile." };

  const { data: ch } = await c.supabase
    .from("characters")
    .insert({ game_profile_id: gp.id, user_id: c.userId, name: "Character 1", sort_order: 0 })
    .select("id")
    .single();
  if (ch) {
    await c.supabase.from("profiles").update({ active_character_id: ch.id }).eq("id", c.userId);
  }
  revalidatePath("/", "layout");
  return { ok: true, id: gp.id };
}

export async function renameProfile(profileId: string, name: string): Promise<Result> {
  const c = await ctx();
  if (!c) return { error: "Not signed in." };
  const v = name.trim();
  if (!v) return { error: "Name can't be empty." };
  const { error } = await c.supabase
    .from("game_profiles")
    .update({ name: v })
    .eq("id", profileId)
    .eq("user_id", c.userId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setProfileGtaPlus(profileId: string, gtaPlus: boolean): Promise<Result> {
  const c = await ctx();
  if (!c) return { error: "Not signed in." };
  const { error } = await c.supabase
    .from("game_profiles")
    .update({ gta_plus: gtaPlus })
    .eq("id", profileId)
    .eq("user_id", c.userId);
  if (error) return { error: error.message };
  revalidatePath("/", "layout"); // GTA+ affects hangar capacity
  return { ok: true };
}

export async function deleteProfile(profileId: string): Promise<Result> {
  const c = await ctx();
  if (!c) return { error: "Not signed in." };
  const { data: gps } = await c.supabase
    .from("game_profiles")
    .select("id")
    .eq("user_id", c.userId);
  if ((gps ?? []).length <= 1) return { error: "You can't delete your only profile." };

  // Cascades its characters → their assets.
  const { error } = await c.supabase
    .from("game_profiles")
    .delete()
    .eq("id", profileId)
    .eq("user_id", c.userId);
  if (error) return { error: error.message };

  const { data: prof } = await c.supabase
    .from("profiles")
    .select("active_character_id")
    .eq("id", c.userId)
    .maybeSingle();
  if (!prof?.active_character_id) {
    const { data: anyChar } = await c.supabase
      .from("characters")
      .select("id")
      .eq("user_id", c.userId)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (anyChar) {
      await c.supabase
        .from("profiles")
        .update({ active_character_id: anyChar.id })
        .eq("id", c.userId);
    }
  }
  revalidatePath("/", "layout");
  return { ok: true };
}
