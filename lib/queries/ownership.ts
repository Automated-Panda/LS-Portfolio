// lib/queries/ownership.ts
import { createClient } from "@/lib/supabase/server";

export type OwnershipGroupStatus = {
  group: string;
  max: number | null;             // null = unlimited (no row in limits table)
  ownedCount: number;
  atLimit: boolean;
};

export async function getOwnershipGroupStatus(
  userId: string,
  ownershipGroup: string,
): Promise<OwnershipGroupStatus> {
  const supabase = await createClient();

  const [{ data: limit }, { data: owned, error }] = await Promise.all([
    supabase
      .from("property_ownership_limits")
      .select("max_owned")
      .eq("ownership_group", ownershipGroup)
      .maybeSingle(),
    supabase
      .from("user_owned_properties")
      .select("id, properties!inner(ownership_group)")
      .eq("user_id", userId)
      .eq("properties.ownership_group", ownershipGroup),
  ]);

  if (error) throw error;

  const max = limit?.max_owned ?? null;
  const ownedCount = (owned ?? []).length;

  return {
    group: ownershipGroup,
    max,
    ownedCount,
    atLimit: max !== null && ownedCount >= max,
  };
}
