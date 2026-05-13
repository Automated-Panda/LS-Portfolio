import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getVehiclesBrowserData } from "@/lib/queries/vehicles";

import { VehiclesBrowser } from "../vehicles/vehicles-browser";

export default async function MyVehiclesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const data = await getVehiclesBrowserData(user.id);
  const ownedSet = new Set(data.ownedVehicleIds);
  const ownedVehicles = data.vehicles.filter(
    (v) => ownedSet.has(v.id) || (v.drift_variant?.owned ?? false),
  );

  return (
    <VehiclesBrowser
      vehicles={ownedVehicles}
      ownedVehicleIds={data.ownedVehicleIds}
      filters={data.filters}
      mode="owned"
    />
  );
}
