"use client";

import { useState } from "react";

import { PropertyDetail } from "@/components/portfolio/property-detail";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import { storageAssetCategory, ASSET_NOUN } from "@/lib/vehicles";

type Props = {
  properties: OwnedPropertyDetail[];
  instances: OwnedVehicleInstance[];
  tagLookup: Record<string, string>;
};

export function PropertyHubList({ properties, instances, tagLookup }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = properties.find((p) => p.id === selectedId);

  return (
    <>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Your properties — {properties.length} owned</h2>
        <p className="text-sm text-muted-foreground">Click any property to fill in installed upgrades + cars.</p>
        <div className="mt-2 flex flex-col gap-2">
          {properties.map((p) => {
            const totalCap =
              p.base_capacity +
              p.upgrades.filter((u) => u.is_installed).reduce((s, u) => s + u.capacity, 0);
            const noun = ASSET_NOUN[storageAssetCategory(p.subtype)];
            const status =
              p.total_cars === 0
                ? "Empty"
                : p.total_cars >= totalCap && p.installed_upgrades === p.total_upgrades
                  ? `✓ Complete (${p.total_cars} ${noun})`
                  : `⏳ In progress (${p.total_cars} of ~${totalCap})`;
            const borderColor =
              status.startsWith("✓") ? "hsl(142 65% 38%)" :
              status.startsWith("⏳") ? "hsl(48 96% 53%)" : "#444";
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className="flex items-center justify-between rounded-md border p-3 text-left hover:border-foreground/60"
                style={{ borderLeft: `3px solid ${borderColor}` }}
              >
                <div>
                  <p className="text-sm font-medium">{p.display_name}</p>
                  <p className="text-xs text-muted-foreground">{p.subtype_display}</p>
                </div>
                <span className="text-xs text-muted-foreground">{status}</span>
              </button>
            );
          })}
        </div>
      </div>
      <Dialog
        open={!!selected}
        onOpenChange={(o) => !o && setSelectedId(null)}
      >
        {selected && (
          <DialogContent className="max-h-[88vh] max-w-4xl overflow-y-auto">
            <DialogTitle className="sr-only">
              {selected.display_name}
            </DialogTitle>
            <PropertyDetail
              property={selected}
              allOwnedProperties={properties}
              instances={instances}
              tagLookup={tagLookup}
              embedded
              onRemoved={() => setSelectedId(null)}
            />
          </DialogContent>
        )}
      </Dialog>
    </>
  );
}
