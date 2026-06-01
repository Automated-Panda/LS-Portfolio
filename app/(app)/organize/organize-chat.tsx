"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type {
  Clarification,
  PlanStep,
  PlanSummary,
  TranscriptEntry,
  Turn,
} from "@/lib/organizer/types";
import type { ConversationRow, OrganizerPlan } from "@/lib/queries/organizer";
import type { CreditDisplay } from "@/lib/credits/access";

import { useConfirm } from "@/components/ui/confirm-dialog";

import {
  applyPlan,
  deleteConversation,
  dismissPlan,
  generatePlan,
  parseIntent,
  renameConversation,
} from "./actions";
import { getTranscript } from "./transcript-action";
import { ChecklistProgress } from "./checklist-progress";
import { ClarificationPills } from "./clarification-pills";
import { ConversationRail } from "./conversation-rail";
import { ExamplePills } from "./example-pills";
import { MessageBubble } from "./message-bubble";
import { PlanCard } from "./plan-card";
import { ThinkingBubble } from "./thinking-bubble";
import { UndoBanner } from "./undo-banner";

type Phase =
  | { kind: "idle" }
  | { kind: "thinking" }
  | { kind: "clarifying"; clarification: Clarification; history: Turn[]; originalPrompt: string }
  | { kind: "plan-ready"; planId: string; prompt: string; steps: PlanStep[]; summary: PlanSummary; priorTurns: Turn[] }
  | { kind: "applied"; planId: string; carsMoved: number; undoExpiresAt: string }
  | { kind: "checklist"; planId: string; steps: PlanStep[] }
  | { kind: "failed"; message: string }
  | { kind: "out-of-credits"; needed: number };

type Props = {
  initialConversations: ConversationRow[];
  initialUndoablePlan: OrganizerPlan | null;
  initialBalance: CreditDisplay;
};

