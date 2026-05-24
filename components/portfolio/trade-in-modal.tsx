"use client";

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
import { tradeInProperty } from "@/app/(app)/properties/actions";

export type TradeInTrigger = {
  group: string;
  currentlyOwned: Array<{ id: string; display_name: string; car_count: number }>;
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
  const [isPending, startTransition] = useTransition();

  if (!trigger) return null;

  const chosen = trigger.currentlyOwned.find((p) => p.id === selected);
  const overCapacity =
    chosen !== undefined && chosen.car_count > trigger.newProperty.capacity;
  const excess = overCapacity ? chosen!.car_count - trigger.newProperty.capacity : 0;

  const handleConfirm = () => {
    if (!chosen) return;
    startTransition(async () => {
      const r = await tradeInProperty({
        newPropertyId: trigger.newProperty.id,
        tradeInOwnedPropertyId: chosen.id,
        carDestinations: [], // empty = server's default move-all-or-unassign
      });
      if ("error" in r) toast.error(r.error);
      else {
        toast.success("Trade-in complete");
        onClose();
      }
    });
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent>
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
          {overCapacity && (
            <p className="text-xs text-amber-400">
              ⚠ New property holds {trigger.newProperty.capacity} cars but{" "}
              {chosen!.display_name} has {chosen!.car_count}.{" "}
              {excess} cars will be unassigned (you&apos;ll re-link them from
              /my-vehicles).
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isPending || !selected}>
            Trade in
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
