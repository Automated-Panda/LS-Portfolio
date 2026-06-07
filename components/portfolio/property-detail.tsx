"use client";

import { ArrowLeft, Plus, Settings2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { FavouriteStar } from "@/components/portfolio/favourite-star";
import { InstanceDrawer } from "@/components/portfolio/instance-drawer";
import { usePropertyUpgrades } from "@/components/portfolio/use-property-upgrades";
import { GarageGrid } from "@/components/portfolio/garage-grid";
import { VehiclePickerModal } from "@/components/portfolio/vehicle-picker-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { assignVehicleStorage } from "@/app/(app)/my-vehicles/actions";
import { unownProperty } from "@/app/(app)/properties/actions";
import { formatMoneyCompact, formatMoneyFull } from "@/lib/format";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import { ASSET_NOUN, storageAssetCategory, vehicleImageUrl } from "@/lib/vehicles";
import { isBayUpgrade, slotVehicleIds } from "@/lib/bays";
import { slotLabeler, slotMode } from "@/lib/slot-labels";

type Props = {
  property: OwnedPropertyDetail;
  allOwnedProperties: OwnedPropertyDetail[];
  instances: OwnedVehicleInstance[];
  tagLookup: Record<string, string>;
  /** Embedded (e.g. wizard dialog): hides the back link and, on remove, calls
   *  onRemoved instead of navigating. */
  embedded?: boolean;
  /** Override the back-link target. Defaults to the asset's owned-list page. */
  backHref?: string;
  /** Called after the property is removed. Defaults to navigating to the list. */
  onRemoved?: () => void;
};

type PickerTarget = {
  upgradeId: string | null;
  label: string;
  capacity: number;
  current: number;
  /** For vehicle-bound bays: restrict the picker to these vehicle ids. */
  allowedVehicleIds?: string[];
};

export function PropertyDetail({
  property,
  allOwnedProperties,
  instances,
  tagLookup,
  embedded = false,
  backHref,
  onRemoved,
}: Props) {
  const router = useRouter();
  const confirm = useConfirm();
  const [isPending, startTransition] = useTransition();
  const { isInstalled, handleToggleUpgrade, handleSetAllUpgrades } =
    usePropertyUpgrades(property);

  const [pickerTarget, setPickerTarget] = useState<PickerTarget | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [managedInstanceId, setManagedInstanceId] = useState<string | null>(
    null,
  );

  const isBusiness = property.property_type === "business";
  const listHref = backHref ?? (isBusiness ? "/my-businesses" : "/my-properties");
  const listLabel = isBusiness ? "My Businesses" : "My Properties";

  const tagSuggestions = useMemo(
    () => Array.from(new Set(instances.flatMap((i) => i.custom_tags))).sort(),
    [instances],
  );

  const noun = ASSET_NOUN[storageAssetCategory(property.subtype)];

  // Vehicles stored at THIS property, grouped by assigned_upgrade_id (null = base).
  const carsHere = instances.filter(
    (v) => v.storage?.owned_property_id === property.id,
  );
  const carsByUpgrade = useMemo(() => {
    const m = new Map<string | null, OwnedVehicleInstance[]>();
    for (const v of carsHere) {
      const key = v.storage?.assigned_upgrade_id ?? null;
      const arr = m.get(key) ?? [];
      arr.push(v);
      m.set(key, arr);
    }
    return m;
  }, [carsHere]);

  // Storage areas: base (if it has capacity) + every installed, capacity-bearing
  // upgrade (storage upgrades, mansion garage, garage floors, etc.). One section
  // each — mirrors the data model so floors/podium stay addressable.
  const storageUpgrades = property.upgrades.filter(
    (u) => u.capacity > 0 && u.is_installed,
  );
  const hasAnyStorage = property.base_capacity > 0 || storageUpgrades.length > 0;

  // A car garage gets the numbered-slot grid; hangars/docks and weaponized bays
  // keep the plain card list. Base storage has no sub_slots so it's a garage iff
  // the property counts as one.
  const baseIsGarage = property.counts_as_garage;
  const areaCount = (property.base_capacity > 0 ? 1 : 0) + storageUpgrades.length;
  // Multi-area properties (Vinewood/Eclipse floors) get collapsible sections.
  const collapsible = areaCount > 1;

  // Upgrades checklist (Storage upgrades + Equipment), hiding included_on_purchase
  // rows — those aren't user choices.
  const checklistRows = property.upgrades.filter((u) => !u.included_on_purchase);
  const storageChecklist = checklistRows.filter((u) => u.capacity > 0);
  const equipmentChecklist = checklistRows.filter((u) => u.capacity === 0);

  const openPicker = (t: PickerTarget) => {
    setPickerTarget(t);
    setPickerOpen(true);
  };

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

  const kindLabel = isBusiness ? "business" : "property";

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
        if (onRemoved) onRemoved();
        else router.push(listHref);
      }
    });
  };

  const managed = instances.find((v) => v.id === managedInstanceId);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        {!embedded && (
          <Link
            href={listHref}
            className="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> {listLabel}
          </Link>
        )}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{property.display_name}</h1>
            <p className="text-sm text-muted-foreground">
              {property.subtype_display}
              {property.neighborhood ? ` · ${property.neighborhood}` : ""}
              {property.price !== null && (
                <>
                  {" · "}
                  <span
                    className="tabular-nums text-emerald-400"
                    title={formatMoneyFull(property.price)}
                  >
                    {formatMoneyCompact(property.price)}
                  </span>
                </>
              )}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleUnown}
            disabled={isPending}
            className="border-red-500/50 text-red-300 hover:bg-red-500/10"
          >
            Remove {kindLabel}
          </Button>
        </div>
      </div>

      {/* Storage — the card grid the user came here for. */}
      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Storage
        </h2>

        {property.subtype === "mckenzie-hangar" && (
          <p className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-muted-foreground">
            The McKenzie Field Hangar has no storage of its own. While you own
            it, your Hangar holds{" "}
            <span className="text-emerald-400">+15 aircraft</span> (
            <span className="text-emerald-400">+20</span> with GTA+).
          </p>
        )}

        {!hasAnyStorage ? (
          <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            No storage available yet
            {checklistRows.length > 0
              ? " — install a storage upgrade below."
              : "."}
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {property.base_capacity > 0 &&
              (baseIsGarage ? (
                <GarageGrid
                  ownedPropertyId={property.id}
                  assignedUpgradeId={null}
                  label={property.subtype_display}
                  capacity={property.base_capacity}
                  cars={carsByUpgrade.get(null) ?? []}
                  noun={noun}
                  tagLookup={tagLookup}
                  collapsible={collapsible}
                  onAdd={() =>
                    openPicker({
                      upgradeId: null,
                      label: "Base storage",
                      capacity: property.base_capacity,
                      current: (carsByUpgrade.get(null) ?? []).length,
                    })
                  }
                  onManage={setManagedInstanceId}
                  onRemove={handleRemoveFromStorage}
                />
              ) : (
                <StorageArea
                  label={property.subtype_display}
                  capacity={property.base_capacity}
                  cars={carsByUpgrade.get(null) ?? []}
                  noun={noun}
                  tagLookup={tagLookup}
                  isPending={isPending}
                  onAdd={() =>
                    openPicker({
                      upgradeId: null,
                      label: "Base storage",
                      capacity: property.base_capacity,
                      current: (carsByUpgrade.get(null) ?? []).length,
                    })
                  }
                  onManage={setManagedInstanceId}
                  onRemove={handleRemoveFromStorage}
                />
              ))}
            {storageUpgrades.map((u) => {
              const upgradeIsGarage =
                property.counts_as_garage && !isBayUpgrade(u.sub_slots);
              return upgradeIsGarage ? (
                <GarageGrid
                  key={u.id}
                  ownedPropertyId={property.id}
                  assignedUpgradeId={u.id}
                  label={u.display_name}
                  capacity={u.capacity}
                  cars={carsByUpgrade.get(u.id) ?? []}
                  noun={noun}
                  tagLookup={tagLookup}
                  collapsible={collapsible}
                  slotLabel={slotLabeler(u.sub_slots, u.capacity)}
                  subSlots={
                    slotMode(u.sub_slots, u.capacity) === "flags"
                      ? u.sub_slots ?? undefined
                      : undefined
                  }
                  onAdd={() =>
                    openPicker({
                      upgradeId: u.id,
                      label: u.display_name,
                      capacity: u.capacity,
                      current: u.cars_here,
                    })
                  }
                  onManage={setManagedInstanceId}
                  onRemove={handleRemoveFromStorage}
                />
              ) : (
                <StorageArea
                  key={u.id}
                  label={u.display_name}
                  capacity={u.capacity}
                  cars={carsByUpgrade.get(u.id) ?? []}
                  noun={noun}
                  tagLookup={tagLookup}
                  isPending={isPending}
                  onAdd={() =>
                    openPicker({
                      upgradeId: u.id,
                      label: u.display_name,
                      capacity: u.capacity,
                      current: u.cars_here,
                      allowedVehicleIds: isBayUpgrade(u.sub_slots)
                        ? (u.sub_slots ?? []).flatMap((s) => slotVehicleIds(s))
                        : undefined,
                    })
                  }
                  onManage={setManagedInstanceId}
                  onRemove={handleRemoveFromStorage}
                />
              );
            })}
          </div>
        )}
      </section>

      {/* Upgrades checklist */}
      {checklistRows.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Upgrades
            </h2>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSetAllUpgrades(true)}
                disabled={isPending}
              >
                ✓ Install all
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSetAllUpgrades(false)}
                disabled={isPending}
              >
                Uninstall all
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {storageChecklist.length > 0 && (
              <UpgradeChecklist
                title="Storage upgrades"
                rows={storageChecklist}
                property={property}
                isInstalled={isInstalled}
                onToggle={handleToggleUpgrade}
                showCapacity
              />
            )}
            {equipmentChecklist.length > 0 && (
              <UpgradeChecklist
                title="Equipment & security"
                rows={equipmentChecklist}
                property={property}
                isInstalled={isInstalled}
                onToggle={handleToggleUpgrade}
              />
            )}
          </div>
        </section>
      )}

      {pickerTarget && (
        <VehiclePickerModal
          ownedPropertyId={property.id}
          assignedUpgradeId={pickerTarget.upgradeId}
          label={`${property.display_name} · ${pickerTarget.label}`}
          capacity={pickerTarget.capacity}
          currentCount={pickerTarget.current}
          assetCategory={storageAssetCategory(property.subtype)}
          allowedVehicleIds={pickerTarget.allowedVehicleIds}
          open={pickerOpen}
          onOpenChange={setPickerOpen}
        />
      )}

      {managed && (
        <InstanceDrawer
          instance={managed}
          ownedProperties={allOwnedProperties}
          tagSuggestions={tagSuggestions}
          open={true}
          onOpenChange={(o) => !o && setManagedInstanceId(null)}
        />
      )}
    </div>
  );
}

