// app/admin/activity/admin-activity-list.tsx
"use client";

import { useState } from "react";

import { actionLabel, formatActivityDetail } from "@/lib/admin/activity-format";

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

function renderDetail(action: string, changes: unknown): React.ReactNode {
  const lines = formatActivityDetail(action, changes);
  if (lines.length === 0) return null;
  return (
    <ul className="mt-1 space-y-0.5">
      {lines.map((line, i) => (
        <li key={i} className="text-xs text-muted-foreground">
          {line}
        </li>
      ))}
    </ul>
  );
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
            {renderDetail(e.action, e.changes)}
          </div>
        ))}
        {shown.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No activity.</p>
        )}
      </div>
    </div>
  );
}
