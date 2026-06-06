"use client";

import { useState } from "react";

import { InstanceDrawer } from "@/components/portfolio/instance-drawer";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

type Props = {
  instances: OwnedVehicleInstance[];
  ownedProperties: OwnedPropertyDetail[];
  tagSuggestions?: string[];
};

type SortKey =
  | "display_name"
  | "class"
  | "manufacturer_display"
  | "property"
  | "upgrade"
  | "slot";

export function MyVehiclesTable({
  instances,
  ownedProperties,
  tagSuggestions,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("display_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const selected = instances.find((i) => i.id === selectedId);

  const sorted = [...instances].sort((a, b) => {
    if (sortKey === "slot") {
      // Unplaced sort last (asc). Big sentinel keeps them at the bottom.
      const av = a.storage?.slot_number ?? Number.MAX_SAFE_INTEGER;
      const bv = b.storage?.slot_number ?? Number.MAX_SAFE_INTEGER;
      const cmp = av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    }
    const av =
      sortKey === "property"
        ? a.storage?.property_display_name ?? ""
        : sortKey === "upgrade"
          ? a.storage?.upgrade_display_name ?? ""
          : (a as unknown as Record<string, string>)[sortKey] ?? "";
    const bv =
      sortKey === "property"
        ? b.storage?.property_display_name ?? ""
        : sortKey === "upgrade"
          ? b.storage?.upgrade_display_name ?? ""
          : (b as unknown as Record<string, string>)[sortKey] ?? "";
    const cmp = av.localeCompare(bv);
    return sortDir === "asc" ? cmp : -cmp;
  });

  const SortHeader = ({ k, label }: { k: SortKey; label: string }) => (
    <th
      onClick={() => {
        if (sortKey === k) setSortDir(sortDir === "asc" ? "desc" : "asc");
        else { setSortKey(k); setSortDir("asc"); }
      }}
      className="cursor-pointer p-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      {label} {sortKey === k && (sortDir === "asc" ? "↑" : "↓")}
    </th>
  );

  return (
    <>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/30">
            <tr>
              <SortHeader k="display_name" label="Vehicle" />
              <SortHeader k="class" label="Class" />
              <SortHeader k="manufacturer_display" label="Manufacturer" />
              <SortHeader k="property" label="📍 Stored at" />
              <SortHeader k="upgrade" label="Sub-garage" />
              <SortHeader k="slot" label="Slot" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((inst) => (
              <tr
                key={inst.id}
                onClick={() => setSelectedId(inst.id)}
                className="cursor-pointer border-b hover:bg-muted/30"
              >
                <td className="p-2">{inst.nickname ?? inst.display_name}</td>
                <td className="p-2 text-muted-foreground">{inst.class}</td>
                <td className="p-2 text-muted-foreground">{inst.manufacturer_display}</td>
                <td className="p-2">
                  {inst.storage ? (
                    inst.storage.property_display_name
                  ) : (
                    <span className="text-red-400">Not stored →</span>
                  )}
                </td>
                <td className="p-2 text-muted-foreground">
                  {inst.storage?.upgrade_display_name ?? "—"}
                </td>
                <td className="p-2 tabular-nums">
                  {inst.storage?.slot_number ?? (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
