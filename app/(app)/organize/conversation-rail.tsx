// app/(app)/organize/conversation-rail.tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ConversationRow } from "@/lib/queries/organizer";

type Props = {
  conversations: ConversationRow[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string, title: string) => void;
};

export function ConversationRail({
  conversations, activeId, onSelect, onNew, onRename, onDelete,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.focus();
  }, [editingId]);

  const startEdit = (c: ConversationRow) => {
    setEditingId(c.id);
    setDraft(c.title);
  };

  const commit = () => {
    if (editingId && draft.trim()) onRename(editingId, draft.trim());
    setEditingId(null);
  };

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
          conversations.map((c) =>
            editingId === c.id ? (
              <div
                key={c.id}
                className="mb-0.5 flex items-center gap-1 rounded-md bg-[#1a1a1a] px-1.5 py-1"
              >
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  maxLength={80}
                  className="min-w-0 flex-1 bg-transparent px-1 text-xs text-neutral-100 outline-none"
                />
                <button
                  type="button"
                  onClick={commit}
                  aria-label="Save name"
                  className="shrink-0 rounded p-1 text-[#84cc16] hover:bg-[#262626]"
                >
                  <Check className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  aria-label="Cancel rename"
                  className="shrink-0 rounded p-1 text-neutral-400 hover:bg-[#262626]"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div
                key={c.id}
                className={cn(
                  "group mb-0.5 flex items-center rounded-md",
                  c.id === activeId ? "bg-[#1a1a1a]" : "hover:bg-[#161616]",
                )}
              >
                <button
                  type="button"
                  onClick={() => onSelect(c.id)}
                  className={cn(
                    "min-w-0 flex-1 truncate px-2.5 py-2 text-left text-xs",
                    c.id === activeId ? "text-neutral-100" : "text-neutral-400 group-hover:text-neutral-200",
                  )}
                  title={c.title}
                >
                  {c.title}
                </button>
                <div className="flex shrink-0 items-center pr-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <button
                    type="button"
                    onClick={() => startEdit(c)}
                    aria-label={`Rename ${c.title}`}
                    className="rounded p-1 text-neutral-500 hover:bg-[#262626] hover:text-neutral-200"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(c.id, c.title)}
                    aria-label={`Delete ${c.title}`}
                    className="rounded p-1 text-neutral-500 hover:bg-[#262626] hover:text-red-400"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ),
          )
        )}
      </div>
    </div>
  );
}
