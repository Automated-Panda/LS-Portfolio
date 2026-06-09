import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getScope } from "@/lib/scope";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";
import { getOwnedVehicleInstances } from "@/lib/queries/my-vehicles";

import { PropertyDetail } from "@/components/portfolio/property-detail";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { characterId } = (await getScope())!;

  const { id } = await params;

  const [ownedProperties, instances, { data: tags }] = await Promise.all([
    getOwnedPropertiesWithStorage(characterId),
    getOwnedVehicleInstances(characterId),
    supabase.from("vehicle_tags").select("id, display"),
  ]);

  const property = ownedProperties.find((p) => p.id === id);
  if (!property) notFound();

  const tagLookup = Object.fromEntries(
    (tags ?? []).map((t) => [t.id, t.display]),
  );

  return (
    <PropertyDetail
      property={property}
      allOwnedProperties={ownedProperties}
      instances={instances}
      tagLookup={tagLookup}
    />
  );
}
