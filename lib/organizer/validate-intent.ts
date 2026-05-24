// lib/organizer/validate-intent.ts
// LLM can hallucinate ids. Validate every property_id, upgrade_id, and tag
// against the user's actual data before handing the intent to the planner.

import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import type { ParsedIntent } from "./types";

export type ValidationOk = { ok: true };
export type ValidationFail = { ok: false; reason: string };

export function validateIntent(
  intent: ParsedIntent,
  ownedProperties: OwnedPropertyDetail[],
  systemTagIds: Set<string>,
  manufacturerIds: Set<string>,
  classNames: Set<string>,
): ValidationOk | ValidationFail {
  const propertyIds = new Set(ownedProperties.map((p) => p.id));
  const upgradeIdsByProperty = new Map<string, Set<string>>();
  for (const p of ownedProperties) {
    upgradeIdsByProperty.set(
      p.id,
      new Set(p.upgrades.filter((u) => u.is_installed).map((u) => u.id)),
    );
  }

  if (intent.criteria.length === 0) {
    return { ok: false, reason: "Intent has no criteria." };
  }

  for (const c of intent.criteria) {
    if (!propertyIds.has(c.target.property_id)) {
      return {
        ok: false,
        reason: `Property ${c.target.property_id} is not owned by this user.`,
      };
    }
    if (c.target.upgrade_id) {
      const installed = upgradeIdsByProperty.get(c.target.property_id);
      if (!installed || !installed.has(c.target.upgrade_id)) {
        return {
          ok: false,
          reason: `Upgrade ${c.target.upgrade_id} is not installed on the target property.`,
        };
      }
    }

    for (const t of c.filter.tags ?? []) {
      if (!systemTagIds.has(t)) {
        return { ok: false, reason: `Unknown system tag: ${t}` };
      }
    }
    for (const cls of c.filter.classes ?? []) {
      if (!classNames.has(cls)) {
        return { ok: false, reason: `Unknown vehicle class: ${cls}` };
      }
    }
    for (const m of c.filter.manufacturers ?? []) {
      if (!manufacturerIds.has(m)) {
        return { ok: false, reason: `Unknown manufacturer id: ${m}` };
      }
    }
    // custom_tags can be anything — they're user-defined free text. No check.
  }

  return { ok: true };
}
