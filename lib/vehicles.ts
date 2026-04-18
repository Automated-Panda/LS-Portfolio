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
  tag_ids: string[];
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
