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

/** Per-user inputs to the boost. Two cheap lookups. */
export type HangarBoostContext = { ownsMckenzie: boolean; gtaPlus: boolean };

export async function getHangarBoostContext(
  userId: string,
): Promise<HangarBoostContext> {
  const supabase = await createClient();
  const [mck, prof] = await Promise.all([
    supabase
      .from("user_owned_properties")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("property_id", MCKENZIE_PROPERTY_ID),
    supabase.from("profiles").select("gta_plus").eq("id", userId).maybeSingle(),
  ]);
  return {
    ownsMckenzie: (mck.count ?? 0) > 0,
    gtaPlus: prof.data?.gta_plus ?? false,
  };
}
