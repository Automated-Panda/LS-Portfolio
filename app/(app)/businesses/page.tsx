import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/scope";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";
import { getPropertiesBrowserData } from "@/lib/queries/properties";

import { PropertiesBrowser } from "../properties/properties-browser";

export default async function BusinessesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");
  const characterId = (await getScope())!.characterId;

  // Owned detail lets an owned card resolve its owned id and navigate to the
  // dedicated /my-businesses/[id] page.
  const [data, ownedProperties] = await Promise.all([
    getPropertiesBrowserData(characterId, "businesses"),
    getOwnedPropertiesWithStorage(characterId, "businesses"),
  ]);

  return <PropertiesBrowser {...data} ownedProperties={ownedProperties} />;
}
