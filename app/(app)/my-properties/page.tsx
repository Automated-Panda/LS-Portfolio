import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";
import { getOwnedVehicleInstances } from "@/lib/queries/my-vehicles";

import { MyPropertiesGrid } from "./my-properties-grid";
import { MyPropertiesEmptyState } from "./empty-state";

export default async function MyPropertiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [properties, instances] = await Promise.all([
    getOwnedPropertiesWithStorage(user.id),
    getOwnedVehicleInstances(user.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">My Properties</h1>
      {properties.length === 0 ? (
        <MyPropertiesEmptyState />
      ) : (
        <MyPropertiesGrid properties={properties} instances={instances} />
      )}
    </div>
  );
}
