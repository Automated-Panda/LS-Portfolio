// app/(app)/organize/plan-card.tsx
"use client";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { PlanStep, PlanSummary } from "@/lib/organizer/types";

type Props = {
  summary: PlanSummary;
  steps: PlanStep[];
  onApply?: () => void;
  onChecklist?: () => void;
  onCancel?: () => void;
  isPending?: boolean;
  /** Read-only: rendered from history, no action buttons. */
  readOnly?: boolean;
};

export function PlanCard({
  summary, steps, onApply, onChecklist, onCancel, isPending, readOnly,
}: Props) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-neutral-100">
        Move {summary.cars_moved} cars
        {summary.displacements > 0 && ` · Displace ${summary.displacements}`}
        {summary.cars_unassigned > 0 && ` · ${summary.cars_unassigned} unassigned`}
      </p>
      {summary.conflicts.length > 0 && (
        <ul className="mb-2 text-xs text-amber-400">
          {summary.conflicts.map((c, i) => <li key={i}>⚠ {c}</li>)}
        </ul>
      )}
      <div className="mb-3 max-h-64 overflow-y-auto font-mono text-xs leading-relaxed text-neutral-400">
        {steps.map((s) => (
          <div key={s.index}>
            <span className={cn(s.reason === "displaced" ? "text-red-400" : "text-emerald-400")}>
              {s.reason === "displaced" ? "🔴 Displace" : "🟢 Move"}
            </span>{" "}
            {s.vehicle_label} · {s.from.label} → {s.to.label}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            className="bg-[#84cc16] text-black hover:bg-[#84cc16]/90"
            onClick={onApply}
            disabled={isPending}
          >
            ✓ Apply now
          </Button>
          <Button size="sm" variant="outline" onClick={onChecklist} disabled={isPending}>
            ☐ Just give me the checklist
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
