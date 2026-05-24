"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  Clarification,
  PlanStep,
  PlanSummary,
  Turn,
} from "@/lib/organizer/types";
import type { OrganizerPlan, PlanSummaryRow } from "@/lib/queries/organizer";

import {
  applyPlan,
  dismissPlan,
  generatePlan,
  parseIntent,
} from "./actions";
import { ChecklistProgress } from "./checklist-progress";
import { ClarificationPills } from "./clarification-pills";
import { ExamplePills } from "./example-pills";
import { PlanRenderer } from "./plan-renderer";
import { RecentPlansList } from "./recent-plans-list";
import { UndoBanner } from "./undo-banner";

type ChatPhase =
  | { kind: "idle" }                                         // empty input, no plan in flight
  | { kind: "thinking" }                                     // parseIntent or generatePlan running
  | { kind: "clarifying"; clarification: Clarification; history: Turn[]; originalPrompt: string }
  | { kind: "plan-ready"; planId: string; prompt: string; steps: PlanStep[]; summary: PlanSummary }
  | { kind: "applied"; planId: string; carsMoved: number; undoExpiresAt: string }
  | { kind: "checklist"; planId: string; steps: PlanStep[] }
  | { kind: "failed"; message: string };

type Props = {
  initialPlans: PlanSummaryRow[];
  initialUndoablePlan: OrganizerPlan | null;
};

export function OrganizeChat({ initialPlans, initialUndoablePlan }: Props) {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<ChatPhase>(() => {
    if (initialUndoablePlan) {
      const carsMoved = initialUndoablePlan.plan_steps.filter(
        (s) => s.type === "move" && s.reason === "user-asked",
      ).length;
      return {
        kind: "applied",
        planId: initialUndoablePlan.id,
        carsMoved,
        undoExpiresAt: initialUndoablePlan.undo_expires_at!,
      };
    }
    return { kind: "idle" };
  });
  const [pending, startTransition] = useTransition();

  const submit = (promptText: string) => {
    setPhase({ kind: "thinking" });
    setInput("");

    startTransition(async () => {
      const history: Turn[] =
        phase.kind === "clarifying"
          ? [
              ...phase.history,
              { role: "assistant", clarification: phase.clarification },
              { role: "user", content: promptText },
            ]
          : [];

      const parsePrompt =
        phase.kind === "clarifying" ? phase.originalPrompt : promptText;

      const parsed = await parseIntent(parsePrompt, history);
      if ("error" in parsed) {
        toast.error(parsed.error);
        setPhase({ kind: "idle" });
        return;
      }
      if (!parsed.ok) {
        setPhase({
          kind: "clarifying",
          clarification: parsed.clarification,
          history,
          originalPrompt: parsePrompt,
        });
        return;
      }

      const planResult = await generatePlan(parsed.intent, parsePrompt);
      if (!planResult.ok) {
        setPhase({ kind: "failed", message: planResult.message });
        return;
      }
      setPhase({
        kind: "plan-ready",
        planId: planResult.planId,
        prompt: parsePrompt,
        steps: planResult.steps,
        summary: planResult.summary,
      });
    });
  };

  const handleApply = (planId: string, carsMoved: number) => {
    startTransition(async () => {
      const r = await applyPlan(planId);
      if ("ok" in r) {
        setPhase({ kind: "applied", planId, carsMoved, undoExpiresAt: r.undoExpiresAt });
        toast.success("Plan applied.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  const handleChecklist = (planId: string, steps: PlanStep[]) => {
    setPhase({ kind: "checklist", planId, steps });
  };

  const handleCancel = (planId: string) => {
    startTransition(async () => {
      await dismissPlan(planId);
      setPhase({ kind: "idle" });
      router.refresh();
    });
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">Organize</h1>
        <p className="text-sm text-muted-foreground">
          Describe how you want your cars laid out. AI parses your request, the
          planner computes the moves, you choose how to apply.
        </p>
      </div>

      {/* APPLIED state: undo banner pinned at top */}
      {phase.kind === "applied" && (
        <UndoBanner
          planId={phase.planId}
          undoExpiresAt={phase.undoExpiresAt}
          carsMoved={phase.carsMoved}
        />
      )}

      {/* IDLE: example pills */}
      {phase.kind === "idle" && (
        <ExamplePills onPick={(p) => submit(p)} />
      )}

      {/* THINKING */}
      {phase.kind === "thinking" && (
        <div className="rounded-md border bg-card p-4 text-sm text-muted-foreground">
          Thinking...
        </div>
      )}

      {/* CLARIFYING */}
      {phase.kind === "clarifying" && (
        <div className="rounded-md border-l-4 border-amber-500 bg-card p-3">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Question</div>
          <p className="mb-2 text-sm">{phase.clarification.question}</p>
          {phase.clarification.suggestions.length > 0 && (
            <ClarificationPills
              suggestions={phase.clarification.suggestions}
              onPick={(s) => submit(s)}
            />
          )}
        </div>
      )}

      {/* PLAN-READY */}
      {phase.kind === "plan-ready" && (
        <PlanRenderer
          summary={phase.summary}
          steps={phase.steps}
          onApply={() => handleApply(phase.planId, phase.summary.cars_moved)}
          onChecklist={() => handleChecklist(phase.planId, phase.steps)}
          onCancel={() => handleCancel(phase.planId)}
          isPending={pending}
        />
      )}

      {/* CHECKLIST */}
      {phase.kind === "checklist" && (
        <ChecklistProgress planId={phase.planId} steps={phase.steps} />
      )}

      {/* FAILED */}
      {phase.kind === "failed" && (
        <div className="rounded-md border-l-4 border-red-500 bg-card p-3">
          <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">Can&apos;t fit that one</div>
          <p className="text-sm whitespace-pre-line">{phase.message}</p>
          <Button
            size="sm"
            variant="outline"
            className="mt-2"
            onClick={() => setPhase({ kind: "idle" })}
          >
            Try a different plan
          </Button>
        </div>
      )}

      {/* INPUT */}
      <div className="flex gap-2 border-t pt-3">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim()) {
              e.preventDefault();
              submit(input.trim());
            }
          }}
          placeholder={
            phase.kind === "clarifying"
              ? "Answer the question or type a different reply..."
              : "Describe how to organize..."
          }
          disabled={pending || phase.kind === "thinking"}
        />
        <Button
          onClick={() => input.trim() && submit(input.trim())}
          disabled={!input.trim() || pending || phase.kind === "thinking"}
        >
          Send
        </Button>
      </div>

      {/* HISTORY */}
      <RecentPlansList plans={initialPlans} onRerun={(p) => setInput(p)} />
    </div>
  );
}
