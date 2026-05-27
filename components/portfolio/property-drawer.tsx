"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  setAllUpgradesInstalled,
  toggleUpgradeInstalled,
} from "@/app/(app)/my-properties/actions";
import { assignVehicleStorage } from "@/app/(app)/my-vehicles/actions";
import { unownProperty } from "@/app/(app)/properties/actions";
import { formatMoneyCompact, formatMoneyFull } from "@/lib/format";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";

import { VehiclePickerModal } from "./vehicle-picker-modal";

type Props = {
  property: OwnedPropertyDetail;
  allOwnedProperties: OwnedPropertyDetail[];
  /** Every owned vehicle instance in the user's portfolio — filtered down to this property's storage locations for rendering. */
  instances: OwnedVehicleInstance[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PropertyDrawer({
  property,
  allOwnedProperties: _allOwnedProperties,
  instances,
  open,
  onOpenChange,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<{
    upgradeId: string | null;
    label: string;
    capacity: number;
    current: number;
  } | null>(null);

  // Optimistic overrides for upgrade is_installed. Map<upgradeId, installed>.
  // When set, takes precedence over the server-derived `u.is_installed`.
  // Cleared per-key on server confirm/error so subsequent server data flows
  // through naturally.
  const [optimisticInstalled, setOptimisticInstalled] = useState<
    Map<string, boolean>
  >(new Map());

  const isInstalled = (id: string, fallback: boolean) =>
    optimisticInstalled.has(id)
      ? (optimisticInstalled.get(id) as boolean)
      : fallback;

  const setOptimistic = (id: string, value: boolean | undefined) => {
    setOptimisticInstalled((prev) => {
      const next = new Map(prev);
      if (value === undefined) next.delete(id);
      else next.set(id, value);
      return next;
    });
  };

  // For the Storage section (Garage tab) we want every upgrade that holds
  // cars — including ones that come with the property (Mansion Garage,
  // Vinewood floors, MC Clubhouse garage, etc.).
  const storageUpgrades = property.upgrades.filter((u) => u.capacity > 0);
  // For the Upgrades tab CHECKLIST we hide included_on_purchase upgrades —
  // they aren't user choices (the garage comes with the mansion; you can't
  // un-buy it). They still render as storage blocks in the Garage tab.
  const upgradeChecklistRows = property.upgrades.filter((u) => !u.included_on_purchase);
  const storageChecklistRows = upgradeChecklistRows.filter((u) => u.capacity > 0);
  const nonStorageUpgrades = upgradeChecklistRows.filter((u) => u.capacity === 0);

  // Vehicles stored at THIS property, grouped by assigned_upgrade_id (null = base).
  const carsHere = instances.filter(
    (v) => v.storage?.owned_property_id === property.id,
  );
  const carsByUpgrade = new Map<string | null, OwnedVehicleInstance[]>();
  for (const v of carsHere) {
    const key = v.storage?.assigned_upgrade_id ?? null;
    const arr = carsByUpgrade.get(key) ?? [];
    arr.push(v);
    carsByUpgrade.set(key, arr);
  }

  const baseStorageCars =
    property.total_cars -
    storageUpgrades
      .filter((u) => u.is_installed)
      .reduce((sum, u) => sum + u.cars_here, 0);

  const handleRemoveFromStorage = (instanceId: string, displayName: string) => {
    startTransition(async () => {
      const r = await assignVehicleStorage({
        ownedVehicleId: instanceId,
        ownedPropertyId: null,
        assignedUpgradeId: null,
      });
      if ("error" in r) toast.error(r.error);
      else toast.success(`Unassigned ${displayName}`);
    });
  };

  // Drawer-skip for simple properties: auto-open the vehicle picker ONCE when
  // the drawer opens for a property with no storage-tier choices and a base
  // capacity > 0. Stand-alone garages, apartments, Eclipse Blvd, etc. jump
  // straight to picking cars. Deps are intentionally narrow (open + property.id)
  // so closing the modal doesn't re-trigger the auto-open — see the bug where
  // saving cars caused the modal to instantly re-open in a loop.
  useEffect(() => {
    if (!open) return;
    if (storageUpgrades.length === 0 && property.base_capacity > 0) {
      setPickerTarget({
        upgradeId: null,
        label: "Base storage",
        capacity: property.base_capacity,
        current: baseStorageCars,
      });
      setPickerOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, property.id]);

  const handleToggleUpgrade = (upgradeId: string, currentlyInstalled: boolean) => {
    // Optimistic flip — instant visual feedback.
    setOptimistic(upgradeId, !currentlyInstalled);

    // Mutex-group sibling handling — if we're INSTALLING an upgrade in a
    // mutex group, optimistically uninstall every sibling. The server does
    // the same atomically, but doing it client-side too keeps the UI honest
    // while the round-trip lands (e.g. switching yacht model).
    if (!currentlyInstalled) {
      const target = property.upgrades.find((u) => u.id === upgradeId);
      if (target?.mutex_group) {
        for (const sib of property.upgrades) {
          if (sib.id !== upgradeId && sib.mutex_group === target.mutex_group) {
            setOptimistic(sib.id, false);
          }
        }
      }
    }

    startTransition(async () => {
      const r = await toggleUpgradeInstalled(property.id, upgradeId);
      if ("error" in r) {
        // Rollback optimistic state on error.
        setOptimistic(upgradeId, undefined);
        // Also clear any sibling overrides we set
        const target = property.upgrades.find((u) => u.id === upgradeId);
        if (target?.mutex_group) {
          for (const sib of property.upgrades) {
            if (sib.id !== upgradeId && sib.mutex_group === target.mutex_group) {
              setOptimistic(sib.id, undefined);
            }
          }
        }
        toast.error(r.error);
      } else {
        // Server confirmed — drop the override so revalidated data takes over.
        setOptimistic(upgradeId, undefined);
        const target = property.upgrades.find((u) => u.id === upgradeId);
        if (target?.mutex_group) {
          for (const sib of property.upgrades) {
            if (sib.id !== upgradeId && sib.mutex_group === target.mutex_group) {
              setOptimistic(sib.id, undefined);
            }
          }
        }
      }
    });
  };

  const handleSetAllUpgrades = (installed: boolean) => {
    // Optimistic-set every USER-TOGGLEABLE upgrade for this property. Skip
    // included_on_purchase ones — they're not user choices (the Mansion
    // Garage comes with the mansion; "Uninstall all" must not orphan its
    // stored cars).
    setOptimisticInstalled(() => {
      const next = new Map<string, boolean>();
      for (const u of property.upgrades) {
        if (u.included_on_purchase) continue;
        next.set(u.id, installed);
      }
      return next;
    });
    startTransition(async () => {
      const r = await setAllUpgradesInstalled(property.id, installed);
      if ("error" in r) {
        setOptimisticInstalled(new Map());
        toast.error(r.error);
      } else {
        setOptimisticInstalled(new Map());
        toast.success(
          installed
            ? `Installed all upgrades (${r.changed})`
            : `Uninstalled all upgrades (${r.changed})`,
        );
      }
    });
  };

  const kindLabel = property.property_type === "business" ? "business" : "property";
  const confirm = useConfirm();

  const handleUnown = async () => {
    const carsMsg =
      property.total_cars > 0
        ? ` ${property.total_cars} stored ${property.total_cars === 1 ? "vehicle" : "vehicles"} will be unassigned.`
        : "";
    const ok = await confirm({
      title: `Remove ${property.display_name}?`,
      description: `This ${kindLabel} will be removed from your portfolio.${carsMsg}`,
      confirmText: `Remove ${kindLabel}`,
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const r = await unownProperty({
        ownedPropertyId: property.id,
        carDestinations: [],
      });
      if ("error" in r) toast.error(r.error);
      else {
        toast.success(`Removed ${property.display_name}`);
        onOpenChange(false);
      }
    });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{property.display_name}</SheetTitle>
            <SheetDescription>
              {property.subtype_display}
              {property.neighborhood ? ` · ${property.neighborhood}` : ""}
              {property.price !== null && (
                <>
                  {" · "}
                  <span
                    className="text-emerald-400 tabular-nums"
                    title={formatMoneyFull(property.price)}
                  >
                    {formatMoneyCompact(property.price)}
                  </span>
                </>
              )}
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue="all" className="py-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="upgrades">Upgrades</TabsTrigger>
              <TabsTrigger value="garage">Garage</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="flex flex-col gap-4 mt-4">
              {property.upgrades.length > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleSetAllUpgrades(true)} disabled={isPending} className="flex-1">
                    ✓ Install all upgrades
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleSetAllUpgrades(false)} disabled={isPending} className="flex-1">
                    Uninstall all
                  </Button>
                </div>
              )}
              <UpgradesSection
                storageUpgrades={storageChecklistRows}
                nonStorageUpgrades={nonStorageUpgrades}
                isInstalled={isInstalled}
                handleToggleUpgrade={handleToggleUpgrade}
                property={property}
              />
              <StorageSection
                property={property}
                storageUpgrades={storageUpgrades}
                carsByUpgrade={carsByUpgrade}
                baseStorageCars={baseStorageCars}
                setPickerTarget={setPickerTarget}
                setPickerOpen={setPickerOpen}
                handleRemoveFromStorage={handleRemoveFromStorage}
                isPending={isPending}
              />
            </TabsContent>

            <TabsContent value="upgrades" className="flex flex-col gap-4 mt-4">
              {upgradeChecklistRows.length > 0 && (
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => handleSetAllUpgrades(true)} disabled={isPending} className="flex-1">
                    ✓ Install all upgrades
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleSetAllUpgrades(false)} disabled={isPending} className="flex-1">
                    Uninstall all
                  </Button>
                </div>
              )}
              <UpgradesSection
                storageUpgrades={storageChecklistRows}
                nonStorageUpgrades={nonStorageUpgrades}
                isInstalled={isInstalled}
                handleToggleUpgrade={handleToggleUpgrade}
                property={property}
              />
            </TabsContent>

            <TabsContent value="garage" className="flex flex-col gap-4 mt-4">
              <StorageSection
                property={property}
                storageUpgrades={storageUpgrades}
                carsByUpgrade={carsByUpgrade}
                baseStorageCars={baseStorageCars}
                setPickerTarget={setPickerTarget}
                setPickerOpen={setPickerOpen}
                handleRemoveFromStorage={handleRemoveFromStorage}
                isPending={isPending}
              />
            </TabsContent>
          </Tabs>

          <SheetFooter>
            <Button
              variant="outline"
              onClick={handleUnown}
              disabled={isPending}
              className="w-full border-red-500/50 text-red-300 hover:bg-red-500/10"
            >
              Remove {kindLabel}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {pickerTarget && (
        <VehiclePickerModal
          ownedPropertyId={property.id}
          assignedUpgradeId={pickerTarget.upgradeId}
          label={`${property.display_name} · ${pickerTarget.label}`}
          capacity={pickerTarget.capacity}
          currentCount={pickerTarget.current}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
        />
      )}
    </>
  );
}

