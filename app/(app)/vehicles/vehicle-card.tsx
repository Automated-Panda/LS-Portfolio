"use client";

import { Check, Plus } from "lucide-react";
import Image from "next/image";
import { memo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import type { VehicleSummary } from "@/lib/vehicles";
import { cn } from "@/lib/utils";

import { toggleVehicleOwnership } from "./actions";

type Props = {
  vehicle: VehicleSummary;
  imageUrl: string | null;
  owned: boolean;
  tagLookup: Record<string, string>;
};

function VehicleCardImpl({ vehicle, imageUrl, owned, tagLookup }: Props) {
  const [optimisticOwned, setOptimisticOwned] = useState(owned);
  const [isPending, startTransition] = useTransition();
  const [driftOwned, setDriftOwned] = useState(
    vehicle.drift_variant?.owned ?? false,
  );
  const [driftPending, startDriftTransition] = useTransition();

  const handleToggle = () => {
    const nextState = !optimisticOwned;
    setOptimisticOwned(nextState);
    startTransition(async () => {
      const result = await toggleVehicleOwnership(vehicle.id);
      if (result.error) {
        setOptimisticOwned(!nextState);
        toast.error(result.error);
      } else {
        setOptimisticOwned(result.owned);
      }
    });
  };

  const handleDriftToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!vehicle.drift_variant) return;
    const driftId = vehicle.drift_variant.id;
    const nextState = !driftOwned;
    setDriftOwned(nextState);
    startDriftTransition(async () => {
      const result = await toggleVehicleOwnership(driftId);
      if (result.error) {
        setDriftOwned(!nextState);
        toast.error(result.error);
      } else {
        setDriftOwned(result.owned);
      }
    });
  };

  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-all hover:border-foreground/40",
        optimisticOwned && "border-emerald-500/70 ring-2 ring-emerald-500/30",
        isPending && "opacity-80",
      )}
    >
      <button
        type="button"
        onClick={handleToggle}
        disabled={isPending}
        className="flex flex-1 flex-col text-left"
      >
        <div
          className={cn(
            "absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full transition-all",
            optimisticOwned
              ? "bg-emerald-500 text-white"
              : "bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100",
          )}
        >
          {optimisticOwned ? (
            <Check className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </div>

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
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div>
            <p className="text-sm font-medium leading-tight">
              {vehicle.display_name}
            </p>
            <p className="text-xs text-muted-foreground">
              {vehicle.manufacturer_display}
            </p>
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
                title={vehicle.tag_ids
                  .slice(2)
                  .map((id) => tagLookup[id] ?? id)
                  .join(", ")}
              >
                +{vehicle.tag_ids.length - 2}
              </Badge>
            )}
            {vehicle.drift_variant && (
              <span
                role="button"
                tabIndex={0}
                onClick={handleDriftToggle}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleDriftToggle(e as unknown as React.MouseEvent);
                  }
                }}
                className={cn(
                  "ml-auto inline-flex cursor-pointer select-none items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                  driftOwned
                    ? "border-emerald-500/70 bg-emerald-500/20 text-emerald-300"
                    : "border-border text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                  driftPending && "opacity-60",
                )}
                aria-pressed={driftOwned}
                aria-label={`${driftOwned ? "Remove" : "Add"} drift variant`}
              >
                {driftOwned ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Plus className="h-3 w-3" />
                )}
                Drift
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}

export const VehicleCard = memo(VehicleCardImpl);
