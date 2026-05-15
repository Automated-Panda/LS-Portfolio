import { createClient } from "@/lib/supabase/server";
import type {
  PropertyFilterOptions,
  PropertySummary,
  PropertyType,
} from "@/lib/properties";

export type PropertiesBrowserData = {
  properties: PropertySummary[];
  ownedPropertyIds: string[];
  filters: PropertyFilterOptions;
};

export async function getPropertiesBrowserData(
  userId: string,
): Promise<PropertiesBrowserData> {
  const supabase = await createClient();

  const [
    { data: propertyRows, error: propsErr },
    { data: ownedRows, error: ownedErr },
  ] = await Promise.all([
    supabase
      .from("properties")
      .select(
        `id, display_name, property_type, subtype, subtype_display,
         location, neighborhood, capacity, image_path, counts_as_garage,
         property_upgrades ( capacity )`,
      )
      .order("subtype_display", { ascending: true })
      .order("display_name", { ascending: true }),
    supabase
      .from("user_owned_properties")
      .select("property_id")
      .eq("user_id", userId),
  ]);

  if (propsErr) throw propsErr;
  if (ownedErr) throw ownedErr;

  type RawProperty = {
    id: string;
    display_name: string;
    property_type: PropertyType;
    subtype: string;
    subtype_display: string;
    location: string | null;
    neighborhood: string | null;
    capacity: number;
    image_path: string | null;
    counts_as_garage: boolean;
    property_upgrades: Array<{ capacity: number }> | null;
  };

  const raw = (propertyRows ?? []) as RawProperty[];

  const properties: PropertySummary[] = raw.map((p) => {
    const upgrades = p.property_upgrades ?? [];
    const upgradeMax = upgrades.reduce(
      (m, u) => Math.max(m, u.capacity ?? 0),
      0,
    );
    return {
      id: p.id,
      display_name: p.display_name,
      property_type: p.property_type,
      subtype: p.subtype,
      subtype_display: p.subtype_display,
      location: p.location,
      neighborhood: p.neighborhood,
      capacity: p.capacity,
      image_path: p.image_path,
      counts_as_garage: p.counts_as_garage,
      max_capacity: Math.max(p.capacity, upgradeMax),
      upgrade_count: upgrades.length,
    };
  });

  const typeSet = new Set<PropertyType>();
  const subtypeMap = new Map<string, string>();
  const nbhdSet = new Set<string>();
  for (const p of properties) {
    typeSet.add(p.property_type);
    subtypeMap.set(p.subtype, p.subtype_display);
    if (p.neighborhood) nbhdSet.add(p.neighborhood);
  }

  const typeOrder: PropertyType[] = ["residence", "garage", "business", "special"];

  return {
    properties,
    ownedPropertyIds: (ownedRows ?? []).map((r) => r.property_id),
    filters: {
      types: typeOrder.filter((t) => typeSet.has(t)),
      subtypes: Array.from(subtypeMap.entries())
        .map(([id, display]) => ({ id, display }))
        .sort((a, b) => a.display.localeCompare(b.display)),
      neighborhoods: Array.from(nbhdSet).sort(),
    },
  };
}
