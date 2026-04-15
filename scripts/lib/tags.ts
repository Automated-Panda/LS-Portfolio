import type { Tag } from "../schema";

export function deriveTagsForVehicle(
  vehicleId: string,
  fandomCategories: string[],
  tagDefinitions: Record<string, Tag>,
): string[] {
  const tags: string[] = [];
  for (const [tagId, def] of Object.entries(tagDefinitions)) {
    if (def.rule.type === "fandom_category") {
      const target = def.rule.category.toLowerCase();
      if (fandomCategories.some((c) => c.toLowerCase().includes(target))) {
        tags.push(tagId);
      }
    } else if (def.rule.type === "manual") {
      if (def.rule.vehicle_ids.includes(vehicleId)) tags.push(tagId);
    }
  }
  return tags;
}
