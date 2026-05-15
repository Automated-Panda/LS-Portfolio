import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getPropertiesBrowserData } from "@/lib/queries/properties";

import { PropertiesBrowser } from "../properties/properties-browser";

export default async function BusinessesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const data = await getPropertiesBrowserData(user.id, "businesses");

  return <PropertiesBrowser {...data} />;
}
