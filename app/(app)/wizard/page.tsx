import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/scope";
import { getPropertiesBrowserData } from "@/lib/queries/properties";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";
import { getOwnedVehicleInstances } from "@/lib/queries/my-vehicles";

import { OnboardingWizard } from "./onboarding-wizard";

export default async function WizardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const characterId = (await getScope())!.characterId;

  // Fetch both scopes in parallel and merge for the picker step.
  const [propsScope, bizScope, ownedProperties, ownedInstances, { data: tags }] =
    await Promise.all([
      getPropertiesBrowserData(characterId, "properties"),
      getPropertiesBrowserData(characterId, "businesses"),
      getOwnedPropertiesWithStorage(characterId),
      getOwnedVehicleInstances(characterId),
      supabase.from("vehicle_tags").select("id, display"),
    ]);

  const tagLookup = Object.fromEntries(
    (tags ?? []).map((t) => [t.id, t.display]),
  );

  // Merge: concat properties, union ownedPropertyIds, take properties' filters
  // (filters object structure is identical between scopes).
  const pickerData = {
    properties: [...propsScope.properties, ...bizScope.properties],
    ownedPropertyIds: Array.from(
      new Set([...propsScope.ownedPropertyIds, ...bizScope.ownedPropertyIds]),
    ),
    filters: propsScope.filters,
  };

  return (
    <OnboardingWizard
      ownedProperties={ownedProperties}
      ownedInstances={ownedInstances}
      tagLookup={tagLookup}
      pickerData={pickerData}
    />
  );
}
