// lib/queries/wizard.ts
import { createClient } from "@/lib/supabase/server";

/**
 * Wizard is "complete" when the user owns ≥1 property AND has ≥1 vehicle
 * instance linked to storage. Both bars must be cleared.
 */
export async function isWizardCompleted(characterId: string): Promise<boolean> {
  const supabase = await createClient();

  const [{ count: propCount }, { count: vehCount }] = await Promise.all([
    supabase
      .from("user_owned_properties")
      .select("id", { count: "exact", head: true })
      .eq("character_id", characterId),
    supabase
      .from("user_owned_vehicles")
      .select("id", { count: "exact", head: true })
      .eq("character_id", characterId)
      .not("stored_in_property_id", "is", null),
  ]);

  return (propCount ?? 0) >= 1 && (vehCount ?? 0) >= 1;
}
