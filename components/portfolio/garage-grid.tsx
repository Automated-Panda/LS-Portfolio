"use client";

import {
  DndContext,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { ChevronDown, ChevronRight, Settings2, Wand2 } from "lucide-react";
import Image from "next/image";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { FavouriteStar } from "@/components/portfolio/favourite-star";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import {
  autoArrangeGarage,
  setVehicleSlot,
  swapVehicleSlots,
} from "@/app/(app)/my-vehicles/slot-actions";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import { vehicleImageUrl } from "@/lib/vehicles";

type Props = {
  ownedPropertyId: string;
  assignedUpgradeId: string | null;
  label: string;
  capacity: number;
  cars: OwnedVehicleInstance[];
  noun: string;
  tagLookup: Record<string, string>;
  onAdd: () => void;
  onManage: (instanceId: string) => void;
  onRemove: (instanceId: string, displayName: string) => void;
  /** Show a chevron to collapse this area (multi-floor properties). */
  collapsible?: boolean;
};

/**
 * Fixed-grid view of a car garage: N numbered slots (empty ones visible) plus an
 * "Unplaced" tray for cars in this garage without a chosen spot. Drag a car onto
 * a slot to place it; drop onto an occupied slot to swap; drop onto the tray to
 * un-place. Numbers are never auto-assigned — the optional Auto-arrange button is
 * the only bulk filler.
 */
export function GarageGrid({
  ownedPropertyId,
  assignedUpgradeId,
  label,
  capacity,
  cars,
  noun,
  tagLookup,
  onAdd,
  onManage,
  onRemove,
  collapsible = false,
}: Props) {
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const [collapsed, setCollapsed] = useState(false);

  // Optimistic slot map (instanceId -> slot|null), overlaying server data. Resync
  // whenever the server props change (after a revalidate lands).
  const [slotById, setSlotById] = useState<Map<string, number | null>>(() =>
    initSlots(cars),
  );
  useEffect(() => {
    setSlotById(initSlots(cars));
  }, [cars]);

  const slotOf = (id: string) => slotById.get(id) ?? null;
  const placedSlots = new Set(
    [...slotById.values()].filter((n): n is number => n != null),
  );
  const carAtSlot = (n: number) =>
    cars.find((c) => slotOf(c.id) === n) ?? null;
  // In-area cars without a valid slot (null, or stranded above a shrunken cap).
  const unplaced = cars.filter((c) => {
    const s = slotOf(c.id);
    return s == null || s > capacity;
  });

  const sensors = useSensors(
    // Small activation distance so taps still open the drawer / hit buttons.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 150, tolerance: 8 },
    }),
  );

  const applyServer = (
    run: () => Promise<{ ok: true } | { error: string } | { occupied: unknown }>,
    optimistic: () => void,
  ) => {
    optimistic();
    startTransition(async () => {
      const r = await run();
      if (r && "error" in r) {
        toast.error(r.error);
        setSlotById(initSlots(cars)); // rollback to server truth
      }
    });
  };

  const handleDragEnd = (e: DragEndEvent) => {
    const activeId = String(e.active.id);
    const over = e.over;
    if (!over) return;
    const overId = String(over.id);

    // Drop onto the tray → un-place.
    if (overId === "tray") {
      if (slotOf(activeId) == null) return;
      applyServer(
        () => setVehicleSlot({ ownedVehicleId: activeId, slotNumber: null }),
        () => setSlotById((m) => new Map(m).set(activeId, null)),
      );
      return;
    }

    // Drop onto a numbered slot.
    if (overId.startsWith("slot:")) {
      const target = Number(overId.slice(5));
      if (slotOf(activeId) === target) return;
      const occupant = carAtSlot(target);

      if (occupant && occupant.id !== activeId) {
        // Swap: active takes the slot, occupant inherits active's old slot.
        const prev = slotOf(activeId);
        applyServer(
          () => swapVehicleSlots({ aId: activeId, bId: occupant.id }),
          () =>
            setSlotById((m) => {
              const next = new Map(m);
              next.set(activeId, target);
              next.set(occupant.id, prev);
              return next;
            }),
        );
      } else {
        applyServer(
          () =>
            setVehicleSlot({ ownedVehicleId: activeId, slotNumber: target }),
          () => setSlotById((m) => new Map(m).set(activeId, target)),
        );
      }
    }
  };

  const handleAutoArrange = async () => {
    const ok = await confirm({
      title: `Auto-arrange ${label}?`,
      description:
        "Numbers every car in this garage 1, 2, 3… in the order you added them. Overwrites any slots you've already set here.",
      confirmText: "Auto-arrange",
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await autoArrangeGarage({
        ownedPropertyId,
        assignedUpgradeId,
      });
      if ("error" in r) toast.error(r.error);
      else toast.success(`Arranged ${label}`);
    });
  };

  const total = cars.length;
  const full = total >= capacity;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          {collapsible ? (
            <button
              type="button"
              onClick={() => setCollapsed((c) => !c)}
              className="inline-flex items-center gap-1 text-sm font-semibold hover:text-foreground/80"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
              {label}
            </button>
          ) : (
            <h3 className="text-sm font-semibold">{label}</h3>
          )}
          <div className="flex items-center gap-2">
            {!collapsed && total > 1 && (
              <button
                type="button"
                onClick={handleAutoArrange}
                disabled={isPending}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
                title="Number every car in this garage in order"
              >
                <Wand2 className="h-3 w-3" /> Auto-arrange
              </button>
            )}
            <span className="text-xs tabular-nums text-muted-foreground">
              {total} / {capacity}
            </span>
          </div>
        </div>

        {!collapsed && (
        <>
        {/* Numbered slot grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
          {Array.from({ length: capacity }, (_, i) => i + 1).map((n) => {
            const car = carAtSlot(n);
            return (
              <SlotCell key={n} slot={n}>
                {car ? (
                  <CarCard
                    instance={car}
                    slot={n}
                    tagLookup={tagLookup}
                    isPending={isPending}
                    onManage={() => onManage(car.id)}
                    onRemove={() => onRemove(car.id, car.nickname || car.display_name)}
                  />
                ) : null}
              </SlotCell>
            );
          })}
        </div>

        {/* Unplaced tray */}
        <Tray>
          {unplaced.length === 0 && (
            <p className="px-1 text-xs text-muted-foreground">
              {placedSlots.size === 0
                ? `Drag a ${noun} into a numbered slot, or use Auto-arrange.`
                : "No unplaced vehicles — drag a card here to un-place it."}
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {unplaced.map((car) => (
              <CarCard
                key={car.id}
                instance={car}
                slot={null}
                tagLookup={tagLookup}
                isPending={isPending}
                onManage={() => onManage(car.id)}
                onRemove={() => onRemove(car.id, car.nickname || car.display_name)}
              />
            ))}
            {!full && (
              <button
                type="button"
                onClick={onAdd}
                className="flex min-h-[140px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-foreground/30 text-muted-foreground transition-colors hover:border-foreground/60 hover:bg-muted/30 hover:text-foreground"
              >
                <span className="text-lg leading-none">+</span>
                <span className="text-xs">Add {noun}</span>
              </button>
            )}
          </div>
        </Tray>
        </>
        )}
      </div>
    </DndContext>
  );
}

