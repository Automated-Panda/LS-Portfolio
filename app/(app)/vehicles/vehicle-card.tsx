"use client";

import { Check, Minus, Plus } from "lucide-react";
import Image from "next/image";
import { memo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatMoneyCompact, formatMoneyFull } from "@/lib/format";
import type { VehicleSummary } from "@/lib/vehicles";
import { cn } from "@/lib/utils";

import {
  addVehicleInstance,
  getOwnedInstancesForVehicle,
  removeOwnedInstance,
  type InstanceForPicker,
} from "./actions";

type Props = {
  vehicle: VehicleSummary;
  imageUrl: string | null;
  tagLookup: Record<string, string>;
};

function VehicleCardImpl({ vehicle, imageUrl, tagLookup }: Props) {
  const [optimisticCount, setOptimisticCount] = useState(vehicle.owned_count);
  const [isPending, startTransition] = useTransition();
  const [driftCount, setDriftCount] = useState(
    vehicle.drift_variant?.owned ? 1 : 0,
  );
  const [driftPending, startDriftTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerInstances, setPickerInstances] = useState<
    InstanceForPicker[] | null
  >(null);
  const [pickerLoading, setPickerLoading] = useState(false);

  const handleAdd = () => {
    setOptimisticCount(optimisticCount + 1);
    startTransition(async () => {
      const result = await addVehicleInstance(vehicle.id);
      if (result.error) {
        setOptimisticCount(optimisticCount);
        toast.error(result.error);
      } else {
        toast.success(`Added ${vehicle.display_name}`);
      }
    });
  };

  const handleDriftAdd = (e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation();
    if (!vehicle.drift_variant) return;
    setDriftCount(driftCount + 1);
    startDriftTransition(async () => {
      const result = await addVehicleInstance(vehicle.drift_variant!.id);
      if (result.error) {
        setDriftCount(driftCount);
        toast.error(result.error);
      } else {
        toast.success(`Added Drift ${vehicle.display_name}`);
      }
    });
  };

  const openPicker = async () => {
    setPickerOpen(true);
    if (pickerInstances) return; // already loaded — refresh on next open
    setPickerLoading(true);
    const r = await getOwnedInstancesForVehicle(vehicle.id);
    setPickerLoading(false);
    if ("error" in r) {
      toast.error(r.error);
      setPickerOpen(false);
      return;
    }
    setPickerInstances(r);
  };

  const handleRemoveInstance = (instanceId: string, label: string) => {
    setOptimisticCount(Math.max(0, optimisticCount - 1));
    setPickerInstances((prev) =>
      prev ? prev.filter((i) => i.id !== instanceId) : prev,
    );
    startTransition(async () => {
      const r = await removeOwnedInstance(instanceId);
      if ("error" in r) {
        // restore optimistic state
        setOptimisticCount(optimisticCount);
        setPickerInstances(null); // force refetch next open
        toast.error(r.error);
      } else {
        toast.success(`Removed ${label}`);
      }
    });
  };

  const owned = optimisticCount > 0;

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-all hover:border-foreground/40",
        owned && "border-emerald-500/70 ring-2 ring-emerald-500/30",
        isPending && "opacity-80",
      )}
    >
      {/* Owned-count chip (top-right). When owned > 0 it becomes a popover
          trigger that opens the remove-instance picker. */}
      {owned ? (
        <Popover
          open={pickerOpen}
          onOpenChange={(o) => {
            setPickerOpen(o);
            if (o) void openPicker();
          }}
        >
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Manage ${optimisticCount} owned ${vehicle.display_name}`}
              className="absolute right-2 top-2 z-10 flex h-7 min-w-7 items-center justify-center gap-1 rounded-full bg-emerald-500 px-2 text-white transition-all hover:bg-emerald-600"
            >
              <Check className="h-4 w-4" />
              <span className="text-xs font-semibold">×{optimisticCount}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="end">
            <div className="flex items-center justify-between gap-2 px-2 pb-2 border-b">
              <p className="text-xs font-semibold">
                {vehicle.display_name} ({optimisticCount})
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleAdd();
                }}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent/30 disabled:opacity-50"
                aria-label={`Add another ${vehicle.display_name}`}
              >
                <Plus className="h-3 w-3" /> Add
              </button>
            </div>
            {pickerLoading ? (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                Loading…
              </p>
            ) : pickerInstances && pickerInstances.length > 0 ? (
              <ul className="flex max-h-64 flex-col overflow-y-auto py-1">
                {pickerInstances.map((inst, i) => {
                  const label = inst.nickname || `#${i + 1}`;
                  return (
                    <li key={inst.id} className="flex items-center gap-2 px-2 py-1.5 text-sm hover:bg-muted/40 rounded-md">
                      <span className="flex-1 min-w-0">
                        <span className="block truncate">{label}</span>
                        {inst.storage_label && (
                          <span className="block text-[10px] text-muted-foreground truncate">
                            📍 {inst.storage_label}
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveInstance(inst.id, label);
                        }}
                        disabled={isPending}
                        className="rounded-md p-1 text-muted-foreground hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                        aria-label={`Remove ${label}`}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="px-2 py-3 text-xs text-muted-foreground">
                No instances found.
              </p>
            )}
          </PopoverContent>
        </Popover>
      ) : (
        <span
          className="absolute right-2 top-2 z-10 flex h-7 min-w-7 items-center justify-center gap-1 rounded-full bg-background/80 px-2 text-muted-foreground opacity-0 transition-all group-hover:opacity-100"
          aria-hidden
        >
          <Plus className="h-4 w-4" />
        </span>
      )}

      <button
        type="button"
        onClick={handleAdd}
        disabled={isPending}
        className="flex flex-1 flex-col text-left"
        aria-label={`Add ${vehicle.display_name} to portfolio`}
      >
        <div className="relative aspect-video w-full bg-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={vehicle.display_name}
              fill
              sizes="(min-width: 1536px) 16vw, (min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
              className="object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No image
            </div>
          )}
          <span className="absolute left-2 top-2 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur-sm">
            {vehicle.class}
          </span>
          {vehicle.price !== null && (
            <span
              className="absolute bottom-2 left-2 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-emerald-300 backdrop-blur-sm"
              title={formatMoneyFull(vehicle.price)}
            >
              {formatMoneyCompact(vehicle.price)}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div>
            <p className="text-sm font-medium leading-tight">{vehicle.display_name}</p>
            <p className="text-xs text-muted-foreground">{vehicle.manufacturer_display}</p>
          </div>
          <div className="mt-auto flex h-[22px] items-center gap-1 overflow-hidden">
            {vehicle.tag_ids.slice(0, 2).map((id) => (
              <Badge key={id} variant="outline" className="shrink-0 text-[10px]">
                {tagLookup[id] ?? id}
              </Badge>
            ))}
            {vehicle.tag_ids.length > 2 && (
              <Badge
                variant="outline"
                className="shrink-0 text-[10px]"
                title={vehicle.tag_ids.slice(2).map((id) => tagLookup[id] ?? id).join(", ")}
              >
                +{vehicle.tag_ids.length - 2}
              </Badge>
            )}
            {vehicle.drift_variant && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleDriftAdd}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleDriftAdd(e);
                  }
                }}
                className={cn(
                  "ml-auto inline-flex cursor-pointer select-none items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                  driftCount > 0
                    ? "border-emerald-500/70 bg-emerald-500/20 text-emerald-300"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  driftPending && "opacity-60",
                )}
                aria-pressed={driftCount > 0}
                aria-label={`Add Drift ${vehicle.display_name}`}
              >
                {driftCount > 0 ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                Drift{driftCount > 1 ? ` ×${driftCount}` : ""}
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}

export const VehicleCard = memo(VehicleCardImpl);
