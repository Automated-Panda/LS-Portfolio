"use client";

import { Check, Plus, Settings2, Trash2 } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { memo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { formatMoneyCompact, formatMoneyFull } from "@/lib/format";
import type { PropertySummary } from "@/lib/properties";
import { formatPropertyType } from "@/lib/properties";
import { cn } from "@/lib/utils";
import { TradeInModal, type TradeInTrigger } from "@/components/portfolio/trade-in-modal";

import { togglePropertyOwnership } from "./actions";

type TowerProps = {
  /** When set, this property is a tower aggregator. Click opens a units
   * dialog instead of toggling ownership. The tower itself is non-ownable. */
  tower: {
    totalUnits: number;
    ownedCount: number;
    selectedCount?: number;     // only meaningful in selectionMode="multi"
    onOpen: () => void;
  };
};

type Props = {
  property: PropertySummary;
  imageUrl: string | null;
  owned: boolean;
  selectionMode?: "browse" | "multi";
  selected?: boolean;
  onSelect?: (propertyId: string) => void;
  /** When set, the Settings icon (and clicking an owned card) opens the
   * management drawer in place instead of routing to /my-properties. */
  onOpenManagement?: (catalogueId: string) => void;
} & Partial<TowerProps>;

function PropertyCardImpl({
  property, imageUrl, owned,
  selectionMode = "browse",
  selected = false,
  onSelect,
  onOpenManagement,
  tower,
}: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [optimisticOwned, setOptimisticOwned] = useState(owned);
  const [tradeInTrigger, setTradeInTrigger] = useState<TradeInTrigger | null>(null);
  const [isPending, startTransition] = useTransition();

  const ownedDestPath =
    property.property_type === "business" ? "/my-businesses" : "/my-properties";
  const kindLabel = property.property_type === "business" ? "business" : "property";

  const openManagement = () => {
    // Prefer the in-place handler (used by /properties + /businesses) so the
    // user stays on the browse grid; fall back to routing for any consumer
    // that hasn't been wired up to host a PropertyDrawer (e.g. /dashboard
    // links or older deep links).
    if (onOpenManagement) {
      onOpenManagement(property.id);
      return;
    }
    router.push(`${ownedDestPath}?open=${encodeURIComponent(property.id)}`);
  };

  const handleRemove = async () => {
    const ok = await confirm({
      title: `Remove ${property.display_name}?`,
      description: `This ${kindLabel} will be removed from your portfolio. Any stored vehicles become unassigned.`,
      confirmText: `Remove ${kindLabel}`,
      destructive: true,
    });
    if (!ok) return;
    setOptimisticOwned(false);
    startTransition(async () => {
      const result = await togglePropertyOwnership(property.id);
      if ("error" in result && result.error) {
        setOptimisticOwned(true);
        toast.error(result.error);
      } else if ("ok" in result && result.ok === false && "removed" in result) {
        toast.success(`Removed ${property.display_name}.`);
      }
    });
  };

  const handleToggle = () => {
    if (tower) {
      tower.onOpen();
      return;
    }
    if (selectionMode === "multi") {
      onSelect?.(property.id);
      return;
    }
    // Already owned → jump into the management drawer instead of un-owning.
    // Un-owning is then a deliberate action via the bin icon (or the drawer's
    // Remove button), both of which use a confirm dialog.
    if (optimisticOwned) {
      openManagement();
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
        // For garage-bearing properties, offer a one-click jump straight into
        // the storage picker so the user doesn't have to navigate to
        // /my-properties manually to start adding cars. Prefer the in-place
        // drawer (when the parent provides onOpenManagement) so the user
        // stays on /properties.
        if (property.counts_as_garage && property.max_capacity > 0) {
          toast.success(`Added ${property.display_name}`, {
            action: {
              label: "Add cars",
              onClick: () => openManagement(),
            },
          });
        }
      }
    });
  };

  const towerInteracted = tower
    ? selectionMode === "multi"
      ? (tower.selectedCount ?? 0) > 0
      : tower.ownedCount > 0
    : false;
  const isHighlighted = tower
    ? towerInteracted
    : selectionMode === "multi"
      ? selected
      : optimisticOwned;

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
        aria-label={
          optimisticOwned && selectionMode !== "multi" && !tower
            ? `Manage ${property.display_name}`
            : `Add ${property.display_name} to portfolio`
        }
        title={
          optimisticOwned && selectionMode !== "multi" && !tower
            ? "Click to manage / add cars"
            : undefined
        }
      >
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
          {property.price !== null && !tower && (
            <span
              className="absolute bottom-2 left-2 z-10 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-emerald-300 backdrop-blur-sm"
              title={formatMoneyFull(property.price)}
            >
              {formatMoneyCompact(property.price)}
            </span>
          )}
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
            {tower ? (
              <Badge variant="outline" className="shrink-0 text-[10px]">
                {tower.totalUnits} units · click to pick
              </Badge>
            ) : (
              property.max_capacity > 0 && (
                <Badge variant="outline" className="shrink-0 text-[10px]">
                  Up to {property.max_capacity} cars
                </Badge>
              )
            )}
          </div>
        </div>
      </button>

      {/* Top-right control cluster. Towers show a count chip; owned cards
          show settings + bin + check; unowned cards show a + on hover.
          These overlay sit OUTSIDE the main button so their own clicks
          don't bubble up to the toggle handler. */}
      {tower ? (
        <div
          className={cn(
            "pointer-events-none absolute right-2 top-2 z-20 flex h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold transition-all",
            towerInteracted
              ? "bg-emerald-500 text-white"
              : "bg-background/90 text-foreground",
          )}
        >
          {selectionMode === "multi"
            ? `${tower.selectedCount ?? 0} / ${tower.totalUnits}`
            : `${tower.ownedCount} / ${tower.totalUnits}`}
        </div>
      ) : optimisticOwned && selectionMode !== "multi" ? (
        <div className="absolute right-2 top-2 z-20 flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openManagement(); }}
            disabled={isPending}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow hover:bg-accent/40 transition-colors"
            aria-label={`Manage ${property.display_name}`}
            title="Manage / add cars"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); void handleRemove(); }}
            disabled={isPending}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-background/90 text-foreground shadow hover:bg-red-500/20 hover:text-red-300 transition-colors"
            aria-label={`Remove ${property.display_name}`}
            title={`Remove ${kindLabel}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <div
            className="pointer-events-none flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500 text-white shadow"
            aria-hidden
          >
            <Check className="h-4 w-4" />
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "pointer-events-none absolute right-2 top-2 z-20 flex h-7 w-7 items-center justify-center rounded-full transition-all",
            selected
              ? "bg-emerald-500 text-white"
              : "bg-background/80 text-muted-foreground opacity-0 group-hover:opacity-100",
          )}
        >
          {selected ? (
            <Check className="h-4 w-4" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
        </div>
      )}
    </div>
    <TradeInModal
      trigger={tradeInTrigger}
      onClose={() => setTradeInTrigger(null)}
    />
    </>
  );
}

export const PropertyCard = memo(PropertyCardImpl);
