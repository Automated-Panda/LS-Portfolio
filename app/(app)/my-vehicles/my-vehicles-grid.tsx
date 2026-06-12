"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { AVAILABILITY_BADGE_CLASS, AVAILABILITY_LABEL, vehicleImageUrl } from "@/lib/vehicles";
import { cn } from "@/lib/utils";
import { isBayUpgrade } from "@/lib/bays";
import { slotLabeler, isFlagSubSlot } from "@/lib/slot-labels";
import { isContainerVehicle } from "@/lib/containers";
import { isSummonOnly, needsBayProperty } from "@/lib/pegasus";
import { groupInstances, type GroupBy } from "@/lib/vehicle-grouping";
import { FavouriteStar } from "@/components/portfolio/favourite-star";
import { InstanceDrawer } from "@/components/portfolio/instance-drawer";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

type Props = {
  instances: OwnedVehicleInstance[];
  ownedProperties: OwnedPropertyDetail[];
  tagLookup: Record<string, string>;
  tagSuggestions?: string[];
  /** Section grouping for the cards. "none" = a single flat grid. */
  groupBy?: GroupBy;
};

export function MyVehiclesGrid({
  instances,
  ownedProperties,
  tagLookup,
  tagSuggestions,
  groupBy = "none",
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const selected = instances.find((i) => i.id === selectedId);

  const toggleCollapsed = (key: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const propById = useMemo(
    () => new Map(ownedProperties.map((p) => [p.id, p])),
    [ownedProperties],
  );
  // Lookup so a nested vehicle's card can name its container vehicle.
  const instById = useMemo(
    () => new Map(instances.map((i) => [i.id, i])),
    [instances],
  );

  const groups = useMemo(
    () => groupInstances(instances, groupBy),
    [instances, groupBy],
  );

  return (
    <>
      <div className="flex flex-col gap-6">
        {groups.map((group) => {
          const isCollapsed = collapsed.has(group.key);
          // Multi-area garages move their cars into subgroups and empty `items`,
          // so the header count must sum the subgroups (else it reads 0).
          const groupCount = group.subgroups
            ? group.subgroups.reduce((s, sg) => s + sg.items.length, 0)
            : group.items.length;
          return (
            <section key={group.key} className="flex flex-col gap-3">
              {group.label && (
                <button
                  type="button"
                  onClick={() => toggleCollapsed(group.key)}
                  className="flex w-fit items-baseline gap-1.5 text-sm font-semibold hover:text-foreground/80"
                  aria-expanded={!isCollapsed}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-4 w-4 self-center" />
                  ) : (
                    <ChevronDown className="h-4 w-4 self-center" />
                  )}
                  {group.label}
                  <span className="text-xs font-normal tabular-nums text-muted-foreground">
                    {groupCount}
                  </span>
                </button>
              )}
              {!isCollapsed &&
                (group.subgroups ? (
                  <div className="flex flex-col gap-4 border-l border-border/60 pl-3">
                    {group.subgroups.map((sub) => {
                      const subCollapsed = collapsed.has(sub.key);
                      return (
                        <div key={sub.key} className="flex flex-col gap-2">
                          <button
                            type="button"
                            onClick={() => toggleCollapsed(sub.key)}
                            className="flex w-fit items-baseline gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
                            aria-expanded={!subCollapsed}
                          >
                            {subCollapsed ? (
                              <ChevronRight className="h-3.5 w-3.5 self-center" />
                            ) : (
                              <ChevronDown className="h-3.5 w-3.5 self-center" />
                            )}
                            {sub.label}
                            <span className="tabular-nums">{sub.items.length}</span>
                          </button>
                          {!subCollapsed && (
                            <CardGrid
                              items={sub.items}
                              propById={propById}
                              instById={instById}
                              ownedProperties={ownedProperties}
                              tagLookup={tagLookup}
                              onSelect={setSelectedId}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <CardGrid
                    items={group.items}
                    propById={propById}
                    instById={instById}
                    ownedProperties={ownedProperties}
                    tagLookup={tagLookup}
                    onSelect={setSelectedId}
                  />
                ))}
            </section>
          );
        })}
      </div>
      {selected && (
        <InstanceDrawer
          instance={selected}
          ownedProperties={ownedProperties}
          tagSuggestions={tagSuggestions}
          open={true}
          onOpenChange={(o) => !o && setSelectedId(null)}
        />
      )}
    </>
  );
}

function CardGrid({
  items,
  propById,
  instById,
  ownedProperties,
  tagLookup,
  onSelect,
}: {
  items: OwnedVehicleInstance[];
  propById: Map<string, OwnedPropertyDetail>;
  instById: Map<string, OwnedVehicleInstance>;
  ownedProperties: OwnedPropertyDetail[];
  tagLookup: Record<string, string>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
      {items.map((inst) => (
        <OwnedCard
          key={inst.id}
          inst={inst}
          propById={propById}
          instById={instById}
          ownedProperties={ownedProperties}
          tagLookup={tagLookup}
          onSelect={() => onSelect(inst.id)}
        />
      ))}
    </div>
  );
}

function OwnedCard({
  inst,
  propById,
  instById,
  ownedProperties,
  tagLookup,
  onSelect,
}: {
  inst: OwnedVehicleInstance;
  propById: Map<string, OwnedPropertyDetail>;
  instById: Map<string, OwnedVehicleInstance>;
  ownedProperties: OwnedPropertyDetail[];
  tagLookup: Record<string, string>;
  onSelect: () => void;
}) {
  const img = vehicleImageUrl(inst.image_path);
  // Nested inside a container vehicle (Terrorbyte/Kosatka/…)? Name the container.
  const container = inst.nested_in
    ? instById.get(inst.nested_in.container_owned_vehicle_id)
    : null;
  const nestedLabel = inst.nested_in
    ? `${container?.nickname || container?.display_name || "container"}${inst.nested_in.bay_label ? ` · ${inst.nested_in.bay_label}` : ""}`
    : null;
  const subLineCompact = inst.storage
    ? `${inst.storage.property_display_name}${inst.storage.upgrade_display_name ? ` · ${inst.storage.upgrade_display_name}` : ""}`
    : null;
  const summonOnly = isSummonOnly(inst, ownedProperties);
  const bayNeed = needsBayProperty(inst, ownedProperties);
  // This vehicle is itself a container (Terrorbyte/Kosatka/…): how many it holds.
  const isContainer = isContainerVehicle(inst.vehicle_id);
  const storesCount = isContainer
    ? [...instById.values()].filter(
        (i) => i.nested_in?.container_owned_vehicle_id === inst.id,
      ).length
    : 0;

  // Slot indicator: a number when placed, ❓ when in a garage but not yet
  // placed, ‼️ when not stored anywhere (and not a summon-only Pegasus).
  const prop = inst.storage ? propById.get(inst.storage.owned_property_id) : null;
  const upg = inst.storage?.assigned_upgrade_id
    ? prop?.upgrades.find((u) => u.id === inst.storage?.assigned_upgrade_id)
    : null;
  const inGarage =
    !!inst.storage && !!prop?.counts_as_garage && !isBayUpgrade(upg?.sub_slots);
  const slot = inst.storage?.slot_number ?? null;
  // Coded slot label for partitioned garages (CEO offices → "1B-2"); bare
  // number elsewhere. Flag chip for Mansion Driveway / Podium.
  const slotText =
    slot != null ? slotLabeler(upg?.sub_slots, upg?.capacity ?? 0)(slot) : null;
  const flag = isFlagSubSlot(upg?.sub_slots, inst.storage?.sub_slot)
    ? inst.storage?.sub_slot
    : null;

  return (
    <div className="relative flex flex-col overflow-hidden rounded-lg border border-emerald-500/70 bg-card ring-2 ring-emerald-500/30 hover:border-foreground/40">
      {/* Star sits as a sibling overlay so we never nest a button in a button. */}
      <FavouriteStar
        instanceId={inst.id}
        initial={inst.is_favourite}
        size={16}
        className="absolute right-1.5 top-1.5 z-10 bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background"
      />
      <button
        type="button"
        onClick={onSelect}
        className="flex flex-col overflow-hidden text-left"
      >
        <div className="relative aspect-video w-full bg-muted">
          {img && (
            <Image
              src={img}
              alt={inst.display_name}
              fill
              className="object-contain"
              loading="lazy"
              sizes="20vw"
            />
          )}
          <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] uppercase text-white">
            {inst.class}
          </span>
          <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1">
            {slot != null ? (
              <span
                className="flex h-6 min-w-6 items-center justify-center rounded-md bg-emerald-600 px-1.5 text-xs font-bold tabular-nums text-white shadow"
                title={`Garage slot ${slotText}`}
              >
                {slotText}
              </span>
            ) : inGarage ? (
              <span
                className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500/90 text-xs shadow"
                title="In a garage but not placed in a numbered slot"
              >
                ❓
              </span>
            ) : !inst.storage &&
              !inst.nested_in &&
              !isContainer &&
              !summonOnly &&
              !bayNeed ? (
              <span
                className="flex h-6 w-6 items-center justify-center rounded-md bg-red-600/90 text-xs shadow"
                title="Not stored in any garage"
              >
                ‼️
              </span>
            ) : null}
            {flag && (
              <span
                className="flex h-6 items-center justify-center rounded-md bg-violet-600 px-1.5 text-[10px] font-semibold uppercase tracking-wide text-white shadow"
                title={`Displayed on the ${flag}`}
              >
                {flag}
              </span>
            )}
          </div>
          {inst.availability !== "available" && (
            <span
              className={cn(
                "absolute bottom-1.5 right-1.5 z-10 rounded-md border px-1.5 py-0.5 text-[10px] font-medium backdrop-blur-sm",
                AVAILABILITY_BADGE_CLASS[inst.availability],
              )}
            >
              {AVAILABILITY_LABEL[inst.availability]}
            </span>
          )}
        </div>
        <div className="flex flex-col gap-1 p-3">
          <p className="text-sm font-medium">{inst.nickname ?? inst.display_name}</p>
          <p className="text-xs text-muted-foreground">
            {inst.manufacturer_display}
          </p>
          {isContainer ? (
            <p className="mt-1 text-xs text-violet-400">
              📦 Stores {storesCount}
              {subLineCompact ? ` · 📍 ${subLineCompact}` : ""}
            </p>
          ) : subLineCompact ? (
            <p className="mt-1 text-xs text-amber-400">📍 {subLineCompact}</p>
          ) : nestedLabel ? (
            <p className="mt-1 text-xs text-violet-400">📦 in {nestedLabel}</p>
          ) : summonOnly ? (
            <p className="mt-1 text-xs text-sky-400">✈️ Pegasus · summon</p>
          ) : bayNeed ? (
            <p className="mt-1 text-xs text-orange-400">
              ⚠️ Needs a {bayNeed.label}
            </p>
          ) : (
            <p className="mt-1 text-xs text-red-400">📍 Not stored →</p>
          )}
          <div className="mt-1 flex flex-wrap gap-1">
            {inst.tag_ids.slice(0, 3).map((id) => (
              <Badge key={id} variant="outline" className="text-[10px]">
                {tagLookup[id] ?? id}
              </Badge>
            ))}
            {inst.custom_tags.slice(0, 3).map((t) => (
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
