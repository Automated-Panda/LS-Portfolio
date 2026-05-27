import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";
import { getOwnedVehicleInstances } from "@/lib/queries/my-vehicles";

import { MyBusinessesGrid } from "./my-businesses-grid";
import { MyBusinessesEmptyState } from "./empty-state";

export default async function MyBusinessesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [businesses, instances] = await Promise.all([
    getOwnedPropertiesWithStorage(user.id, "businesses"),
    getOwnedVehicleInstances(user.id),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">My Businesses</h1>
      {businesses.length === 0 ? (
        <MyBusinessesEmptyState />
      ) : (
        <MyBusinessesGrid businesses={businesses} instances={instances} />
      )}
    </div>
  );
}
