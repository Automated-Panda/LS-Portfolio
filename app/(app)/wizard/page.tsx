import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getPropertiesBrowserData } from "@/lib/queries/properties";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";

import { OnboardingWizard } from "./onboarding-wizard";

export default async function WizardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Fetch both scopes in parallel and merge for the picker step.
  const [propsScope, bizScope, ownedProperties] = await Promise.all([
    getPropertiesBrowserData(user.id, "properties"),
    getPropertiesBrowserData(user.id, "businesses"),
    getOwnedPropertiesWithStorage(user.id),
  ]);

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
      pickerData={pickerData}
    />
  );
}
