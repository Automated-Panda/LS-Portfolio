import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";

import { MyBusinessesGrid } from "./my-businesses-grid";
import { MyBusinessesEmptyState } from "./empty-state";

export default async function MyBusinessesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const businesses = await getOwnedPropertiesWithStorage(user.id, "businesses");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">My Businesses</h1>
      {businesses.length === 0 ? (
        <MyBusinessesEmptyState />
      ) : (
        <MyBusinessesGrid businesses={businesses} />
      )}
    </div>
  );
}
