// app/admin/admin-pager.tsx
"use client";

import { useState } from "react";

import { pageBounds } from "@/lib/admin/pagination";

/**
 * Client pagination over an already-loaded list. Resets to page 1 when
 * `resetKey` changes (e.g. the search query). The page is clamped, so a list
 * that shrinks below the current page snaps back into range.
 */
export function usePagination<T>(items: T[], pageSize: number, resetKey?: unknown) {
  const [page, setPage] = useState(0);
  const [lastKey, setLastKey] = useState(resetKey);
  if (resetKey !== lastKey) {
    setLastKey(resetKey);
    if (page !== 0) setPage(0);
  }
  const { totalPages, safePage, start, end } = pageBounds(items.length, page, pageSize);
  return { page: safePage, setPage, totalPages, pageItems: items.slice(start, end) };
}

export function AdminPager({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-end gap-2 text-xs">
      <button
        type="button"
        disabled={page <= 0}
        onClick={() => onPage(page - 1)}
        className="rounded border px-2 py-1 transition-colors hover:bg-accent/30 disabled:opacity-40"
      >
        ‹ Prev
      </button>
      <span className="text-muted-foreground">
        Page {page + 1} / {totalPages}
      </span>
      <button
        type="button"
        disabled={page >= totalPages - 1}
        onClick={() => onPage(page + 1)}
        className="rounded border px-2 py-1 transition-colors hover:bg-accent/30 disabled:opacity-40"
      >
        Next ›
      </button>
    </div>
  );
}
