"use client";

import { cn } from "@/lib/utils";

// Examples reference real catalog property names so they don't look broken
// (and resolve directly when the user happens to own them). Generic type refs
// like "my facility" are fine — the organizer resolves them to the owned one.
const EXAMPLE_PROMPTS = [
  "Move all Pegassi cars to Eclipse Towers, Apartment 31",
  "Put my drift cars in the Mission Row Auto Shop",
  "Put my weaponized cars in my facility, sports cars in Eclipse Towers",
  "Consolidate my supers in the Eclipse Boulevard Garages",
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
