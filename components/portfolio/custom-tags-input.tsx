"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Normalize tags to Title Case so they read as "Benny Wheels" not
 * "benny wheels". Word boundaries include spaces, hyphens, and slashes.
 * Mirrors Postgres `initcap()` semantics: first char of each word goes
 * upper, everything else lower.
 */
function titleCaseTag(raw: string): string {
  const cleaned = raw.trim().toLowerCase();
  if (!cleaned) return "";
  return cleaned.replace(/(^|[\s\-/])(\p{L})/gu, (_, sep, ch) =>
    sep + (ch as string).toUpperCase(),
  );
}

type Props = {
  value: string[];
  onChange: (next: string[]) => void;
  /**
   * Pool of existing tags to autocomplete from (typically the union of all
   * custom_tags across the user's fleet). Suggestions exclude tags already
   * present on this instance.
   */
  suggestions?: string[];
  className?: string;
};

export function CustomTagsInput({
  value,
  onChange,
  suggestions = [],
  className,
}: Props) {
  const [draft, setDraft] = useState("");
  const [focused, setFocused] = useState(false);

  const addTag = (raw: string) => {
    const t = titleCaseTag(raw);
    if (!t) {
      setDraft("");
      return;
    }
    // Case-insensitive dedup so "Drift" + "drift" don't both end up stored.
    const tLower = t.toLowerCase();
    if (value.some((existing) => existing.toLowerCase() === tLower)) {
      setDraft("");
      return;
    }
    onChange([...value, t]);
    setDraft("");
  };

  const removeTag = (t: string) => {
    onChange(value.filter((x) => x !== t));
  };

  const filteredSuggestions = useMemo(() => {
    const q = draft.trim().toLowerCase();
    const valueLower = new Set(value.map((v) => v.toLowerCase()));
    return suggestions
      .filter((s) => !valueLower.has(s.toLowerCase()))
      .filter((s) => (q ? s.toLowerCase().includes(q) : true))
      .slice(0, 8);
  }, [suggestions, value, draft]);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="cursor-pointer gap-1 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
              onClick={() => removeTag(t)}
              role="button"
              aria-label={`Remove tag ${t}`}
            >
              {t}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
      <div className="relative">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onFocus={() => setFocused(true)}
          // Delay so a click on a suggestion registers before blur tears the
          // dropdown down. 150ms is enough for any onClick to fire first.
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              addTag(draft);
            } else if (e.key === "Backspace" && !draft && value.length > 0) {
              removeTag(value[value.length - 1]);
            } else if (e.key === "Escape") {
              setDraft("");
              setFocused(false);
            }
          }}
          placeholder={
            value.length === 0
              ? "Drift, Gymkhana, F1 Wheels..."
              : "Add another highlight..."
          }
        />
        {focused && filteredSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
            {filteredSuggestions.map((s) => {
              const display = titleCaseTag(s);
              return (
                <button
                  key={s}
                  type="button"
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addTag(s)}
                >
                  {display}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
