"use client";

import { useState, useTransition, useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { assignVehiclesToSubGarage } from "@/app/(app)/my-vehicles/actions";
import { assetCategoryOf, formatClass, type AssetCategory } from "@/lib/vehicles";

type Props = {
  ownedPropertyId: string;
  assignedUpgradeId: string | null;
  label: string;
  capacity: number;
  currentCount: number;
  /** Restricts the list to vehicles this storage can hold (garage→land, hangar→air, yacht→sea). */
  assetCategory: AssetCategory;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const CATEGORY_NOUN: Record<AssetCategory, string> = {
  land: "cars",
  air: "aircraft",
  sea: "boats",
};

type LightVehicle = {
  id: string;
  display_name: string;
  manufacturer_display: string;
  class: string;
};

export function VehiclePickerModal({
  ownedPropertyId,
  assignedUpgradeId,
  label,
  capacity,
  currentCount,
  assetCategory,
  open,
  onOpenChange,
}: Props) {
  const noun = CATEGORY_NOUN[assetCategory];
  const [vehicles, setVehicles] = useState<LightVehicle[] | null>(null);
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [isPending, startTransition] = useTransition();

  // Fetch vehicles list lazily on open
  if (open && vehicles === null) {
    fetch("/api/vehicles-list")
      .then((r) => r.json() as Promise<LightVehicle[]>)
      .then(setVehicles)
      .catch((err) => toast.error(String(err)));
  }

  const slotsFree = capacity - currentCount;
  const totalSelected = Array.from(counts.values()).reduce((a, b) => a + b, 0);

  const filtered = useMemo(() => {
    if (!vehicles) return [];
    const inCategory = vehicles.filter(
      (v) => assetCategoryOf(formatClass(v.class)) === assetCategory,
    );
    const q = search.toLowerCase();
    return q
      ? inCategory.filter(
          (v) =>
            v.display_name.toLowerCase().includes(q) ||
            v.manufacturer_display.toLowerCase().includes(q),
        )
      : inCategory;
  }, [vehicles, search, assetCategory]);

  const bump = (id: string, delta: number) => {
    setCounts((prev) => {
      const next = new Map(prev);
      const cur = next.get(id) ?? 0;
      const nv = Math.max(0, cur + delta);
      if (nv === 0) next.delete(id);
      else next.set(id, nv);
      return next;
    });
  };

  const handleSave = () => {
    const ids: string[] = [];
    for (const [id, count] of counts) {
      for (let i = 0; i < count; i++) ids.push(id);
    }
    if (ids.length === 0) {
      onOpenChange(false);
      return;
    }
    startTransition(async () => {
      const r = await assignVehiclesToSubGarage({
        ownedPropertyId,
        assignedUpgradeId,
        vehicleIds: ids,
      });
      if ("error" in r) toast.error(r.error);
      else if ("capacityExceeded" in r)
        toast.error(`Over capacity: ${r.capacityExceeded.wouldBeAfter} / ${r.capacityExceeded.capacity}`);
      else {
        toast.success(`Added ${ids.length} ${noun}`);
        setCounts(new Map());
        onOpenChange(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add {noun} to {label}</DialogTitle>
          <DialogDescription>
            {totalSelected} selected · {slotsFree - totalSelected} slots remaining of {capacity}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${noun}...`}
          />
          {vehicles === null ? (
            <p className="text-sm text-muted-foreground">Loading vehicles…</p>
          ) : (
            <div className="grid max-h-96 grid-cols-1 gap-1 overflow-y-auto sm:grid-cols-2 md:grid-cols-3">
              {filtered.slice(0, 200).map((v) => {
                const n = counts.get(v.id) ?? 0;
                return (
                  <div
                    key={v.id}
                    className="flex items-center justify-between rounded-md border p-2"
                  >
                    <div className="min-w-0 flex-1" title={v.display_name}>
                      <p className="text-xs font-medium leading-tight break-words">
                        {v.display_name}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {v.manufacturer_display}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => bump(v.id, -1)}
                        disabled={n === 0}
                        className="h-6 w-6 rounded border text-xs disabled:opacity-30"
                      >
                        −
                      </button>
                      <span className="w-4 text-center text-xs">{n}</span>
                      <button
                        type="button"
                        onClick={() => bump(v.id, +1)}
                        disabled={totalSelected >= slotsFree}
                        className="h-6 w-6 rounded border text-xs disabled:opacity-30"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isPending || totalSelected === 0}>
            Save {totalSelected} {noun}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
