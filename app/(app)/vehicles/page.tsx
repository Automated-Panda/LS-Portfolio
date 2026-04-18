import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getVehiclesBrowserData } from "@/lib/queries/vehicles";

import { VehiclesBrowser } from "./vehicles-browser";

export default async function VehiclesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const data = await getVehiclesBrowserData(user.id);

  return <VehiclesBrowser {...data} />;
}
