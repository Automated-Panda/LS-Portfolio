"use client";

import { cn } from "@/lib/utils";

type Props = {
  suggestions: string[];
  onPick: (suggestion: string) => void;
  className?: string;
};

export function ClarificationPills({ suggestions, onPick, className }: Props) {
  if (suggestions.length === 0) return null;
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {suggestions.map((s) => (
        <button
          key={s}
          type="button"
          onClick={() => onPick(s)}
          className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-300 transition hover:bg-amber-500/20"
        >
          {s}
        </button>
      ))}
    </div>
  );
}
