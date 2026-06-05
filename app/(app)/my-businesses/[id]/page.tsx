import { notFound, redirect } from "next/navigation";

import { PropertyDetail } from "@/components/portfolio/property-detail";
import { createClient } from "@/lib/supabase/server";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";
import { getOwnedVehicleInstances } from "@/lib/queries/my-vehicles";

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;

  const [ownedProperties, instances, { data: tags }] = await Promise.all([
    getOwnedPropertiesWithStorage(user.id),
    getOwnedVehicleInstances(user.id),
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
