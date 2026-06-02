// app/admin/activity/admin-activity-list.tsx
"use client";

import { useState } from "react";

import { actionLabel } from "@/lib/admin/activity-format";

export type ActivityEntry = {
  id: string;
  actorEmail: string | null;
  action: string;
  targetLabel: string | null;
  changes: unknown;
  createdAt: string;
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString();
}

function renderChanges(changes: unknown): React.ReactNode {
  if (Array.isArray(changes)) {
    return (
      <ul className="mt-1 space-y-0.5">
        {changes.map((c: { field: string; from: unknown; to: unknown }, i) => (
          <li key={i} className="text-xs text-muted-foreground">
            {c.field}: {String(c.from)} → {String(c.to)}
          </li>
        ))}
      </ul>
    );
  }
  if (changes && typeof changes === "object" && Object.keys(changes).length > 0) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        {Object.entries(changes as Record<string, unknown>)
          .map(([k, v]) => `${k}: ${String(v)}`)
          .join(" · ")}
      </p>
    );
  }
  return null;
}

export function AdminActivityList({ entries }: { entries: ActivityEntry[] }) {
  const [filter, setFilter] = useState("all");
  const actions = Array.from(new Set(entries.map((e) => e.action))).sort();
  const shown = entries.filter((e) => filter === "all" || e.action === filter);

  return (
    <div className="space-y-4">
      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="rounded-md border bg-background px-3 py-2 text-sm"
      >
        <option value="all">All actions</option>
        {actions.map((a) => (
          <option key={a} value={a}>
            {actionLabel(a)}
          </option>
        ))}
      </select>

      <div className="divide-y rounded-lg border">
        {shown.map((e) => (
          <div key={e.id} className="p-3 text-sm">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium">{e.actorEmail ?? "—"}</span>
              <span className="text-muted-foreground">{actionLabel(e.action)}</span>
              {e.targetLabel && <span className="font-medium">{e.targetLabel}</span>}
              <span className="ml-auto text-xs text-muted-foreground">{fmt(e.createdAt)}</span>
            </div>
            {renderChanges(e.changes)}
          </div>
        ))}
        {shown.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No activity.</p>
        )}
      </div>
    </div>
  );
}
