"use client";

import { Check, Plus } from "lucide-react";
import Image from "next/image";
import { memo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import type { PropertySummary } from "@/lib/properties";
import { formatPropertyType } from "@/lib/properties";
import { cn } from "@/lib/utils";
import { TradeInModal, type TradeInTrigger } from "@/components/portfolio/trade-in-modal";

import { togglePropertyOwnership } from "./actions";

type Props = {
  property: PropertySummary;
  imageUrl: string | null;
  owned: boolean;
  selectionMode?: "browse" | "multi";
  selected?: boolean;
  onSelect?: (propertyId: string) => void;
};

function PropertyCardImpl({
  property, imageUrl, owned,
  selectionMode = "browse",
  selected = false,
  onSelect,
}: Props) {
  const [optimisticOwned, setOptimisticOwned] = useState(owned);
  const [tradeInTrigger, setTradeInTrigger] = useState<TradeInTrigger | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    if (selectionMode === "multi") {
      onSelect?.(property.id);
      return;
    }
    const nextState = !optimisticOwned;
    setOptimisticOwned(nextState);
    startTransition(async () => {
      const result = await togglePropertyOwnership(property.id);
      if ("error" in result && result.error) {
        setOptimisticOwned(!nextState);
        toast.error(result.error);
      } else if ("needsTradeIn" in result) {
        setOptimisticOwned(false);
        setTradeInTrigger(result.needsTradeIn);
      } else if ("ok" in result && result.ok === false && "removed" in result) {
        setOptimisticOwned(false);
      } else if ("ok" in result && result.ok === true) {
        setOptimisticOwned(true);
      }
    });
  };

  const isHighlighted = selectionMode === "multi" ? selected : optimisticOwned;

  return (
    <>
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-lg border bg-card transition-all hover:border-foreground/40",
        isHighlighted && "border-emerald-500/70 ring-2 ring-emerald-500/30",
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
            isHighlighted
              ? "bg-emerald-500 text-white"
              : "bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100",
          )}
        >
          {isHighlighted ? (
            <Check className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </div>

        <div className="relative aspect-video w-full bg-muted">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={property.display_name}
              fill
              sizes="(min-width: 1536px) 20vw, (min-width: 1280px) 25vw, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="object-cover"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              No image
            </div>
          )}
          <span className="absolute left-2 top-2 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur-sm">
            {formatPropertyType(property.property_type)}
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 p-3">
          <div>
            <p className="text-sm font-medium leading-tight">
              {property.display_name}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground truncate">
              {property.subtype_display} · {property.neighborhood ?? "Location unknown"}
            </p>
          </div>
          <div className="mt-auto flex h-[22px] items-center gap-1 overflow-hidden">
            {property.max_capacity > 0 && (
              <Badge variant="outline" className="shrink-0 text-[10px]">
                Up to {property.max_capacity} cars
              </Badge>
            )}
          </div>
        </div>
      </button>
    </div>
    <TradeInModal
      trigger={tradeInTrigger}
      onClose={() => setTradeInTrigger(null)}
    />
    </>
  );
}

export const PropertyCard = memo(PropertyCardImpl);
