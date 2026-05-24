"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

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
    const t = raw.trim().toLowerCase();
    if (!t || value.includes(t)) {
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
    return suggestions
      .filter((s) => !value.includes(s))
      .filter((s) => (q ? s.includes(q) : true))
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
              ? "drift, gymkhana, f1-wheels..."
              : "Add another tag..."
          }
        />
        {focused && filteredSuggestions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
            {filteredSuggestions.map((s) => (
              <button
                key={s}
                type="button"
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-muted"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => addTag(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
