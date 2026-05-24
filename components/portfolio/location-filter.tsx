"use client";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

type Props = {
  properties: Array<{ id: string; display_name: string }>;
  selectedPropertyIds: string[];
  unassignedOnly: boolean;
  onChange: (sel: { properties: string[]; unassignedOnly: boolean }) => void;
};

export function LocationFilter({
  properties, selectedPropertyIds, unassignedOnly, onChange,
}: Props) {
  const togglePid = (id: string) => {
    const next = selectedPropertyIds.includes(id)
      ? selectedPropertyIds.filter((x) => x !== id)
      : [...selectedPropertyIds, id];
    onChange({ properties: next, unassignedOnly });
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          📍 Locations
          {(selectedPropertyIds.length > 0 || unassignedOnly) && (
            <span className="ml-1 rounded bg-primary px-1 text-[10px] text-primary-foreground">
              {selectedPropertyIds.length + (unassignedOnly ? 1 : 0)}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64">
        <label className="flex cursor-pointer items-center gap-2 border-b pb-2">
          <Checkbox
            checked={unassignedOnly}
            onCheckedChange={(c) =>
              onChange({ properties: selectedPropertyIds, unassignedOnly: !!c })
            }
          />
          <span className="text-sm font-medium">Unassigned only</span>
        </label>
        <div className="mt-2 flex max-h-64 flex-col gap-1 overflow-y-auto">
          {properties.map((p) => (
            <label key={p.id} className="flex cursor-pointer items-center gap-2">
              <Checkbox
                checked={selectedPropertyIds.includes(p.id)}
                onCheckedChange={() => togglePid(p.id)}
              />
              <span className="text-sm">{p.display_name}</span>
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
