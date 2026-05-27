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
import { toggleUpgradeInstalled } from "@/app/(app)/my-properties/actions";
import { assignVehicleStorage } from "@/app/(app)/my-vehicles/actions";
import { unownProperty } from "@/app/(app)/properties/actions";
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

  const storageUpgrades = property.upgrades.filter((u) => u.capacity > 0);
  const nonStorageUpgrades = property.upgrades.filter((u) => u.capacity === 0);

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

  const handleToggleUpgrade = (upgradeId: string) => {
    startTransition(async () => {
      const r = await toggleUpgradeInstalled(property.id, upgradeId);
      if ("error" in r) toast.error(r.error);
    });
  };

  const handleUnown = () => {
    if (
      !confirm(
        `Remove ${property.display_name} from your portfolio? ${property.total_cars} cars will need to go somewhere.`,
      )
    )
      return;
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
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4 py-4">
            {storageUpgrades.length > 0 && (
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Storage upgrades
                </p>
                <div className="flex flex-col gap-1">
                  {storageUpgrades.map((u) => {
                    const prereqMet =
                      !u.required_upgrade_id ||
                      property.upgrades.find((x) => x.id === u.required_upgrade_id)
                        ?.is_installed;
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 rounded-md p-2 hover:bg-muted/50"
                        style={{ opacity: prereqMet ? 1 : 0.5 }}
                      >
                        <input
                          type="checkbox"
                          checked={u.is_installed}
                          disabled={!prereqMet || isPending}
                          onChange={() => handleToggleUpgrade(u.id)}
                        />
                        <span className="text-sm">{u.display_name}</span>
                        <Badge variant="outline" className="ml-auto text-[10px]">
                          {u.capacity}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            {nonStorageUpgrades.length > 0 && (
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Equipment &amp; security
                </p>
                <div className="flex flex-col gap-1">
                  {nonStorageUpgrades.map((u) => {
                    const prereqMet =
                      !u.required_upgrade_id ||
                      property.upgrades.find((x) => x.id === u.required_upgrade_id)
                        ?.is_installed;
                    return (
                      <label
                        key={u.id}
                        className="flex items-center gap-2 rounded-md p-2 hover:bg-muted/50"
                        style={{ opacity: prereqMet ? 1 : 0.5 }}
                      >
                        <input
                          type="checkbox"
                          checked={u.is_installed}
                          disabled={!prereqMet || isPending}
                          onChange={() => handleToggleUpgrade(u.id)}
                        />
                        <span className="text-sm">{u.display_name}</span>
                      </label>
                    );
                  })}
                </div>
              </section>
            )}

            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Your storage
              </p>
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
                {storageUpgrades
                  .filter((u) => u.is_installed)
                  .map((u) => (
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
            </section>
          </div>

          <SheetFooter>
            <Button
              variant="outline"
              onClick={handleUnown}
              disabled={isPending}
              className="w-full border-red-500/50 text-red-300 hover:bg-red-500/10"
            >
              Un-own / trade in this property
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
