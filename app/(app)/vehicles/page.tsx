import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/scope";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";
import { getOwnedVehicleInstances } from "@/lib/queries/my-vehicles";
import { getVehiclesBrowserData } from "@/lib/queries/vehicles";

import { VehiclesBrowser } from "./vehicles-browser";

export default async function VehiclesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const characterId = (await getScope())!.characterId;

  // ownedProperties + tagSuggestions feed the inline InstanceDrawer that the
  // /vehicles card popover opens for managing nickname / custom tags / notes
  // / storage on an owned instance — see VehicleCard.
  const [data, ownedProperties, instances] = await Promise.all([
    getVehiclesBrowserData(characterId),
    getOwnedPropertiesWithStorage(characterId),
    getOwnedVehicleInstances(characterId),
  ]);

  const tagSuggestions = Array.from(
    new Set(instances.flatMap((i) => i.custom_tags)),
  ).sort((a, b) => a.localeCompare(b));

  return (
    <VehiclesBrowser
      {...data}
      ownedProperties={ownedProperties}
      tagSuggestions={tagSuggestions}
    />
  );
}
