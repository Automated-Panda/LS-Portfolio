"use client";

import { useState } from "react";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { vehicleImageUrl } from "@/lib/vehicles";
import { FavouriteStar } from "@/components/portfolio/favourite-star";
import { InstanceDrawer } from "@/components/portfolio/instance-drawer";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

type Props = {
  instances: OwnedVehicleInstance[];
  ownedProperties: OwnedPropertyDetail[];
  tagLookup: Record<string, string>;
  tagSuggestions?: string[];
};

export function MyVehiclesGrid({
  instances,
  ownedProperties,
  tagLookup,
  tagSuggestions,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = instances.find((i) => i.id === selectedId);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
        {instances.map((inst) => {
          const img = vehicleImageUrl(inst.image_path);
          const subLineCompact = inst.storage
            ? `${inst.storage.property_display_name}${inst.storage.upgrade_display_name ? ` · ${inst.storage.upgrade_display_name}` : ""}`
            : null;
          return (
            <div
              key={inst.id}
              className="relative flex flex-col overflow-hidden rounded-lg border border-emerald-500/70 bg-card ring-2 ring-emerald-500/30 hover:border-foreground/40"
            >
              {/* Star sits as a sibling overlay so we never nest a button in a button. */}
              <FavouriteStar
                instanceId={inst.id}
                initial={inst.is_favourite}
                size={16}
                className="absolute right-1.5 top-1.5 z-10 bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background"
              />
              <button
                type="button"
                onClick={() => setSelectedId(inst.id)}
                className="flex flex-col overflow-hidden text-left"
              >
              <div className="relative aspect-video w-full bg-muted">
                {img && (
                  <Image src={img} alt={inst.display_name} fill className="object-contain" loading="lazy" sizes="20vw" />
                )}
                <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] uppercase text-white">
                  {inst.class}
                </span>
              </div>
              <div className="flex flex-col gap-1 p-3">
                <p className="text-sm font-medium">
                  {inst.nickname ?? inst.display_name}
                </p>
                <p className="text-xs text-muted-foreground">{inst.manufacturer_display}</p>
                {subLineCompact ? (
                  <p className="mt-1 text-xs text-amber-400">📍 {subLineCompact}</p>
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
                    <Badge key={t} variant="outline" className="border-amber-500/40 text-amber-300 text-[10px]">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
              </button>
            </div>
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
