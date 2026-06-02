// lib/admin/pagination.ts
// Pure pagination math shared by the admin tables (no React, unit-tested).

export function pageBounds(
  total: number,
  page: number,
  pageSize: number,
): { totalPages: number; safePage: number; start: number; end: number } {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * pageSize;
  return { totalPages, safePage, start, end: start + pageSize };
}
