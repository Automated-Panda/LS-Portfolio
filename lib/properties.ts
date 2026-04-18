export type PropertyType = "residence" | "garage" | "business" | "special";

export type PropertySummary = {
  id: string;
  display_name: string;
  property_type: PropertyType;
  location: string | null;
  image_path: string | null;
  counts_as_garage: boolean;
  max_capacity: number;
  upgrade_count: number;
};

export type PropertyFilterOptions = {
  types: PropertyType[];
  locations: string[];
};

export function propertyImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const basename = imagePath.split("/").pop();
  return basename ? `/properties/${basename}` : null;
}

export function formatPropertyType(type: PropertyType): string {
  return type.charAt(0).toUpperCase() + type.slice(1);
}
