"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";
import type { PlanSummaryRow } from "@/lib/queries/organizer";

type Props = {
  plans: PlanSummaryRow[];
  onRerun: (prompt: string) => void;
};

export function RecentPlansList({ plans, onRerun }: Props) {
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (plans.length === 0) return null;

  return (
    <div className="rounded-md border bg-card">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium"
      >
        <span>Recent plans ({plans.length})</span>
        <span className="text-muted-foreground">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div className="border-t">
          {plans.map((p) => (
            <div key={p.id} className="border-b last:border-b-0">
              <div className="flex items-center justify-between gap-2 px-3 py-2 text-xs">
                <div className="min-w-0 flex-1">
                  <p className="truncate">{p.prompt}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(p.created_at).toLocaleString()} ·{" "}
                    <span className={cn(
                      p.status === "applied" && "text-emerald-400",
                      p.status === "checklist" && "text-amber-400",
                      p.status === "completed" && "text-emerald-400",
                      p.status === "dismissed" && "text-muted-foreground",
                      p.status === "undone" && "text-muted-foreground",
                    )}>
                      {p.status === "applied" && `Applied (${p.step_count} steps)`}
                      {p.status === "checklist" && `Checklist ${p.completed_count}/${p.step_count}`}
                      {p.status === "completed" && `Completed (${p.step_count} steps)`}
                      {p.status === "dismissed" && "Dismissed"}
                      {p.status === "undone" && "Undone"}
                      {p.status === "pending" && "Pending"}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRerun(p.prompt)}
                  className="rounded border border-border px-2 py-0.5 text-[10px] hover:border-foreground/40"
                >
                  Re-run
                </button>
                <button
                  type="button"
                  onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                  className="rounded border border-border px-2 py-0.5 text-[10px] hover:border-foreground/40"
                >
                  {expandedId === p.id ? "Hide" : "View"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
