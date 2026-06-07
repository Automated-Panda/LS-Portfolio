// lib/hangar-boost.ts
import { createClient } from "@/lib/supabase/server";

/** Ownership group of the regular, capacity-bearing Hangar. */
export const HANGAR_OWNERSHIP_GROUP = "hangar";

/** Catalogue id of the McKenzie Field Hangar (the boost unlock). */
export const MCKENZIE_PROPERTY_ID = "mckenzie-field-hangar";

/**
 * Extra aircraft slots McKenzie adds to a regular Hangar.
 * Owns McKenzie + GTA+ -> +20; owns McKenzie only -> +15; else 0.
 */
export function hangarBoostSlots(ownsMckenzie: boolean, gtaPlus: boolean): number {
  if (!ownsMckenzie) return 0;
  return gtaPlus ? 20 : 15;
}

/**
 * Effective capacity for a storage location. The boost applies ONLY to a
 * regular hangar's base storage (assignedUpgradeId == null on an
 * ownership_group === "hangar" property). Everything else is unchanged.
 */
export function applyHangarBoost(opts: {
  ownershipGroup: string;
  assignedUpgradeId: string | null;
  baseCapacity: number;
  ownsMckenzie: boolean;
  gtaPlus: boolean;
}): number {
  const isHangarBase =
    opts.ownershipGroup === HANGAR_OWNERSHIP_GROUP &&
    opts.assignedUpgradeId == null;
  if (!isHangarBase) return opts.baseCapacity;
  return opts.baseCapacity + hangarBoostSlots(opts.ownsMckenzie, opts.gtaPlus);
}

/** Per-character inputs to the boost. Two cheap lookups. McKenzie ownership is
 *  per character; GTA+ is per the character's Profile (GTA account). */
export type HangarBoostContext = { ownsMckenzie: boolean; gtaPlus: boolean };

export async function getHangarBoostContext(
  characterId: string,
): Promise<HangarBoostContext> {
  const supabase = await createClient();
  const [mck, char] = await Promise.all([
    supabase
      .from("user_owned_properties")
      .select("id", { count: "exact", head: true })
      .eq("character_id", characterId)
      .eq("property_id", MCKENZIE_PROPERTY_ID),
    supabase
      .from("characters")
      .select("game_profiles(gta_plus)")
      .eq("id", characterId)
      .maybeSingle(),
  ]);
  const gp = Array.isArray(char.data?.game_profiles)
    ? char.data?.game_profiles[0]
    : char.data?.game_profiles;
  return {
    ownsMckenzie: (mck.count ?? 0) > 0,
    gtaPlus: (gp as { gta_plus?: boolean } | null | undefined)?.gta_plus ?? false,
  };
}
