import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOwnedVehicleInstances } from "@/lib/queries/my-vehicles";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";

import { MyVehiclesClient } from "./my-vehicles-client";

export default async function MyVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ unassigned?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const initialUnassignedOnly = sp.unassigned === "1";

  const [instances, ownedProperties, { data: tags }] = await Promise.all([
    getOwnedVehicleInstances(user.id),
    getOwnedPropertiesWithStorage(user.id),
    supabase.from("vehicle_tags").select("id, display"),
  ]);

  const tagLookup = Object.fromEntries(
    (tags ?? []).map((t) => [t.id, t.display]),
  );

  return (
    <MyVehiclesClient
      instances={instances}
      ownedProperties={ownedProperties}
      tagLookup={tagLookup}
      initialUnassignedOnly={initialUnassignedOnly}
    />
  );
}
