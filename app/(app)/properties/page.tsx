import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";
import { getOwnedVehicleInstances } from "@/lib/queries/my-vehicles";
import { getPropertiesBrowserData } from "@/lib/queries/properties";

import { PropertiesBrowser } from "./properties-browser";

export default async function PropertiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Owned detail + instances feed the in-place PropertyDrawer so the Settings
  // icon on an owned card opens management without redirecting to /my-properties.
  const [data, ownedProperties, instances] = await Promise.all([
    getPropertiesBrowserData(user.id, "properties"),
    getOwnedPropertiesWithStorage(user.id, "properties"),
    getOwnedVehicleInstances(user.id),
  ]);

  return (
    <PropertiesBrowser
      {...data}
      ownedProperties={ownedProperties}
      instances={instances}
    />
  );
}
