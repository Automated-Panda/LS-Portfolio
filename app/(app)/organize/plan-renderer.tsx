"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlanStep, PlanSummary } from "@/lib/organizer/types";

type Props = {
  summary: PlanSummary;
  steps: PlanStep[];
  onApply: () => void;
  onChecklist: () => void;
  onCancel: () => void;
  isPending: boolean;
};

export function PlanRenderer({
  summary, steps, onApply, onChecklist, onCancel, isPending,
}: Props) {
  return (
    <div className="rounded-md border-l-4 border-emerald-500 bg-card p-3">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Plan</div>
      <p className="mb-2 text-sm font-medium">
        Move {summary.cars_moved} cars
        {summary.displacements > 0 && ` · Displace ${summary.displacements}`}
        {summary.cars_unassigned > 0 && ` · ${summary.cars_unassigned} unassigned`}
      </p>
      {summary.conflicts.length > 0 && (
        <ul className="mb-2 text-xs text-amber-400">
          {summary.conflicts.map((c, i) => <li key={i}>⚠ {c}</li>)}
        </ul>
      )}
      <div className="mb-3 max-h-48 overflow-y-auto font-mono text-xs leading-relaxed text-muted-foreground">
        {steps.slice(0, 8).map((s) => (
          <div key={s.index}>
            <span className={cn(s.reason === "displaced" ? "text-red-400" : "text-emerald-400")}>
              {s.reason === "displaced" ? "🔴 Displace" : "🟢 Move"}
            </span>{" "}
            {s.vehicle_label} · {s.from.label} → {s.to.label}
          </div>
        ))}
        {steps.length > 8 && (
          <div className="text-foreground/40">…{steps.length - 8} more</div>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={onApply} disabled={isPending}>
          ✓ Apply now
        </Button>
        <Button size="sm" variant="outline" onClick={onChecklist} disabled={isPending}>
          ☐ Just give me the checklist
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
