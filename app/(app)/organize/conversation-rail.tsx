// app/(app)/organize/conversation-rail.tsx
"use client";

import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ConversationRow } from "@/lib/queries/organizer";

type Props = {
  conversations: ConversationRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
};

export function ConversationRail({ conversations, activeId, onSelect, onNew }: Props) {
  return (
    <div className="flex h-full flex-col bg-[#0d0d0d]">
      <div className="p-3">
        <button
          type="button"
          onClick={onNew}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#84cc16] px-3 py-2 text-xs font-bold text-black hover:bg-[#84cc16]/90"
        >
          <Plus className="h-3.5 w-3.5" /> New plan
        </button>
      </div>
      <div className="px-3 pb-1 text-[10px] uppercase tracking-[0.18em] text-neutral-600">
        Recent
      </div>
      <div className="flex-1 overflow-y-auto px-2 pb-2">
        {conversations.length === 0 ? (
          <p className="px-2 py-3 text-xs text-neutral-600">No plans yet.</p>
        ) : (
          conversations.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "mb-0.5 block w-full truncate rounded-md px-2.5 py-2 text-left text-xs",
                c.id === activeId
                  ? "bg-[#1a1a1a] text-neutral-100"
                  : "text-neutral-400 hover:bg-[#161616] hover:text-neutral-200",
              )}
              title={c.title}
            >
              {c.title}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
