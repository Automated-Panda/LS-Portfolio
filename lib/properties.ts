export type PropertyType = "residence" | "garage" | "business" | "special";

export type PropertySummary = {
  id: string;
  display_name: string;
  property_type: PropertyType;
  subtype: string;
  subtype_display: string;
  location: string | null;
  neighborhood: string | null;
  capacity: number;
  parent_building: string | null;
  image_path: string | null;
  counts_as_garage: boolean;
  max_capacity: number;
  upgrade_count: number;
};

export type PropertyFilterOptions = {
  types: PropertyType[];
  subtypes: { id: string; display: string }[];
  neighborhoods: string[];
};

export function propertyImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const basename = imagePath.split("/").pop();
  return basename ? `/properties/${basename}` : null;
}

export function formatPropertyType(type: PropertyType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}
