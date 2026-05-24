"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
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
import { tradeInProperty } from "@/app/(app)/properties/actions";

export type TradeInTrigger = {
  group: string;
  currentlyOwned: Array<{
    id: string;
    display_name: string;
    car_count: number;
    cars: Array<{ ownedVehicleId: string; label: string }>;
  }>;
  newProperty: { id: string; display_name: string; capacity: number };
};

type Props = {
  trigger: TradeInTrigger | null;
  onClose: () => void;
};

export function TradeInModal({ trigger, onClose }: Props) {
  const [selected, setSelected] = useState<string | null>(
    trigger?.currentlyOwned[0]?.id ?? null,
  );
  // Set of ownedVehicleIds the user wants to MOVE to the new property.
  // Excluded cars go to unassigned. Re-initialized whenever the chosen
  // property or its over-capacity state changes.
  const [movingCarIds, setMovingCarIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const chosen = trigger?.currentlyOwned.find((p) => p.id === selected) ?? null;
  const capacity = trigger?.newProperty.capacity ?? 0;
  const overCapacity = chosen ? chosen.car_count > capacity : false;

  // Auto-populate movingCarIds when the chosen property changes:
  // - Under-cap: all cars move (every car id ticked)
  // - Over-cap: first N cars pre-checked, rest unassigned
  useEffect(() => {
    if (!chosen) {
      setMovingCarIds(new Set());
      return;
    }
    const ids = chosen.cars.slice(0, capacity).map((c) => c.ownedVehicleId);
    setMovingCarIds(new Set(ids));
    // We re-initialize ONLY when the user picks a different property or the
    // capacity of the new property changes — not when the user manually
    // toggles individual cars, hence the narrow deps.
  }, [chosen?.id, capacity]);

  const movingCount = movingCarIds.size;
  const unassignedCount = chosen ? chosen.car_count - movingCount : 0;
  const tooManySelected = movingCount > capacity;

  const handleConfirm = () => {
    if (!chosen) return;
    const destinations = chosen.cars.map((c) => ({
      ownedVehicleId: c.ownedVehicleId,
      action: movingCarIds.has(c.ownedVehicleId)
        ? ("move" as const)
        : ("unassign" as const),
    }));
    startTransition(async () => {
      const r = await tradeInProperty({
        newPropertyId: trigger!.newProperty.id,
        tradeInOwnedPropertyId: chosen.id,
        carDestinations: destinations,
      });
      if ("error" in r) toast.error(r.error);
      else {
        toast.success(
          unassignedCount > 0
            ? `Trade-in complete · ${movingCount} moved, ${unassignedCount} unassigned`
            : "Trade-in complete",
        );
        onClose();
      }
    });
  };

  const toggleCar = (carId: string) => {
    setMovingCarIds((prev) => {
      const next = new Set(prev);
      if (next.has(carId)) next.delete(carId);
      else next.add(carId);
      return next;
    });
  };

  // Sorted list of cars with checked state, used in the over-capacity grid.
  const carRows = useMemo(
    () =>
      (chosen?.cars ?? []).map((c) => ({
        ...c,
        moving: movingCarIds.has(c.ownedVehicleId),
      })),
    [chosen, movingCarIds],
  );

  if (!trigger) return null;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            You&apos;re at your {trigger.group.replace(/-/g, " ")} limit
          </DialogTitle>
          <DialogDescription>
            To get <strong>{trigger.newProperty.display_name}</strong>, trade in
            one of your existing properties.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-2 py-2">
          {trigger.currentlyOwned.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-3 rounded-md border p-3"
              style={{ borderColor: selected === p.id ? "hsl(48 96% 53%)" : undefined }}
            >
              <input
                type="radio"
                name="tradein"
                checked={selected === p.id}
                onChange={() => setSelected(p.id)}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{p.display_name}</p>
                <p className="text-xs text-muted-foreground">
                  {p.car_count} cars stored
                </p>
              </div>
            </label>
          ))}
        </div>

        {overCapacity && chosen && (
          <div className="flex flex-col gap-2 border-t pt-3">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-medium">
                Pick which {capacity} cars come along
              </p>
              <p
                className="text-xs"
                style={{
                  color: tooManySelected ? "hsl(0 70% 60%)" : "hsl(48 96% 53%)",
                }}
              >
                {movingCount} / {capacity} selected · {unassignedCount} will be unassigned
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              Unassigned cars stay in your portfolio — re-link them later from /my-vehicles.
            </p>
            <div className="max-h-64 overflow-y-auto rounded-md border">
              {carRows.map((c) => (
                <label
                  key={c.ownedVehicleId}
                  className="flex cursor-pointer items-center gap-2 border-b px-3 py-2 last:border-b-0 hover:bg-muted/30"
                >
                  <input
                    type="checkbox"
                    checked={c.moving}
                    onChange={() => toggleCar(c.ownedVehicleId)}
                  />
                  <span className="text-sm">{c.label}</span>
                  {!c.moving && (
                    <span className="ml-auto text-[10px] uppercase text-amber-400">
                      Unassign
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || !selected || tooManySelected}
          >
            Trade in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
