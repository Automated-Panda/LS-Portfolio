"use client";

import { cn } from "@/lib/utils";

const EXAMPLE_PROMPTS = [
  "Put my drift cars in Mission Row",
  "Move all Pegassi cars to Eclipse Towers, Apt 30",
  "Put weaponized cars in my facility, drift cars in Mission Row",
  "Consolidate my supers in one place",
];

type Props = {
  onPick: (prompt: string) => void;
  className?: string;
};

export function ExamplePills({ onPick, className }: Props) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {EXAMPLE_PROMPTS.map((p) => (
        <button
          key={p}
          type="button"
          onClick={() => onPick(p)}
          className="rounded-full border border-border bg-card px-3 py-1.5 text-xs text-muted-foreground transition hover:border-foreground/40 hover:text-foreground"
        >
          {p}
        </button>
      ))}
    </div>
  );
}
