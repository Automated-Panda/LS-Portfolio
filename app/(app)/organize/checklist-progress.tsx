"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";

import { cn } from "@/lib/utils";
import {
  markStepComplete,
  markStepIncomplete,
} from "./actions";
import type { PlanStep } from "@/lib/organizer/types";

type Props = {
  planId: string;
  steps: PlanStep[];
};

export function ChecklistProgress({ planId, steps: initialSteps }: Props) {
  const [steps, setSteps] = useState(initialSteps);
  const [pending, startTransition] = useTransition();

  const completed = steps.filter((s) => s.completed_at !== null).length;
  const percent = steps.length === 0 ? 0 : (completed / steps.length) * 100;

  const toggle = (idx: number) => {
    const step = steps[idx];
    const willComplete = step.completed_at === null;
    // Optimistic flip
    setSteps((prev) =>
      prev.map((s, i) =>
        i === idx
          ? { ...s, completed_at: willComplete ? new Date().toISOString() : null }
          : s,
      ),
    );
    startTransition(async () => {
      const r = willComplete
        ? await markStepComplete(planId, idx)
        : await markStepIncomplete(planId, idx);
      if ("error" in r) {
        toast.error(r.error);
        setSteps(initialSteps);
      } else if (willComplete && r.allComplete) {
        toast.success("All steps complete!");
      }
    });
  };

  return (
    <div className="rounded-md border bg-card p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium">
          {completed} / {steps.length} complete
        </p>
        <div className="ml-3 h-1 flex-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full bg-amber-400 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {steps.map((s) => {
          const done = s.completed_at !== null;
          return (
            <label
              key={s.index}
              className={cn(
                "flex cursor-pointer items-center gap-2 text-sm",
                done && "text-muted-foreground line-through",
              )}
            >
              <input
                type="checkbox"
                checked={done}
                onChange={() => toggle(s.index)}
                disabled={pending}
              />
              <span>
                <span className={cn("font-medium", s.reason === "displaced" ? "text-red-400" : "text-emerald-400")}>
                  {s.type === "unassign"
                    ? "Unassign"
                    : s.reason === "displaced"
                      ? "Displace"
                      : "Move"}
                </span>{" "}
                {s.vehicle_label} · {s.from.label} → {s.to.label}
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Each tick updates your portfolio. No DB change happens until you tick.
      </p>
    </div>
  );
}
