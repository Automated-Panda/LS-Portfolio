"use client";

import { Minus, Plus, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
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
import {
  setVehicleSlot,
  swapVehicleSlots,
} from "@/app/(app)/my-vehicles/slot-actions";
import {
  assignVehicleToContainer,
  getContainerDetail,
  getOwnedContainersForStorable,
  setVehicleUpgrade,
  type ContainerDetail,
  type ContainerOption,
} from "@/app/(app)/my-vehicles/container-actions";
import { bayForStoredVehicle, isContainerVehicle } from "@/lib/containers";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

import { formatMoneyCompact, formatMoneyFull } from "@/lib/format";
import { clampSlot } from "@/lib/slots";
import { assetCategoryOf, propertyAcceptsVehicleCategory } from "@/lib/vehicles";
import { bayBinding, isBayUpgrade, isVehicleBoundSlot, slotAcceptsVehicle } from "@/lib/bays";
import { flagSections, slotLabeler, slotMode } from "@/lib/slot-labels";

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
  const [slotValue, setSlotValue] = useState<number | null>(
    instance.storage?.slot_number ?? null,
  );
  const [slotBusy, setSlotBusy] = useState(false);
  const [isPending, startTransition] = useTransition();
  const confirm = useConfirm();

  // Container nesting (child side): this vehicle can live inside a container
  // vehicle (e.g. Oppressor Mk II → Terrorbyte). Load the owned containers that
  // accept it; `containerKey` = "<ownedVehicleId>::<bayLabel>" or "".
  const childBay = bayForStoredVehicle(instance.vehicle_id);
  const [containerOptions, setContainerOptions] = useState<ContainerOption[]>([]);
  const [containerKey, setContainerKey] = useState(
    instance.nested_in
      ? `${instance.nested_in.container_owned_vehicle_id}::${instance.nested_in.bay_label ?? ""}`
      : "",
  );
  useEffect(() => {
    if (!open || !childBay) return;
    let active = true;
    getOwnedContainersForStorable(instance.vehicle_id).then((opts) => {
      if (active) setContainerOptions(opts);
    });
    return () => {
      active = false;
    };
  }, [open, childBay, instance.vehicle_id]);

  // Container side: when THIS vehicle is a container (Terrorbyte/Kosatka/…),
  // load its upgrades + bays + nested vehicles for the management panel.
  const isContainer = isContainerVehicle(instance.vehicle_id);
  const [detail, setDetail] = useState<ContainerDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const reloadDetail = async () => {
    const d = await getContainerDetail(instance.id);
    setDetail(d);
  };
  useEffect(() => {
    if (!open || !isContainer) return;
    let active = true;
    getContainerDetail(instance.id).then((d) => {
      if (active) setDetail(d);
    });
    return () => {
      active = false;
    };
  }, [open, isContainer, instance.id]);

  const toggleUpgrade = async (vehicleUpgradeId: string, install: boolean) => {
    if (detailBusy) return;
    setDetailBusy(true);
    try {
      const r = await setVehicleUpgrade({
        ownedVehicleId: instance.id,
        vehicleUpgradeId,
        install,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      await reloadDetail();
    } finally {
      setDetailBusy(false);
    }
  };

  const unnestFromBay = async (nestedInstanceId: string, name: string) => {
    if (detailBusy) return;
    setDetailBusy(true);
    try {
      const r = await assignVehicleStorage({
        ownedVehicleId: nestedInstanceId,
        ownedPropertyId: null,
        assignedUpgradeId: null,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(`Removed ${name}`);
      await reloadDetail();
    } finally {
      setDetailBusy(false);
    }
  };

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
    // Must accept this vehicle's category (hangars for aircraft, yachts for
    // boats, garages for cars) AND actually have somewhere to park it.
    if (!propertyAcceptsVehicleCategory(p, vehicleCategory)) return false;
    return (
      p.base_capacity > 0 ||
      p.upgrades.some((u) => u.is_installed && u.capacity > 0)
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

  // How the selected upgrade's sub_slots behave:
  //   bay       → vehicle-bound dropdown (existing).
  //   partition → CEO office levels: no sub_slot UI; the numbered slot grid
  //               carries the section code (1A-1…), so sub_slot stays null.
  //   flags     → Mansion Driveway / Podium: a toggle layered on the 1..N grid.
  const selectedMode = slotMode(
    selectedUpgrade?.sub_slots,
    selectedUpgrade?.capacity ?? 0,
  );
  const flagLabelSet = new Set(
    selectedUpgrade?.sub_slots
      ? flagSections(selectedUpgrade.sub_slots).map((s) => s.label)
      : [],
  );
  // Display-flag options (Driveway/Podium) whose gating upgrade is installed.
  const flagOpts =
    selectedMode === "flags" && selectedUpgrade?.sub_slots
      ? selectedUpgrade.sub_slots.filter((s) => {
          if (!flagLabelSet.has(s.label)) return false;
          if (!s.required_upgrade_id) return true;
          const req = selectedProperty?.upgrades.find(
            (u) => u.id === s.required_upgrade_id,
          );
          return req?.is_installed ?? false;
        })
      : [];
  // What to persist as sub_slot: never for a partition (slot grid owns it),
  // the chosen flag for a flags area, the dropdown value otherwise.
  const subSlotToSave =
    selectedMode === "partition"
      ? null
      : selectedMode === "flags"
        ? flagLabelSet.has(subSlot)
          ? subSlot
          : null
        : subSlot || null;

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

  // Numbered garage slot. Only meaningful while the car sits in a CAR garage and
  // the drawer has no pending move to a different area (saving the move resets
  // the slot). Acts immediately (like the favourite star), independent of Save.
  const savedProp = ownedProperties.find(
    (p) => p.id === (instance.storage?.owned_property_id ?? ""),
  );
  const savedUpgrade = instance.storage?.assigned_upgrade_id
    ? savedProp?.upgrades.find(
        (u) => u.id === instance.storage?.assigned_upgrade_id,
      )
    : null;
  const slotAreaCapacity = savedUpgrade
    ? savedUpgrade.capacity
    : (savedProp?.base_capacity ?? 0);
  // For CEO offices the numbered slot maps to a section code ("1B-2"); show it
  // alongside the stepper so the number isn't ambiguous.
  const savedSlotCode =
    slotMode(savedUpgrade?.sub_slots, savedUpgrade?.capacity ?? 0) ===
      "partition" && slotValue != null
      ? slotLabeler(savedUpgrade?.sub_slots, savedUpgrade?.capacity ?? 0)(
          slotValue,
        )
      : null;
  const pendingAreaChange =
    (propertyId || null) !== (instance.storage?.owned_property_id ?? null) ||
    (upgradeId || null) !== (instance.storage?.assigned_upgrade_id ?? null);
  const showSlot =
    !!instance.storage &&
    !!savedProp?.counts_as_garage &&
    !isBayUpgrade(savedUpgrade?.sub_slots) &&
    slotAreaCapacity > 0 &&
    !pendingAreaChange;

  const commitSlot = async (next: number | null) => {
    if (slotBusy) return;
    const prev = slotValue;
    setSlotValue(next); // optimistic
    setSlotBusy(true);
    try {
      const r = await setVehicleSlot({
        ownedVehicleId: instance.id,
        slotNumber: next,
      });
      if ("error" in r) {
        toast.error(r.error);
        setSlotValue(prev);
        return;
      }
      if ("occupied" in r) {
        // Confirm OUTSIDE any transition (awaiting confirm in a transition
        // silently no-ops — see the organizer delete-chat fix).
        const ok = await confirm({
          title: `Slot ${r.occupied.slot} is taken`,
          description: `${r.occupied.byName} is already in slot ${r.occupied.slot}. Swap them so this vehicle takes the spot?`,
          confirmText: "Swap",
        });
        if (!ok) {
          setSlotValue(prev);
          return;
        }
        const sw = await swapVehicleSlots({
          aId: instance.id,
          bId: r.occupied.byInstanceId,
        });
        if ("error" in sw) {
          toast.error(sw.error);
          setSlotValue(prev);
          return;
        }
        setSlotValue(r.occupied.slot);
        toast.success(`Moved to slot ${r.occupied.slot}`);
        return;
      }
      toast.success(next === null ? "Un-placed" : `Set to slot ${next}`);
    } finally {
      setSlotBusy(false);
    }
  };

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

      // Nesting into a container vehicle takes precedence over a property.
      if (containerKey) {
        const [cid, blabel] = containerKey.split("::");
        const r = await assignVehicleToContainer({
          ownedVehicleId: instance.id,
          containerOwnedVehicleId: cid,
          bayLabel: blabel,
        });
        if ("error" in r) {
          toast.error(r.error);
          return;
        }
        if ("capacityExceeded" in r) {
          toast.error(
            `Full: ${r.capacityExceeded.current} / ${r.capacityExceeded.capacity}`,
          );
          return;
        }
        toast.success("Saved");
        onOpenChange(false);
        return;
      }

      const storage = await assignVehicleStorage({
        ownedVehicleId: instance.id,
        ownedPropertyId: propertyId || null,
        assignedUpgradeId: upgradeId || null,
        subSlot: subSlotToSave,
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
                if (e.target.value) setContainerKey(""); // un-nest if picking a property
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
            {selectedMode === "bay" &&
              subSlotsAvailable &&
              subSlotsAvailable.length > 0 && (
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm"
                  value={subSlot}
                  onChange={(e) => setSubSlot(e.target.value)}
                >
                  <option value="">
                    — Anywhere in {selectedUpgrade?.display_name} —
                  </option>
                  {subSlotsAvailable.map((s) => (
                    <option key={s.label} value={s.label}>
                      {s.label} ({s.cars_here} / {s.capacity})
                    </option>
                  ))}
                </select>
              )}

            {/* Mansion display spots — flag a parked car as Driveway / Podium.
                The car keeps its numbered slot; this is just a display tag. */}
            {selectedMode === "flags" && flagOpts.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs text-muted-foreground">
                  Display spot
                </Label>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSubSlot("")}
                    className={`rounded-md border px-2.5 py-1 text-xs ${
                      flagLabelSet.has(subSlot)
                        ? "hover:bg-muted"
                        : "border-violet-500 bg-violet-500/15 text-violet-200"
                    }`}
                  >
                    Normal
                  </button>
                  {flagOpts.map((s) => (
                    <button
                      key={s.label}
                      type="button"
                      onClick={() => setSubSlot(s.label)}
                      className={`rounded-md border px-2.5 py-1 text-xs ${
                        subSlot === s.label
                          ? "border-violet-500 bg-violet-500/15 text-violet-200"
                          : "hover:bg-muted"
                      }`}
                    >
                      {s.label}{" "}
                      <span className="opacity-70 tabular-nums">
                        ({s.cars_here}/{s.capacity})
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {showSlot && (
              <div className="flex flex-col gap-1.5 rounded-md border bg-muted/20 p-2.5">
                <Label className="text-xs">
                  Garage slot{" "}
                  <span className="text-muted-foreground">
                    (1–{slotAreaCapacity})
                  </span>
                  {savedSlotCode && (
                    <span className="ml-1 font-semibold text-emerald-400">
                      · {savedSlotCode}
                    </span>
                  )}
                </Label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={slotBusy}
                    onClick={() =>
                      commitSlot(
                        slotValue == null
                          ? 1
                          : clampSlot(slotValue - 1, slotAreaCapacity),
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted disabled:opacity-50"
                    aria-label="Lower slot"
                  >
                    <Minus className="h-3.5 w-3.5" />
                  </button>
                  <input
                    type="number"
                    min={1}
                    max={slotAreaCapacity}
                    inputMode="numeric"
                    disabled={slotBusy}
                    value={slotValue ?? ""}
                    placeholder="—"
                    onChange={(e) => {
                      const raw = e.target.value;
                      setSlotValue(raw === "" ? null : Number(raw));
                    }}
                    onBlur={(e) => {
                      const raw = e.target.value;
                      if (raw === "") return;
                      const n = clampSlot(Number(raw), slotAreaCapacity);
                      if (n !== (instance.storage?.slot_number ?? null))
                        commitSlot(n);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") e.currentTarget.blur();
                    }}
                    className="h-8 w-16 rounded-md border bg-background px-2 text-center text-sm tabular-nums disabled:opacity-50"
                  />
                  <button
                    type="button"
                    disabled={slotBusy}
                    onClick={() =>
                      commitSlot(
                        slotValue == null
                          ? 1
                          : clampSlot(slotValue + 1, slotAreaCapacity),
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-md border hover:bg-muted disabled:opacity-50"
                    aria-label="Raise slot"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                  {slotValue != null && (
                    <button
                      type="button"
                      disabled={slotBusy}
                      onClick={() => commitSlot(null)}
                      className="ml-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Un-place
                    </button>
                  )}
                </div>
                {slotValue == null && (
                  <p className="text-[11px] text-muted-foreground">
                    ❓ Unplaced — pick a numbered spot, or drag it on the garage
                    page.
                  </p>
                )}
              </div>
            )}

            {/* Container nesting — store this vehicle inside a Terrorbyte /
                Kosatka / Acid Lab etc. you own. */}
            {childBay && (containerOptions.length > 0 || instance.nested_in) && (
              <select
                className="rounded-md border bg-background px-3 py-2 text-sm"
                value={containerKey}
                onChange={(e) => {
                  setContainerKey(e.target.value);
                  if (e.target.value) {
                    // Nesting un-assigns from any property.
                    setPropertyId("");
                    setUpgradeId("");
                    setSubSlot("");
                  }
                }}
              >
                <option value="">— Not stored in a container —</option>
                {containerOptions.map((o) => (
                  <option
                    key={`${o.containerOwnedVehicleId}::${o.bayLabel}`}
                    value={`${o.containerOwnedVehicleId}::${o.bayLabel}`}
                  >
                    📦 {o.containerDisplayName} · {o.bayLabel} ({o.used}/
                    {o.capacity})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Container management — when THIS vehicle stores others. */}
          {isContainer && detail && (
            <div className="flex flex-col gap-3 rounded-md border bg-muted/10 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Stored vehicles
              </p>
              <div className="flex flex-col gap-1.5">
                {detail.bays.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    No bays yet — install a storage upgrade below.
                  </p>
                )}
                {detail.bays.map((bay) => {
                  const occupant = detail.nested.find(
                    (n) => n.bayLabel === bay.label,
                  );
                  return (
                    <div
                      key={bay.label}
                      className="flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm"
                    >
                      <span className="text-muted-foreground">📦 {bay.label}</span>
                      {occupant ? (
                        <span className="flex items-center gap-2">
                          <span className="truncate">{occupant.name}</span>
                          <button
                            type="button"
                            disabled={detailBusy}
                            onClick={() =>
                              unnestFromBay(occupant.instanceId, occupant.name)
                            }
                            className="text-muted-foreground hover:text-red-300 disabled:opacity-50"
                            aria-label={`Remove ${occupant.name}`}
                            title="Remove from this container"
                          >
                            ✕
                          </button>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Empty</span>
                      )}
                    </div>
                  );
                })}
              </div>

              {detail.upgrades.some((u) => !u.included_on_purchase) && (
                <div className="flex flex-col gap-0.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Upgrades
                  </p>
                  {detail.upgrades
                    .filter((u) => !u.included_on_purchase)
                    .map((u) => (
                      <label
                        key={u.id}
                        className="flex cursor-pointer items-center gap-2 rounded-md p-1.5 text-sm hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          checked={u.is_installed}
                          disabled={detailBusy}
                          onChange={() => toggleUpgrade(u.id, !u.is_installed)}
                        />
                        <span className="flex-1">{u.display_name}</span>
                        {u.price !== null && (
                          <span
                            className="text-[10px] tabular-nums text-emerald-300/70"
                            title={formatMoneyFull(u.price)}
                          >
                            {formatMoneyCompact(u.price)}
                          </span>
                        )}
                      </label>
                    ))}
                </div>
              )}
            </div>
          )}

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
