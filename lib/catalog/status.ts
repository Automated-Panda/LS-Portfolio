// lib/catalog/status.ts
// Pure catalog visibility statuses. Values MUST match the check constraint in
// supabase/migrations/0031_catalog_status.sql.

export type CatalogStatus = "draft" | "published" | "archived";

export const CATALOG_STATUSES: { value: CatalogStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "archived", label: "Archived" },
];

export function isValidCatalogStatus(v: string): boolean {
  return CATALOG_STATUSES.some((s) => s.value === v);
}

export function statusLabel(v: string): string {
  return CATALOG_STATUSES.find((s) => s.value === v)?.label ?? v;
}
