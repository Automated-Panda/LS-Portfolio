"use client";

import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  className?: string;
};

export function CustomTagsInput({ value, onChange, className }: Props) {
  const [draft, setDraft] = useState(value.join(", "));

  const commit = () => {
    const parsed = Array.from(
      new Set(
        draft
          .split(",")
          .map((t) => t.trim().toLowerCase())
          .filter(Boolean),
      ),
    );
    onChange(parsed);
    setDraft(parsed.join(", "));
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <Input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
            (e.target as HTMLInputElement).blur();
          }
        }}
        placeholder="drift, gymkhana, f1-wheels"
      />
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="border-amber-500/40 text-amber-300"
            >
              {t}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