function initSlots(cars: OwnedVehicleInstance[]): Map<string, number | null> {
  return new Map(cars.map((c) => [c.id, c.storage?.slot_number ?? null]));
}

/** A droppable numbered cell. Shows its number; renders a card when occupied. */
function SlotCell({
  slot,
  children,
}: {
  slot: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `slot:${slot}` });
  return (
    <div
      ref={setNodeRef}
      className={`relative min-h-[140px] rounded-lg transition-colors ${
        children
          ? ""
          : `flex flex-col items-center justify-center border border-dashed ${
              isOver
                ? "border-emerald-400 bg-emerald-500/10"
                : "border-foreground/15 bg-muted/20"
            }`
      } ${isOver && children ? "ring-2 ring-emerald-400" : ""}`}
    >
      {!children && (
        <span className="text-2xl font-semibold tabular-nums text-foreground/20">
          {slot}
        </span>
      )}
      {children}
    </div>
  );
}

/** The drop zone for unplaced cars. */
function Tray({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: "tray" });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 rounded-lg border border-dashed p-3 transition-colors ${
        isOver ? "border-amber-400 bg-amber-500/5" : "border-foreground/15"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Unplaced
      </p>
      {children}
    </div>
  );
}

/** Draggable vehicle card. `slot` non-null when it sits in a numbered cell. */
function CarCard({
  instance,
  slot,
  tagLookup,
  isPending,
  onManage,
  onRemove,
}: {
  instance: OwnedVehicleInstance;
  slot: number | null;
  tagLookup: Record<string, string>;
  isPending: boolean;
  onManage: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: instance.id });
  const img = vehicleImageUrl(instance.image_path);
  const name = instance.nickname || instance.display_name;

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        zIndex: isDragging ? 50 : undefined,
      }}
      onClick={() => {
        if (!isDragging) onManage();
      }}
      className={`group relative flex cursor-pointer touch-none flex-col overflow-hidden rounded-lg border bg-card ${
        isDragging
          ? "border-emerald-400 opacity-90 shadow-lg"
          : "border-emerald-500/70 ring-2 ring-emerald-500/30 hover:border-foreground/40"
      }`}
      {...attributes}
      {...listeners}
    >
      {/* Slot number — bottom-left, mirrors the /my-vehicles badge. */}
      {slot != null && (
        <span className="absolute bottom-1.5 left-1.5 z-10 flex h-6 min-w-6 items-center justify-center rounded-md bg-emerald-600 px-1.5 text-xs font-bold tabular-nums text-white shadow">
          {slot}
        </span>
      )}
      <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5">
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onManage();
            }}
            disabled={isPending}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm hover:text-foreground disabled:opacity-50"
            aria-label={`Manage ${name}`}
            title="Manage nickname, tags, notes, storage"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            disabled={isPending}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-background/90 text-xs text-muted-foreground shadow-sm hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
            aria-label={`Remove ${name} from this garage`}
            title="Remove from this garage"
          >
            ✕
          </button>
        </div>
        <div
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <FavouriteStar
            instanceId={instance.id}
            initial={instance.is_favourite}
            size={16}
            className="bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background"
          />
        </div>
      </div>

      <div className="relative aspect-video w-full bg-muted">
        {img && (
          <Image
            src={img}
            alt={instance.display_name}
            fill
            className="pointer-events-none object-contain"
            loading="lazy"
            sizes="20vw"
          />
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] uppercase text-white">
          {instance.class}
        </span>
      </div>
      <div className="flex flex-col gap-1 p-3">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {instance.nickname ? instance.display_name : instance.manufacturer_display}
        </p>
        <div className="mt-1 flex flex-wrap gap-1">
          {instance.tag_ids.slice(0, 3).map((id) => (
            <Badge key={id} variant="outline" className="text-[10px]">
              {tagLookup[id] ?? id}
            </Badge>
          ))}
          {instance.custom_tags.slice(0, 3).map((t) => (
            <Badge
              key={t}
              variant="outline"
              className="border-amber-500/40 text-amber-300 text-[10px]"
            >
              {t}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}
