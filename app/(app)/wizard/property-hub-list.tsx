"use client";

import { useState } from "react";

import { PropertyDrawer } from "@/components/portfolio/property-drawer";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

type Props = { properties: OwnedPropertyDetail[] };

export function PropertyHubList({ properties }: Props) {
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
            const status =
              p.total_cars === 0
                ? "Empty"
                : p.total_cars >= totalCap && p.installed_upgrades === p.total_upgrades
                  ? `✓ Complete (${p.total_cars} cars)`
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
      {selected && (
        <PropertyDrawer
          property={selected}
          allOwnedProperties={properties}
          open={true}
          onOpenChange={(o) => !o && setSelectedId(null)}
        />
      )}
    </>
  );
}