type UpgradeRow = OwnedPropertyDetail["upgrades"][number];

function UpgradesSection({
  storageUpgrades,
  nonStorageUpgrades,
  isInstalled,
  handleToggleUpgrade,
  property,
}: {
  storageUpgrades: UpgradeRow[];
  nonStorageUpgrades: UpgradeRow[];
  isInstalled: (id: string, fallback: boolean) => boolean;
  handleToggleUpgrade: (id: string, currentlyInstalled: boolean) => void;
  property: OwnedPropertyDetail;
}) {
  const renderRow = (u: UpgradeRow, showCapacityBadge: boolean) => {
    const installed = isInstalled(u.id, u.is_installed);
    const prereqMet =
      !u.required_upgrade_id ||
      isInstalled(
        u.required_upgrade_id,
        property.upgrades.find((x) => x.id === u.required_upgrade_id)
          ?.is_installed ?? false,
      );
    return (
      <label
        key={u.id}
        className="flex items-center gap-2 rounded-md p-2 hover:bg-muted/50 cursor-pointer"
        style={{ opacity: prereqMet ? 1 : 0.5 }}
      >
        <input
          type="checkbox"
          checked={installed}
          disabled={!prereqMet}
          onChange={() => handleToggleUpgrade(u.id, installed)}
        />
        <span className="text-sm flex-1">{u.display_name}</span>
        {u.price !== null && (
          <span
            className="text-[10px] tabular-nums text-emerald-300/70"
            title={formatMoneyFull(u.price)}
          >
            {formatMoneyCompact(u.price)}
          </span>
        )}
        {showCapacityBadge && (
          <Badge variant="outline" className="text-[10px]">
            {u.capacity}
          </Badge>
        )}
      </label>
    );
  };

  return (
    <>
      {storageUpgrades.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Storage upgrades
          </p>
          <div className="flex flex-col gap-1">
            {storageUpgrades.map((u) => renderRow(u, true))}
          </div>
        </section>
      )}
      {nonStorageUpgrades.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Equipment &amp; security
          </p>
          <div className="flex flex-col gap-1">
            {nonStorageUpgrades.map((u) => renderRow(u, false))}
          </div>
        </section>
      )}
    </>
  );
}

