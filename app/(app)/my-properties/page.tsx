import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/scope";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";

import { MyPropertiesGrid } from "./my-properties-grid";
import { MyPropertiesEmptyState } from "./empty-state";

export default async function MyPropertiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { characterId } = (await getScope())!;

  const properties = await getOwnedPropertiesWithStorage(characterId, "properties");

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">My Properties</h1>
      {properties.length === 0 ? (
        <MyPropertiesEmptyState />
      ) : (
        <MyPropertiesGrid properties={properties} />
      )}
    </div>
  );
}
