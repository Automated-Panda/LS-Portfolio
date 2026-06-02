// lib/admin/activity-format.ts
// Pure formatting for the admin activity log (no I/O).

export type FieldChange = { field: string; from: unknown; to: unknown };

function valuesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((x, i) => x === b[i]);
  }
  return false;
}

/** Diff the listed fields; missing values count as null. Returns only changes. */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: string[],
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const field of fields) {
    const from = before[field] ?? null;
    const to = after[field] ?? null;
    if (!valuesEqual(from, to)) changes.push({ field, from, to });
  }
  return changes;
}

export const ACTION_LABELS: Record<string, string> = {
  "vehicle.update": "edited vehicle",
  "property.update": "edited property",
  "upgrade.update": "edited upgrade",
  "image.upload": "replaced image",
  "image.remove": "removed image",
  "user.credits": "adjusted credits",
  "user.role": "changed role",
  "user.disabled": "set account status",
  "ticket.status": "changed ticket status",
  "ticket.priority": "changed ticket priority",
  "ticket.note": "added ticket note",
};

export function actionLabel(code: string): string {
  return ACTION_LABELS[code] ?? code;
}