function StorageSection({
  property,
  storageUpgrades,
  carsByUpgrade,
  baseStorageCars,
  setPickerTarget,
  setPickerOpen,
  handleRemoveFromStorage,
  isPending,
}: {
  property: OwnedPropertyDetail;
  storageUpgrades: UpgradeRow[];
  carsByUpgrade: Map<string | null, OwnedVehicleInstance[]>;
  baseStorageCars: number;
  setPickerTarget: (t: {
    upgradeId: string | null;
    label: string;
    capacity: number;
    current: number;
  }) => void;
  setPickerOpen: (o: boolean) => void;
  handleRemoveFromStorage: (instanceId: string, displayName: string) => void;
  isPending: boolean;
}) {
  const installed = storageUpgrades.filter((u) => u.is_installed);
  const hasAny = property.base_capacity > 0 || installed.length > 0;
  return (
    <section>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Your storage
      </p>
      {!hasAny ? (
        <p className="text-xs text-muted-foreground">
          No storage available yet — install a storage upgrade in the Upgrades tab.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {property.base_capacity > 0 && (
            <StorageBlock
              label={property.subtype_display}
              capacity={property.base_capacity}
              cars={carsByUpgrade.get(null) ?? []}
              onAddCars={() => {
                setPickerTarget({
                  upgradeId: null,
                  label: "Base storage",
                  capacity: property.base_capacity,
                  current: baseStorageCars,
                });
                setPickerOpen(true);
              }}
              onRemoveCar={handleRemoveFromStorage}
              isPending={isPending}
            />
          )}
          {installed.map((u) => (
            <StorageBlock
              key={u.id}
              label={u.display_name}
              capacity={u.capacity}
              cars={carsByUpgrade.get(u.id) ?? []}
              onAddCars={() => {
                setPickerTarget({
                  upgradeId: u.id,
                  label: u.display_name,
                  capacity: u.capacity,
                  current: u.cars_here,
                });
                setPickerOpen(true);
              }}
              onRemoveCar={handleRemoveFromStorage}
              isPending={isPending}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function StorageBlock({
  label,
  capacity,
  cars,
  onAddCars,
  onRemoveCar,
  isPending,
}: {
  label: string;
  capacity: number;
  cars: OwnedVehicleInstance[];
  onAddCars: () => void;
  onRemoveCar: (instanceId: string, displayName: string) => void;
  isPending: boolean;
}) {
  return (
    <div className="rounded-md border">
      <button
        type="button"
        onClick={onAddCars}
        className="flex w-full items-center justify-between p-3 text-sm hover:bg-muted/50"
      >
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {cars.length} / {capacity} · + Add cars
        </span>
      </button>
      {cars.length > 0 && (
        <ul className="flex flex-col border-t">
          {cars.map((v) => {
            const name = v.nickname || v.display_name;
            return (
              <li
                key={v.id}
                className="flex items-center justify-between px-3 py-1.5 text-sm hover:bg-muted/30"
              >
                <span className="flex flex-col min-w-0">
                  <span className="truncate">{name}</span>
                  {v.nickname && (
                    <span className="text-[10px] text-muted-foreground truncate">
                      {v.display_name}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => onRemoveCar(v.id, name)}
                  disabled={isPending}
                  className="ml-2 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
                  aria-label={`Unassign ${name}`}
                >
                  ✕
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
