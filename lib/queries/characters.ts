// lib/queries/characters.ts
// Loads the multi-character structure for the switcher + management screen:
// the account's Profiles (GTA accounts) and their Characters, with per-character
// asset counts and the active character. See docs/notes.md "Multi-character".
import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/scope";
import type { CharacterSwitcherData, SwitcherProfile } from "@/lib/characters-shared";

export type {
  CharacterSwitcherData,
  SwitcherProfile,
  SwitcherCharacter,
} from "@/lib/characters-shared";

export async function getCharacterSwitcherData(): Promise<CharacterSwitcherData | null> {
  const scope = await getScope();
  if (!scope) return null;
  const supabase = await createClient();

  const [{ data: gps }, { data: chars }, { data: prof }, { data: vehRows }, { data: propRows }] =
    await Promise.all([
      supabase
        .from("game_profiles")
        .select("id, name, gta_plus, sort_order, created_at")
        .eq("user_id", scope.userId)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("characters")
        .select("id, game_profile_id, name, sort_order, created_at")
        .eq("user_id", scope.userId)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("profiles")
        .select("role, extra_profile_slots")
        .eq("id", scope.userId)
        .maybeSingle(),
      supabase.from("user_owned_vehicles").select("character_id").eq("user_id", scope.userId),
      supabase.from("user_owned_properties").select("character_id").eq("user_id", scope.userId),
    ]);

  const vc = new Map<string, number>();
  for (const r of vehRows ?? []) {
    const id = r.character_id as string | null;
    if (id) vc.set(id, (vc.get(id) ?? 0) + 1);
  }
  const pc = new Map<string, number>();
  for (const r of propRows ?? []) {
    const id = r.character_id as string | null;
    if (id) pc.set(id, (pc.get(id) ?? 0) + 1);
  }

  const profiles: SwitcherProfile[] = (gps ?? []).map((gp) => ({
    id: gp.id,
    name: gp.name,
    gtaPlus: gp.gta_plus,
    characters: (chars ?? [])
      .filter((c) => c.game_profile_id === gp.id)
      .map((c) => ({
        id: c.id,
        name: c.name,
        vehicleCount: vc.get(c.id) ?? 0,
        propertyCount: pc.get(c.id) ?? 0,
      })),
  }));

  const isOwner = ((prof?.role as string) ?? "user") === "owner";
  const extraSlots = (prof?.extra_profile_slots as number) ?? 0;
  const canAddProfile = isOwner || profiles.length < 1 + extraSlots;

  return { profiles, activeCharacterId: scope.characterId, isOwner, canAddProfile };
}