export function OrganizeChat({ initialConversations, initialUndoablePlan, initialBalance }: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  // Rail data comes from the server; new/bumped threads surface via router.refresh().
  const conversations = initialConversations;
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [input, setInput] = useState("");
  const [balance, setBalance] = useState<CreditDisplay>(initialBalance);
  const [railOpen, setRailOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [phase, setPhase] = useState<Phase>(() => {
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

  const resetToNew = () => {
    setActiveConversationId(null);
    setTranscript([]);
    setPhase({ kind: "idle" });
    setInput("");
    setRailOpen(false);
  };

  const selectThread = (id: string) => {
    setRailOpen(false);
    startTransition(async () => {
      const entries = await getTranscript(id);
      setActiveConversationId(id);
      setTranscript(entries);
      setPhase({ kind: "idle" });
    });
  };

  const submit = (promptText: string) => {
    // Refinement: a follow-up while a plan is pending refines that same plan.
    const refining = phase.kind === "plan-ready";
    const priorTurns: Turn[] =
      phase.kind === "clarifying"
        ? [
            ...phase.history,
            { role: "assistant", clarification: phase.clarification },
            { role: "user", content: promptText },
          ]
        : phase.kind === "plan-ready"
          ? [...phase.priorTurns, { role: "user", content: promptText }]
          : [];

    const parsePrompt =
      phase.kind === "clarifying" ? phase.originalPrompt : promptText;
    const supersedePlanId = refining && phase.kind === "plan-ready" ? phase.planId : undefined;

    // Push the user's message into the transcript immediately.
    setTranscript((t) => [
      ...t,
      { planId: `tmp-${t.length}`, prompt: promptText, steps: [], summary: emptySummary(), status: "pending" },
    ]);
    setInput("");
    setPhase({ kind: "thinking" });

    startTransition(async () => {
      const parsed = await parseIntent(parsePrompt, priorTurns.length ? priorTurns : undefined);
      if ("error" in parsed) {
        toast.error(parsed.error);
        setPhase({ kind: "idle" });
        return;
      }
      if ("outOfCredits" in parsed) {
        setBalance(parsed.balance);
        setPhase({ kind: "out-of-credits", needed: parsed.needed });
        return;
      }
      setBalance(parsed.balance);
      if (!parsed.ok) {
        setPhase({
          kind: "clarifying",
          clarification: parsed.clarification,
          history: priorTurns,
          originalPrompt: parsePrompt,
        });
        return;
      }

      const planResult = await generatePlan(parsed.intent, parsePrompt, {
        conversationId: activeConversationId ?? undefined,
        supersedePlanId,
      });
      if ("outOfCredits" in planResult) {
        setBalance(planResult.balance);
        setPhase({ kind: "out-of-credits", needed: planResult.needed });
        return;
      }
      setBalance(planResult.balance);
      if (!planResult.ok) {
        setPhase({ kind: "failed", message: planResult.message });
        return;
      }
      setActiveConversationId(planResult.conversationId);
      setTranscript((t) => {
        const next = [...t];
        if (next.length > 0) {
          next[next.length - 1] = {
            planId: planResult.planId,
            prompt: parsePrompt,
            steps: planResult.steps,
            summary: planResult.summary,
            status: "pending",
          };
        }
        return next;
      });
      setPhase({
        kind: "plan-ready",
        planId: planResult.planId,
        prompt: parsePrompt,
        steps: planResult.steps,
        summary: planResult.summary,
        priorTurns,
      });
      router.refresh();
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

  const handleCancel = (planId: string) => {
    startTransition(async () => {
      await dismissPlan(planId);
      setPhase({ kind: "idle" });
      router.refresh();
    });
  };

  const handleRename = (id: string, title: string) => {
    startTransition(async () => {
      const r = await renameConversation(id, title);
      if ("error" in r) toast.error(r.error);
      else router.refresh();
    });
  };

  const handleDelete = async (id: string, title: string) => {
    // Confirm OUTSIDE the transition — awaiting a user-interaction promise
    // inside startTransition breaks the transition scope so the post-confirm
    // updates get dropped. Only the server action goes in the transition.
    const ok = await confirm({
      title: "Delete this plan?",
      description: `"${title}" and its history will be permanently removed.`,
      confirmText: "Delete",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await deleteConversation(id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      if (id === activeConversationId) resetToNew();
      router.refresh();
    });
  };

  // The settled plan that belongs to the latest transcript turn, if any.
  const liveCard =
    phase.kind === "plan-ready"
      ? { steps: phase.steps, summary: phase.summary }
      : null;

  return (
    <div className="flex h-[calc(100vh-3.5rem-3rem)] w-full overflow-hidden rounded-lg border border-[#1f1f1f]">
      {/* RAIL — desktop static, mobile drawer */}
      <aside className="hidden w-60 shrink-0 border-r border-[#1f1f1f] md:block">
        <ConversationRail
          conversations={conversations}
          activeId={activeConversationId}
          onSelect={selectThread}
          onNew={resetToNew}
          onRename={handleRename}
          onDelete={handleDelete}
        />
      </aside>
      {railOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setRailOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-[#1f1f1f]" onClick={(e) => e.stopPropagation()}>
            <ConversationRail
              conversations={conversations}
              activeId={activeConversationId}
              onSelect={selectThread}
              onNew={resetToNew}
              onRename={handleRename}
              onDelete={handleDelete}
            />
          </aside>
        </div>
      )}

      {/* CONVERSATION */}
      <div className="flex flex-1 flex-col bg-[#0a0a0a]">
        {/* header */}
        <div className="flex items-center gap-2 border-b border-[#1f1f1f] px-4 py-3">
          <button type="button" className="text-neutral-300 md:hidden" onClick={() => setRailOpen(true)} aria-label="Open plans">
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <div className="text-sm font-bold text-neutral-100">AI Organizer</div>
            <div className="text-[11px] text-[#84cc16]">
              {phase.kind === "thinking" ? "● Thinking…" : "● Ready"}
            </div>
          </div>
        </div>

        {/* transcript */}
        <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-4">
          {transcript.length === 0 && phase.kind === "idle" && (
            <div className="flex flex-col gap-3">
              <MessageBubble role="assistant">
                Describe how you want your cars laid out — I&apos;ll plan the moves.
              </MessageBubble>
              <ExamplePills onPick={(p) => submit(p)} />
            </div>
          )}

          {transcript.map((entry, idx) => {
            const isLast = idx === transcript.length - 1;
            return (
              <div key={entry.planId} className="flex flex-col gap-3.5">
                <MessageBubble role="user">{entry.prompt}</MessageBubble>
                {/* settled (historical) plans render read-only; the live pending one renders with actions below */}
                {!(isLast && (phase.kind === "thinking" || phase.kind === "plan-ready")) &&
                  entry.steps.length > 0 && (
                    <MessageBubble role="assistant">
                      <PlanCard summary={entry.summary} steps={entry.steps} readOnly />
                    </MessageBubble>
                  )}
              </div>
            );
          })}

          {phase.kind === "thinking" && <ThinkingBubble />}

          {phase.kind === "clarifying" && (
            <MessageBubble role="assistant">
              <p className="mb-2">{phase.clarification.question}</p>
              {phase.clarification.suggestions.length > 0 && (
                <ClarificationPills
                  suggestions={phase.clarification.suggestions}
                  onPick={(s) => submit(s)}
                />
              )}
            </MessageBubble>
          )}

          {phase.kind === "plan-ready" && liveCard && (
            <MessageBubble role="assistant">
              {!balance.unlimited && (
                <p className="mb-1.5 text-[11px] text-neutral-400">
                  ⚡ {balance.total} credit{balance.total === 1 ? "" : "s"} left
                </p>
              )}
              <PlanCard
                summary={liveCard.summary}
                steps={liveCard.steps}
                onApply={() => handleApply(phase.planId, liveCard.summary.cars_moved)}
                onChecklist={() => setPhase({ kind: "checklist", planId: phase.planId, steps: liveCard.steps })}
                onCancel={() => handleCancel(phase.planId)}
                isPending={pending}
              />
            </MessageBubble>
          )}

          {phase.kind === "checklist" && (
            <MessageBubble role="assistant">
              <ChecklistProgress planId={phase.planId} steps={phase.steps} />
            </MessageBubble>
          )}

          {phase.kind === "applied" && (
            <UndoBanner planId={phase.planId} undoExpiresAt={phase.undoExpiresAt} carsMoved={phase.carsMoved} />
          )}

          {phase.kind === "failed" && (
            <MessageBubble role="assistant">
              <p className="mb-2 whitespace-pre-line">{phase.message}</p>
              <Button size="sm" variant="outline" onClick={() => setPhase({ kind: "idle" })}>
                Try a different plan
              </Button>
            </MessageBubble>
          )}

          {phase.kind === "out-of-credits" && (
            <MessageBubble role="assistant">
              <p className="mb-2">You&apos;re out of credits ⚡</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="rounded-full bg-[#84cc16] text-black hover:bg-[#84cc16]/90"
                  onClick={() => router.push("/credits")}
                >
                  Get credits →
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPhase({ kind: "idle" })}>
                  Dismiss
                </Button>
              </div>
            </MessageBubble>
          )}
        </div>

        {/* input */}
        <div className="border-t border-[#1f1f1f] p-3">
          <div className="mb-1.5 flex items-center justify-between px-1 text-[11px] text-neutral-400">
            <span>{balance.unlimited ? "Unlimited ⚡" : `⚡ ${balance.total} credit${balance.total === 1 ? "" : "s"}`}</span>
            {!balance.unlimited && (
              <button
                type="button"
                className="text-[#84cc16] hover:underline"
                onClick={() => router.push("/credits")}
              >
                Get more
              </button>
            )}
          </div>
          <div className="flex gap-2">
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
                  ? "Answer the question…"
                  : phase.kind === "plan-ready"
                    ? "Refine this plan, or apply it…"
                    : "Describe how to organize…"
              }
              disabled={pending || phase.kind === "thinking"}
              className="rounded-full"
            />
            <Button
              onClick={() => input.trim() && submit(input.trim())}
              disabled={!input.trim() || pending || phase.kind === "thinking"}
              className={cn("shrink-0 rounded-full bg-[#84cc16] text-black hover:bg-[#84cc16]/90")}
            >
              ↑
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function emptySummary(): PlanSummary {
  return { total_steps: 0, cars_moved: 0, cars_unassigned: 0, displacements: 0, conflicts: [] };
}
