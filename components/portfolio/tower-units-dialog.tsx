"use client";

import { Check, Plus } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { togglePropertyOwnership } from "@/app/(app)/properties/actions";
import type { PropertySummary } from "@/lib/properties";
import { cn } from "@/lib/utils";

import { TradeInModal, type TradeInTrigger } from "./trade-in-modal";

type Props = {
  tower: PropertySummary;
  units: PropertySummary[];
  ownedSet: Set<string>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectionMode?: "browse" | "multi";
  selectedIds?: string[];
  onToggleSelection?: (propertyId: string) => void;
};

export function TowerUnitsDialog({
  tower,
  units,
  ownedSet,
  open,
  onOpenChange,
  selectionMode = "browse",
  selectedIds,
  onToggleSelection,
}: Props) {
  // Local optimistic state mirrors ownedSet — refreshes when revalidation hits.
  const [localOwned, setLocalOwned] = useState<Set<string>>(new Set(ownedSet));
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [tradeInTrigger, setTradeInTrigger] = useState<TradeInTrigger | null>(null);
  const [, startTransition] = useTransition();

  const handleToggle = (unit: PropertySummary) => {
    if (selectionMode === "multi") {
      onToggleSelection?.(unit.id);
      return;
    }
    const wasOwned = localOwned.has(unit.id);
    setLocalOwned((prev) => {
      const next = new Set(prev);
      if (wasOwned) next.delete(unit.id);
      else next.add(unit.id);
      return next;
    });
    setPending((prev) => new Set(prev).add(unit.id));

    startTransition(async () => {
      const result = await togglePropertyOwnership(unit.id);
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(unit.id);
        return next;
      });
      if ("error" in result && result.error) {
        setLocalOwned((prev) => {
          const next = new Set(prev);
          if (wasOwned) next.add(unit.id);
          else next.delete(unit.id);
          return next;
        });
        toast.error(result.error);
      } else if ("needsTradeIn" in result) {
        setLocalOwned((prev) => {
          const next = new Set(prev);
          next.delete(unit.id);
          return next;
        });
        setTradeInTrigger(result.needsTradeIn);
      }
    });
  };

  const ownedCount = units.filter((u) => localOwned.has(u.id)).length;
  const selectedCount = selectionMode === "multi"
    ? units.filter((u) => selectedIds?.includes(u.id)).length
    : 0;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{tower.display_name}</DialogTitle>
            <DialogDescription>
              {tower.neighborhood ?? "Location unknown"} ·{" "}
              {selectionMode === "multi"
                ? `${selectedCount} of ${units.length} selected`
                : `${ownedCount} of ${units.length} owned`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-1 py-2">
            {units.map((u) => {
              const isHighlighted =
                selectionMode === "multi"
                  ? (selectedIds?.includes(u.id) ?? false)
                  : localOwned.has(u.id);
              const isPending = pending.has(u.id);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleToggle(u)}
                  disabled={isPending}
                  className={cn(
                    "flex items-center justify-between rounded-md border p-3 text-left transition-all hover:border-foreground/40",
                    isHighlighted &&
                      "border-emerald-500/70 bg-emerald-500/10 ring-1 ring-emerald-500/30",
                    isPending && "opacity-60",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {/* Show only the unit-specific suffix, e.g. "Apartment 3" not "Eclipse Towers, Apartment 3" */}
                      {u.display_name.startsWith(tower.display_name + ",")
                        ? u.display_name.slice(tower.display_name.length + 1).trim()
                        : u.display_name}
                    </p>
                    {u.max_capacity > 0 && (
                      <p className="text-xs text-muted-foreground">
                        Up to {u.max_capacity} cars
                      </p>
                    )}
                  </div>
                  <div
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full",
                      isHighlighted
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    {isHighlighted ? (
                      <Check className="h-3.5 w-3.5" />
                    ) : (
                      <Plus className="h-3.5 w-3.5" />
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TradeInModal
        trigger={tradeInTrigger}
        onClose={() => setTradeInTrigger(null)}
      />
    </>
  );
}
