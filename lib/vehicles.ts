export type DriftVariant = {
  id: string;
  owned: boolean;
};

export type VehicleSummary = {
  id: string;
  display_name: string;
  class: string;
  manufacturer_id: string;
  manufacturer_display: string;
  image_path: string | null;
  price: number | null;       // GTA$ purchase price, null = not for sale / mission-only / unsourced
  tag_ids: string[];
  owned_count: number;        // 0 if user owns no instances, N if N instances
  // When set, the vehicle has a "drift" handling variant in the game.
  // Ownership of the drift variant is tracked as a separate user_owned_vehicles
  // row but surfaced via a sub-toggle on the base vehicle's card.
  drift_variant: DriftVariant | null;
};

export type FilterOptions = {
  classes: string[];
  manufacturers: Array<{ id: string; display: string }>;
  tags: Array<{ id: string; display: string }>;
};

export function vehicleImageUrl(imagePath: string | null): string | null {
  if (!imagePath) return null;
  const basename = imagePath.split("/").pop();
  return basename ? `/vehicles/${basename}` : null;
}

// Turn "SPORT_CLASSIC" into "Sport Classic", "MUSCLE" into "Muscle".
export function formatClass(raw: string): string {
  return raw
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export type AssetCategory = "land" | "air" | "sea";

export const ASSET_CATEGORIES: AssetCategory[] = ["land", "air", "sea"];

export const ASSET_CATEGORY_LABEL: Record<AssetCategory, string> = {
  land: "Land",
  air: "Air",
  sea: "Sea",
};

// Plural noun used in storage UI ("Add cars" / "Add aircraft" / "Add boats").
export const ASSET_NOUN: Record<AssetCategory, string> = {
  land: "cars",
  air: "aircraft",
  sea: "boats",
};

// Derived from the formatted class (formatClass output).
export function assetCategoryOf(formattedClass: string): AssetCategory {
  if (formattedClass === "Plane" || formattedClass === "Helicopter") return "air";
  if (formattedClass === "Boat") return "sea";
  return "land";
}

// Property subtypes whose storage holds aircraft / boats rather than ground
// vehicles. Used to filter the vehicle picker so a hangar offers planes &
// helis, a yacht offers boats, and everything else offers cars + bikes.
// Keep in sync with the seed subtypes (scripts/data/*-seed.ts).
const AIR_STORAGE_SUBTYPES = new Set([
  "hangar",
  "mckenzie-hangar",
  "higgins-helitours",
]);
const SEA_STORAGE_SUBTYPES = new Set(["yacht"]);

// Which asset category a property's storage accepts, by subtype.
export function storageAssetCategory(subtype: string): AssetCategory {
  if (AIR_STORAGE_SUBTYPES.has(subtype)) return "air";
  if (SEA_STORAGE_SUBTYPES.has(subtype)) return "sea";
  return "land";
}
