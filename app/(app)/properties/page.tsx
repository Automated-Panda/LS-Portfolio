import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";
import { getPropertiesBrowserData } from "@/lib/queries/properties";

import { PropertiesBrowser } from "./properties-browser";

export default async function PropertiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Owned detail lets an owned card resolve its owned id and navigate to the
  // dedicated /my-properties/[id] page.
  const [data, ownedProperties] = await Promise.all([
    getPropertiesBrowserData(user.id, "properties"),
    getOwnedPropertiesWithStorage(user.id, "properties"),
  ]);

  return <PropertiesBrowser {...data} ownedProperties={ownedProperties} />;
}
