"use client";

import { Plus, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  removeVehicleInstance,
  updateVehicleInstance,
  assignVehicleStorage,
} from "@/app/(app)/my-vehicles/actions";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

import { formatMoneyCompact, formatMoneyFull } from "@/lib/format";
import { assetCategoryOf, storageAssetCategory } from "@/lib/vehicles";
import { bayBinding, isBayUpgrade, isVehicleBoundSlot, slotAcceptsVehicle } from "@/lib/bays";

import { CustomTagsInput } from "./custom-tags-input";
import { FavouriteStar } from "./favourite-star";

type Props = {
  instance: OwnedVehicleInstance;
  ownedProperties: OwnedPropertyDetail[];
  /** Union of all custom_tags across user's fleet — feeds the tag autocomplete. */
  tagSuggestions?: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function InstanceDrawer({
  instance,
  ownedProperties,
  tagSuggestions,
  open,
  onOpenChange,
}: Props) {
  const [nickname, setNickname] = useState(instance.nickname ?? "");
  const [notes, setNotes] = useState(instance.notes ?? "");
  const [tags, setTags] = useState(instance.custom_tags);
  const [propertyId, setPropertyId] = useState(
    instance.storage?.owned_property_id ?? "",
  );
  const [upgradeId, setUpgradeId] = useState(
    instance.storage?.assigned_upgrade_id ?? "",
  );
  const [subSlot, setSubSlot] = useState(instance.storage?.sub_slot ?? "");
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirm();

  // Auto-expand fields that already have content on open. Empty fields show
  // as `+ Field name` pill buttons; clicking expands the input inline.
  const [showNickname, setShowNickname] = useState(
    (instance.nickname ?? "") !== "",
  );
  const [showTags, setShowTags] = useState(instance.custom_tags.length > 0);
  const [showNotes, setShowNotes] = useState((instance.notes ?? "") !== "");

  const collapsedButtons: Array<{
    key: "nickname" | "tags" | "notes";
    label: string;
    expanded: boolean;
    expand: () => void;
  }> = [
    {
      key: "nickname",
      label: "Custom Name",
      expanded: showNickname,
      expand: () => setShowNickname(true),
    },
    {
      key: "tags",
      label: "Highlights",
      expanded: showTags,
      expand: () => setShowTags(true),
    },
    {
      key: "notes",
      label: "Notes",
      expanded: showNotes,
      expand: () => setShowNotes(true),
    },
  ];
  const anyCollapsed = collapsedButtons.some((b) => !b.expanded);

  // Only show properties that can store THIS vehicle's category — a car only
  // lists garages, an aircraft only lists hangars, etc. counts_as_garage still
  // gates out non-storage properties (businesses, warehouses). The vehicle's
  // current location is always kept selectable so an already-misplaced vehicle
  // can be moved out.
  const vehicleCategory = assetCategoryOf(instance.class);
  const currentPropertyId = instance.storage?.owned_property_id ?? null;
  // Bay-bound vehicles (Facility weaponized vehicles — Khanjali, Chernobog…)
  // live ONLY in their dedicated bay: list only properties of the bay's subtype
  // and hide normal garages/base. Normal vehicles, conversely, never see bays.
  const binding = bayBinding(instance.vehicle_id);
  const storableProperties = ownedProperties.filter((p) => {
    if (p.id === currentPropertyId) return true;
    if (binding) return p.subtype === binding.subtype;
    return (
      p.counts_as_garage && storageAssetCategory(p.subtype) === vehicleCategory
    );
  });
  const selectedProperty = storableProperties.find((p) => p.id === propertyId);
  const installedUpgrades = (
    selectedProperty?.upgrades.filter((u) => u.is_installed && u.capacity > 0) ??
    []
  ).filter((u) => {
    const bayUpg = isBayUpgrade(u.sub_slots);
    // Bay-bound vehicle: only bay upgrades that have a slot for THIS vehicle.
    if (binding)
      return (
        bayUpg &&
        (u.sub_slots?.some((s) =>
          slotAcceptsVehicle(s, instance.vehicle_id),
        ) ?? false)
      );
    // Normal vehicle: never offer vehicle-bound bays.
    return !bayUpg;
  });
  const selectedUpgrade = installedUpgrades.find((u) => u.id === upgradeId);
  // Sub-slots: a vehicle-bound bay only shows its bound vehicle's slot; other
  // sub-slots show unless their required_upgrade_id isn't installed (e.g. the
  // mansion Podium slot only shows when the Car Podium upgrade is on).
  const subSlotsAvailable = selectedUpgrade?.sub_slots
    ? selectedUpgrade.sub_slots.filter((s) => {
        if (isVehicleBoundSlot(s))
          return slotAcceptsVehicle(s, instance.vehicle_id);
        if (!s.required_upgrade_id) return true;
        const req = selectedProperty?.upgrades.find(
          (u) => u.id === s.required_upgrade_id,
        );
        return req?.is_installed ?? false;
      })
    : null;

  // Storage-area choice rules:
  //   - "Base storage" is only an option when the property actually HAS base
  //     capacity (e.g. apartments, bail offices). Properties whose storage
  //     lives entirely on an upgrade (mansion, casino penthouse, vinewood
  //     car club, MC clubhouse, hangar) don't get "Base storage" as a
  //     phantom option — that confused users into thinking there were two
  //     places to park when there's really one.
  //   - If after applying that rule there's only ONE viable area, hide the
  //     dropdown entirely and auto-select it. The "anywhere" still appears
  //     when sub-slots exist (e.g. mansion garage/driveway/podium).
  // Bay-bound vehicles can't use the property's personal/base storage.
  const hasBaseStorage =
    !binding && (selectedProperty?.base_capacity ?? 0) > 0;
  const totalStorageAreas = (hasBaseStorage ? 1 : 0) + installedUpgrades.length;

  // Auto-pick the only upgrade when there's no base + exactly 1 upgrade.
  // useEffect-equivalent guard: only mutate when the current upgradeId is
  // empty/invalid for the current property.
  if (
    selectedProperty &&
    !hasBaseStorage &&
    installedUpgrades.length === 1 &&
    upgradeId !== installedUpgrades[0].id
  ) {
    // setState during render is OK when guarded — React will reschedule.
    // Avoids a separate useEffect that would lag by a render.
    setUpgradeId(installedUpgrades[0].id);
  }

  // Bay-bound vehicle: auto-select its one bay sub-slot (e.g. the Khanjali bay).
  if (
    binding &&
    selectedUpgrade &&
    subSlotsAvailable &&
    subSlotsAvailable.length === 1 &&
    subSlot !== subSlotsAvailable[0].label
  ) {
    setSubSlot(subSlotsAvailable[0].label);
  }

  const handleSave = () => {
    startTransition(async () => {
      const meta = await updateVehicleInstance({
        ownedVehicleId: instance.id,
        nickname: nickname || null,
        notes: notes || null,
        customTags: tags,
      });
      if ("error" in meta) {
        toast.error(meta.error);
        return;
      }

      const storage = await assignVehicleStorage({
        ownedVehicleId: instance.id,
        ownedPropertyId: propertyId || null,
        assignedUpgradeId: upgradeId || null,
        subSlot: subSlot || null,
      });
      if ("error" in storage) {
        toast.error(storage.error);
        return;
      }
      if ("capacityExceeded" in storage) {
        toast.error(
          `Full: ${storage.capacityExceeded.current} / ${storage.capacityExceeded.capacity}`,
        );
        return;
      }
      toast.success("Saved");
      onOpenChange(false);
    });
  };

  const handleRemove = async () => {
    const ok = await confirm({
      title: `Remove ${instance.display_name}?`,
      description: "This vehicle will be removed from your portfolio. You can re-add it from the catalogue any time.",
      confirmText: "Remove vehicle",
      destructive: true,
    });
    if (!ok) return;
    startTransition(async () => {
      const result = await removeVehicleInstance(instance.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("Removed");
      onOpenChange(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FavouriteStar
              instanceId={instance.id}
              initial={instance.is_favourite}
              size={20}
              className="-ml-1"
            />
            <span>{nickname || instance.display_name}</span>
          </SheetTitle>
          <SheetDescription>
            {instance.manufacturer_display} · {instance.class}
            {instance.price !== null && (
              <>
                {" · "}
                <span
                  className="text-emerald-400 tabular-nums"
                  title={formatMoneyFull(instance.price)}
                >
                  {formatMoneyCompact(instance.price)}
                </span>
              </>
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 py-4">
          {/* Storage stays always-visible — it's the functional core. */}
          <div className="flex flex-col gap-2">
            <Label>Storage location</Label>
            <select
              className="rounded-md border bg-background px-3 py-2 text-sm"
              value={propertyId}
              onChange={(e) => {
                setPropertyId(e.target.value);
                setUpgradeId("");
                setSubSlot("");
              }}
            >
              <option value="">— Unassigned —</option>
              {storableProperties.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.display_name} ({p.subtype_display})
                </option>
              ))}
            </select>
            {totalStorageAreas > 1 && (
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={upgradeId}
                onChange={(e) => {
                  setUpgradeId(e.target.value);
                  setSubSlot("");
                }}
              >
                {hasBaseStorage && <option value="">Base storage</option>}
                {installedUpgrades.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.display_name} ({u.capacity})
                  </option>
                ))}
              </select>
            )}
            {subSlotsAvailable && subSlotsAvailable.length > 0 && (
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={subSlot}
                onChange={(e) => setSubSlot(e.target.value)}
              >
                <option value="">— Anywhere in {selectedUpgrade?.display_name} —</option>
                {subSlotsAvailable.map((s) => (
                  <option key={s.label} value={s.label}>
                    {s.label} ({s.cars_here} / {s.capacity})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Collapsed-field pill row — only shows for fields not yet expanded. */}
          {anyCollapsed && (
            <div className="flex flex-wrap gap-2">
              {collapsedButtons
                .filter((b) => !b.expanded)
                .map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={b.expand}
                    className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-foreground/30 px-3 py-1 text-xs text-muted-foreground hover:border-foreground/60 hover:text-foreground transition-colors"
                  >
                    <Plus className="h-3 w-3" /> {b.label}
                  </button>
                ))}
            </div>
          )}

          {showNickname && (
            <ExpandableField
              label="Custom Name"
              onCollapse={() => {
                setNickname("");
                setShowNickname(false);
              }}
            >
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="e.g. Pearl Black Banshee"
                autoFocus={!instance.nickname}
              />
            </ExpandableField>
          )}

          {showTags && (
            <ExpandableField
              label="Highlight features"
              onCollapse={() => {
                setTags([]);
                setShowTags(false);
              }}
            >
              <CustomTagsInput
                value={tags}
                onChange={setTags}
                suggestions={tagSuggestions}
              />
            </ExpandableField>
          )}

          {showNotes && (
            <ExpandableField
              label="Notes"
              onCollapse={() => {
                setNotes("");
                setShowNotes(false);
              }}
            >
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-24 rounded-md border bg-background px-3 py-2 text-sm w-full"
                autoFocus={!instance.notes}
              />
            </ExpandableField>
          )}
        </div>

        <SheetFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleSave} disabled={isPending} className="w-full">
            Save changes
          </Button>
          <Button
            variant="outline"
            onClick={handleRemove}
            disabled={isPending}
            className="w-full border-red-500/50 text-red-300 hover:bg-red-500/10"
          >
            Remove vehicle
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function ExpandableField({
  label,
  children,
  onCollapse,
}: {
  label: string;
  children: React.ReactNode;
  onCollapse: () => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <button
          type="button"
          onClick={onCollapse}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          aria-label={`Clear ${label}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {children}
    </div>
  );
}
