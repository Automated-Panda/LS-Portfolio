// lib/organizer/portfolio-context.ts
// Builds the per-user portfolio taxonomy text block that gets injected into
// the Claude system prompt. This block is cached (cache_control marker
// applied in intent-parser.ts) — it only invalidates when the user adds/
// removes a vehicle, property, or upgrade.

import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import { bayPropertyLabel, isBayBound } from "@/lib/bays";

export type PortfolioContextInput = {
  vehicles: OwnedVehicleInstance[];
  properties: OwnedPropertyDetail[];
  systemTags: Array<{ id: string; display: string }>;
  manufacturers: Array<{ id: string; display: string }>;
};

export function buildPortfolioContext(input: PortfolioContextInput): string {
  const lines: string[] = [];

  lines.push("--- USER PORTFOLIO ---");
  lines.push("");

  // System tags
  lines.push(
    `System tags (use these ids in filter.tags): ${input.systemTags
      .map((t) => t.id)
      .join(", ")}`,
  );

  // Custom tags (union across user's fleet)
  const customTags = Array.from(
    new Set(input.vehicles.flatMap((v) => v.custom_tags)),
  ).sort();
  if (customTags.length > 0) {
    lines.push(
      `Custom tags (user-defined, use these strings in filter.custom_tags): ${customTags.join(", ")}`,
    );
  }

  // Manufacturers (id → display)
  lines.push(
    `Manufacturer ids (use these in filter.manufacturers): ${input.manufacturers
      .map((m) => `${m.id}=${m.display}`)
      .join(", ")}`,
  );

  // Vehicle classes
  const classes = Array.from(new Set(input.vehicles.map((v) => v.class))).sort();
  lines.push(
    `Classes (use these names in filter.classes): ${classes.join(", ")}`,
  );

  lines.push(
    'Favourites: vehicles marked with a ★ below are the user\'s favourites. To target them, set filter.favourites = true.',
  );

  lines.push(
    'Bay-bound: vehicles marked "⚠ bay-bound (X)" below live ONLY in their dedicated bay in an X (a Facility or Arena Workshop). NEVER move or target them to a normal garage — leave them where they are.',
  );

  lines.push("");
  lines.push(`Vehicles (${input.vehicles.length} owned instances):`);
  for (const v of input.vehicles) {
    const tagStr = v.tag_ids.length > 0 ? `[${v.tag_ids.join(", ")}]` : "[]";
    const customStr =
      v.custom_tags.length > 0 ? ` custom:[${v.custom_tags.join(", ")}]` : "";
    const favStr = v.is_favourite ? " ★" : "";
    const bayStr = isBayBound(v.vehicle_id)
      ? ` ⚠ bay-bound (${bayPropertyLabel(v.vehicle_id)})`
      : "";
    const storage = v.storage
      ? `${v.storage.property_display_name}${v.storage.upgrade_display_name ? ` · ${v.storage.upgrade_display_name}` : ""}`
      : "unassigned";
    const name = v.nickname ? `${v.display_name} ("${v.nickname}")` : v.display_name;
    lines.push(
      `  [${v.id}] ${name}${favStr}${bayStr} (${v.manufacturer_display} · ${v.class}) ${tagStr}${customStr} @ ${storage}`,
    );
  }

  lines.push("");
  lines.push(`Properties (${input.properties.length} owned):`);
  for (const p of input.properties) {
    const installedUpgrades = p.upgrades.filter((u) => u.is_installed && u.capacity > 0);
    const totalCap =
      p.base_capacity +
      installedUpgrades.reduce((sum, u) => sum + u.capacity, 0);
    lines.push(
      `  [${p.id}] ${p.display_name}${p.neighborhood ? ` (${p.neighborhood})` : ""} · ${totalCap} cap total`,
    );
    if (p.base_capacity > 0 && installedUpgrades.length === 0) {
      lines.push(`    base storage · ${p.base_capacity} slots`);
    }
    for (const u of installedUpgrades) {
      lines.push(`    [${u.id}] ${u.display_name} · ${u.capacity} slots`);
    }
  }

  return lines.join("\n");
}
