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
import { unownProperty } from "@/app/(app)/properties/actions";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

import { VehiclePickerModal } from "./vehicle-picker-modal";

type Props = {
  property: OwnedPropertyDetail;
  allOwnedProperties: OwnedPropertyDetail[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function PropertyDrawer({
  property,
  allOwnedProperties: _allOwnedProperties,
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

  const baseStorageCars =
    property.total_cars -
    storageUpgrades
      .filter((u) => u.is_installed)
      .reduce((sum, u) => sum + u.cars_here, 0);

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
                Your storage (click to manage cars)
              </p>
              <div className="flex flex-col gap-1">
                {property.base_capacity > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setPickerTarget({
                        upgradeId: null,
                        label: "Base storage",
                        capacity: property.base_capacity,
                        current: baseStorageCars,
                      });
                      setPickerOpen(true);
                    }}
                    className="flex items-center justify-between rounded-md border p-3 text-sm hover:border-foreground/40"
                  >
                    <span>{property.subtype_display}</span>
                    <span className="text-muted-foreground">
                      {baseStorageCars} / {property.base_capacity} →
                    </span>
                  </button>
                )}
                {storageUpgrades
                  .filter((u) => u.is_installed)
                  .map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => {
                        setPickerTarget({
                          upgradeId: u.id,
                          label: u.display_name,
                          capacity: u.capacity,
                          current: u.cars_here,
                        });
                        setPickerOpen(true);
                      }}
                      className="flex items-center justify-between rounded-md border p-3 text-sm hover:border-foreground/40"
                    >
                      <span>{u.display_name}</span>
                      <span className="text-muted-foreground">
                        {u.cars_here} / {u.capacity} →
                      </span>
                    </button>
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
