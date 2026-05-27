"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type Props = {
  /** Every distinct custom_tag string the user has on their fleet. */
  tags: string[];
  selectedTags: string[];
  onChange: (next: string[]) => void;
};

/**
 * Multi-select chip filter over the user's custom_tag set. Behaviour mirrors
 * LocationFilter — popover with checkboxes — so it feels native on /my-vehicles.
 *
 * Filter semantics: AND (instance must have ALL selected tags). Renders nothing
 * when the user has no custom tags at all (no filter to offer).
 */
export function CustomTagFilter({ tags, selectedTags, onChange }: Props) {
  if (tags.length === 0) return null;
  const toggle = (tag: string) => {
    onChange(
      selectedTags.includes(tag)
        ? selectedTags.filter((t) => t !== tag)
        : [...selectedTags, tag],
    );
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          🏷️ Tags
          {selectedTags.length > 0 && (
            <span className="ml-1 rounded bg-primary px-1 text-[10px] text-primary-foreground">
              {selectedTags.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56">
        <div className="flex items-center justify-between border-b pb-2">
          <span className="text-xs font-semibold">
            {selectedTags.length > 0
              ? `${selectedTags.length} selected`
              : "Filter by custom tag"}
          </span>
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-[10px] text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          )}
        </div>
        <div className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
          {tags.map((t) => (
            <label key={t} className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={selectedTags.includes(t)}
                onCheckedChange={() => toggle(t)}
              />
              <span className="text-sm">{t}</span>
            </label>
          ))}
        </div>
        {selectedTags.length > 1 && (
          <p className="mt-2 border-t pt-2 text-[10px] text-muted-foreground">
            Matches vehicles that have <strong>all</strong> selected tags.
          </p>
        )}
      </PopoverContent>
    </Popover>
  );
}
