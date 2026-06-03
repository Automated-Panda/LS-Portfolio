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

const FIELD_LABELS: Record<string, string> = {
  display_name: "Name",
  price: "Price",
  capacity: "Capacity",
  availability: "Availability",
  vendors: "Vendors",
  counts_as_garage: "Counts as garage",
  subtype_display: "Subtype",
  neighborhood: "Neighborhood",
  status: "Status",
};

function humanizeField(field: string): string {
  return FIELD_LABELS[field] ?? field.replace(/_/g, " ");
}

/** Human-readable value for a change: prices get $, booleans Yes/No, null an em dash. */
export function formatValue(field: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  if (field === "price" && typeof value === "number") {
    return `$${value.toLocaleString("en-US")}`;
  }
  return String(value);
}

/**
 * Turn a logged action + its `changes` payload into human-readable detail
 * lines for the activity log. Falls back gracefully on unknown shapes so an
 * older/odd row never renders blank or as "[object Object]".
 */
export function formatActivityDetail(action: string, changes: unknown): string[] {
  if (!changes || typeof changes !== "object") return [];

  // Content edits store an array of field changes (display_name, price, …).
  if (Array.isArray(changes)) {
    return (changes as FieldChange[]).map(
      (c) => `${humanizeField(c.field)}: ${formatValue(c.field, c.from)} → ${formatValue(c.field, c.to)}`,
    );
  }

  const c = changes as Record<string, unknown>;
  switch (action) {
    case "user.credits": {
      const delta = Number(c.delta ?? 0);
      const sign = delta >= 0 ? "+" : "";
      const head =
        c.newTotal !== undefined && c.newTotal !== null
          ? `${sign}${delta} credits (new balance ${Number(c.newTotal).toLocaleString("en-US")})`
          : `${sign}${delta} credits`;
      return c.note ? [head, `Note: ${c.note}`] : [head];
    }
    case "user.role":
    case "ticket.status":
    case "ticket.priority":
      return [`${formatValue("", c.from)} → ${formatValue("", c.to)}`];
    case "user.disabled":
      return [c.to ? "Account disabled" : "Account re-enabled"];
    case "ticket.note":
      return c.note ? [`“${String(c.note)}”`] : [];
    default:
      return Object.entries(c).map(([k, v]) => `${humanizeField(k)}: ${formatValue(k, v)}`);
  }
}
