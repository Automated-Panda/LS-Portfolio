"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/** A storage location the user can filter by — a property, plus the occupied
 * levels (storage upgrade / sub-slot) within it when its cars span several. */
export type LocationOption = {
  propertyId: string;
  propertyName: string;
  count: number;
  /** key is the filter token (e.g. "lvl:<pid>::<upgrade>::<subslot>"). */
  levels: Array<{ key: string; label: string; count: number }>;
};

type Props = {
  locations: LocationOption[];
  /** Selected filter tokens — a mix of "prop:<id>" and level keys. */
  selected: string[];
  unassignedOnly: boolean;
  onChange: (sel: { selected: string[]; unassignedOnly: boolean }) => void;
};

export function LocationFilter({
  locations,
  selected,
  unassignedOnly,
  onChange,
}: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    const next = selected.includes(key)
      ? selected.filter((k) => k !== key)
      : [...selected, key];
    onChange({ selected: next, unassignedOnly });
  };

  const toggleExpand = (pid: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid);
      else next.add(pid);
      return next;
    });
  };

  const activeCount = selected.length + (unassignedOnly ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          📍 Locations
          {activeCount > 0 && (
            <span className="ml-1 rounded bg-primary px-1 text-[10px] text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <label className="flex cursor-pointer items-center gap-2 border-b pb-2">
          <Checkbox
            checked={unassignedOnly}
            onCheckedChange={(c) => onChange({ selected, unassignedOnly: !!c })}
          />
          <span className="text-sm font-medium">Unassigned only</span>
        </label>
        <div className="mt-2 flex max-h-72 flex-col gap-0.5 overflow-y-auto">
          {locations.length === 0 && (
            <p className="px-1 py-2 text-xs text-muted-foreground">
              No storage locations yet.
            </p>
          )}
          {locations.map((loc) => {
            const propKey = `prop:${loc.propertyId}`;
            const hasLevels = loc.levels.length > 0;
            const isOpen = expanded.has(loc.propertyId);
            return (
              <div key={loc.propertyId}>
                <div className="flex items-center gap-1">
                  {hasLevels ? (
                    <button
                      type="button"
                      onClick={() => toggleExpand(loc.propertyId)}
                      className="flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label={isOpen ? "Collapse levels" : "Expand levels"}
                    >
                      <ChevronRight
                        className={cn(
                          "h-3.5 w-3.5 transition-transform",
                          isOpen && "rotate-90",
                        )}
                      />
                    </button>
                  ) : (
                    <span className="w-5" />
                  )}
                  <label className="flex flex-1 cursor-pointer items-center gap-2 py-0.5">
                    <Checkbox
                      checked={selected.includes(propKey)}
                      onCheckedChange={() => toggle(propKey)}
                    />
                    <span className="text-sm">{loc.propertyName}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      {loc.count}
                    </span>
                  </label>
                </div>
                {hasLevels && isOpen && (
                  <div className="ml-6 flex flex-col gap-0.5">
                    {loc.levels.map((lvl) => (
                      <label
                        key={lvl.key}
                        className="flex cursor-pointer items-center gap-2 py-0.5"
                      >
                        <Checkbox
                          checked={selected.includes(lvl.key)}
                          onCheckedChange={() => toggle(lvl.key)}
                        />
                        <span className="text-xs">{lvl.label}</span>
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {lvl.count}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