type UpgradeRow = OwnedPropertyDetail["upgrades"][number];

/** One storage area: heading + capacity, a card grid of stored vehicles, and an
 *  "+ Add" card that opens the picker for this area. */
function StorageArea({
  label,
  capacity,
  cars,
  noun,
  tagLookup,
  isPending,
  onAdd,
  onManage,
  onRemove,
}: {
  label: string;
  capacity: number;
  cars: OwnedVehicleInstance[];
  noun: string;
  tagLookup: Record<string, string>;
  isPending: boolean;
  onAdd: () => void;
  onManage: (instanceId: string) => void;
  onRemove: (instanceId: string, displayName: string) => void;
}) {
  const full = cars.length >= capacity;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{label}</h3>
        <span className="text-xs tabular-nums text-muted-foreground">
          {cars.length} / {capacity}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {cars.map((v) => (
          <VehicleSlotCard
            key={v.id}
            instance={v}
            tagLookup={tagLookup}
            isPending={isPending}
            onManage={() => onManage(v.id)}
            onRemove={() => onRemove(v.id, v.nickname || v.display_name)}
          />
        ))}
        {!full && (
          <button
            type="button"
            onClick={onAdd}
            className="flex h-full min-h-[140px] flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-foreground/30 text-muted-foreground transition-colors hover:border-foreground/60 hover:bg-muted/30 hover:text-foreground"
          >
            <Plus className="h-5 w-5" />
            <span className="text-xs">Add {noun}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function VehicleSlotCard({
  instance,
  tagLookup,
  isPending,
  onManage,
  onRemove,
}: {
  instance: OwnedVehicleInstance;
  tagLookup: Record<string, string>;
  isPending: boolean;
  onManage: () => void;
  onRemove: () => void;
}) {
  const img = vehicleImageUrl(instance.image_path);
  const name = instance.nickname || instance.display_name;
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-lg border border-emerald-500/70 bg-card ring-2 ring-emerald-500/30 hover:border-foreground/40">
      {/* Top-right cluster: star always visible; manage + unassign on hover.
          Mirrors the /my-vehicles card (class badge top-left, star top-right). */}
      <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-0.5">
        <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            onClick={onManage}
            disabled={isPending}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm hover:text-foreground disabled:opacity-50"
            aria-label={`Manage ${name}`}
            title="Manage nickname, tags, notes, storage"
          >
            <Settings2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={isPending}
            className="flex h-7 w-7 items-center justify-center rounded-md bg-background/90 text-xs text-muted-foreground shadow-sm hover:bg-red-500/10 hover:text-red-300 disabled:opacity-50"
            aria-label={`Remove ${name} from this slot`}
            title="Remove from this slot"
          >
            ✕
          </button>
        </div>
        <FavouriteStar
          instanceId={instance.id}
          initial={instance.is_favourite}
          size={16}
          className="bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background"
        />
      </div>
      <button
        type="button"
        onClick={onManage}
        className="flex flex-col text-left"
      >
        <div className="relative aspect-video w-full bg-muted">
          {img && (
            <Image
              src={img}
              alt={instance.display_name}
              fill
              className="object-contain"
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
      </button>
    </div>
  );
}

function UpgradeChecklist({
  title,
  rows,
  property,
  isInstalled,
  onToggle,
  showCapacity = false,
}: {
  title: string;
  rows: UpgradeRow[];
  property: OwnedPropertyDetail;
  isInstalled: (id: string, fallback: boolean) => boolean;
  onToggle: (id: string, currentlyInstalled: boolean) => void;
  showCapacity?: boolean;
}) {
  return (
    <Card className="p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-col gap-0.5">
        {rows.map((u) => {
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
              className="flex cursor-pointer items-center gap-2 rounded-md p-2 hover:bg-muted/50"
              style={{ opacity: prereqMet ? 1 : 0.5 }}
            >
              <input
                type="checkbox"
                checked={installed}
                disabled={!prereqMet}
                onChange={() => onToggle(u.id, installed)}
              />
              <span className="flex-1 text-sm">{u.display_name}</span>
              {u.price !== null && (
                <span
                  className="text-[10px] tabular-nums text-emerald-300/70"
                  title={formatMoneyFull(u.price)}
                >
                  {formatMoneyCompact(u.price)}
                </span>
              )}
              {showCapacity && (
                <Badge variant="outline" className="text-[10px]">
                  {u.capacity}
                </Badge>
              )}
            </label>
          );
        })}
      </div>
    </Card>
  );
}
