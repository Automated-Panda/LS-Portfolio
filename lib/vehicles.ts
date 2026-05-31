export type DriftVariant = {
  id: string;
  owned: boolean;
};

export type AvailabilityStatus =
  | "available"
  | "discontinued"
  | "unobtainable"
  | "blacklisted"
  | "seasonal";

export const AVAILABILITY_LABEL: Record<AvailabilityStatus, string> = {
  available: "Available",
  discontinued: "Discontinued",
  unobtainable: "Unobtainable",
  blacklisted: "Blacklisted",
  seasonal: "Seasonal",
};

// Tailwind classes for the status badge. "available" has no badge (it's the norm).
export const AVAILABILITY_BADGE_CLASS: Record<
  Exclude<AvailabilityStatus, "available">,
  string
> = {
  discontinued: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  unobtainable: "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  blacklisted: "bg-red-500/15 text-red-300 border-red-500/30",
  seasonal: "bg-orange-500/15 text-orange-300 border-orange-500/30",
};

export type VehicleVendor =
  | "southern_san_andreas"
  | "legendary_motorsport"
  | "elitas_travel"
  | "warstock"
  | "dock_tease"
  | "pedal_metal"
  | "bennys";

export const VENDOR_LABEL: Record<VehicleVendor, string> = {
  southern_san_andreas: "Southern San Andreas",
  legendary_motorsport: "Legendary Motorsport",
  elitas_travel: "Elitás Travel",
  warstock: "Warstock Cache & Carry",
  dock_tease: "Dock Tease",
  pedal_metal: "Pedal & Metal",
  bennys: "Benny's",
};

export const VENDOR_OPTIONS: VehicleVendor[] = [
  "southern_san_andreas",
  "legendary_motorsport",
  "elitas_travel",
  "warstock",
  "dock_tease",
  "pedal_metal",
  "bennys",
];

export type VehicleSummary = {
  id: string;
  display_name: string;
  class: string;
  manufacturer_id: string;
  manufacturer_display: string;
  image_path: string | null;
  price: number | null;       // GTA$ purchase price, null = not for sale / mission-only / unsourced
  tag_ids: string[];
  availability: AvailabilityStatus;
  vendors: VehicleVendor[];
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

// Lowercase + strip diacritics so a search for "franken" matches "Fränken
// Stange". Used by the catalogue search so accented names are findable.
export function normalizeSearch(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
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

// Generic plural noun for storage UI ("Add vehicles" / "Add aircraft" /
// "Add boats"). Land storage holds cars AND bikes, so "vehicles" is the
// umbrella term — the picker refines to "cars"/"bikes" based on the actual
// selection (see VehiclePickerModal).
export const ASSET_NOUN: Record<AssetCategory, string> = {
  land: "vehicles",
  air: "aircraft",
  sea: "boats",
};

// True for two-wheelers — motorbikes (class MOTORCYCLE → "Motorcycle") and
// pedal cycles (class CYCLE → "Cycle"). Takes the formatClass() output. Used to
// label land vehicles as "bikes" vs "cars" in storage UI and dashboard splits.
export function isBikeClass(formattedClass: string): boolean {
  return formattedClass === "Motorcycle" || formattedClass === "Cycle";
}

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
