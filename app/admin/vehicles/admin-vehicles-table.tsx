"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AVAILABILITY_LABEL,
  VENDOR_LABEL,
  VENDOR_OPTIONS,
  normalizeSearch,
  type AvailabilityStatus,
  type VehicleVendor,
} from "@/lib/vehicles";

import { updateVehicleAdmin, type VehiclePatch } from "../actions";

export type AdminVehicleRow = {
  id: string;
  display_name: string;
  class: string;
  manufacturer_display: string;
  price: number | null;
  availability: AvailabilityStatus;
  vendors: VehicleVendor[];
};

const AVAILABILITY_KEYS = Object.keys(AVAILABILITY_LABEL) as AvailabilityStatus[];
const CAP = 150;

export function AdminVehiclesTable({ rows }: { rows: AdminVehicleRow[] }) {
  const [data, setData] = useState<AdminVehicleRow[]>(rows);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = normalizeSearch(search).trim();
    if (!q) return data;
    return data.filter(
      (r) =>
        normalizeSearch(r.display_name).includes(q) ||
        normalizeSearch(r.manufacturer_display).includes(q),
    );
  }, [data, search]);

  const save = (id: string, patch: VehiclePatch) => {
    let prevRow: AdminVehicleRow | undefined;
    setData((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        prevRow = r;
        return { ...r, ...patch } as AdminVehicleRow;
      }),
    );
    startTransition(async () => {
      const res = await updateVehicleAdmin(id, patch);
      if ("error" in res) {
        toast.error(res.error);
        if (prevRow) {
          setData((prev) => prev.map((r) => (r.id === id ? prevRow! : r)));
        }
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Search vehicles…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length} match{filtered.length === 1 ? "" : "es"}
          {filtered.length > CAP ? ` · showing first ${CAP}` : ""}
        </span>
      </div>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="p-2">Name</th>
              <th className="p-2">Class / Maker</th>
              <th className="w-28 p-2">Price</th>
              <th className="w-40 p-2">Availability</th>
              <th className="w-44 p-2">Vendors</th>
            </tr>
          </thead>
          <tbody>
            {filtered.slice(0, CAP).map((r) => (
              <Row key={r.id} row={r} onSave={save} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Row({
  row,
  onSave,
}: {
  row: AdminVehicleRow;
  onSave: (id: string, patch: VehiclePatch) => void;
}) {
  const [name, setName] = useState(row.display_name);
  const [price, setPrice] = useState(row.price === null ? "" : String(row.price));

  // Resync local buffers when the row prop changes (after a save or a revert).
  useEffect(() => setName(row.display_name), [row.display_name]);
  useEffect(
    () => setPrice(row.price === null ? "" : String(row.price)),
    [row.price],
  );

  const commitName = () => {
    const v = name.trim();
    if (!v) {
      setName(row.display_name);
      return;
    }
    if (v !== row.display_name) onSave(row.id, { display_name: v });
  };

  const commitPrice = () => {
    const trimmed = price.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && (!Number.isFinite(next) || next < 0)) {
      toast.error("Price must be a number ≥ 0 (or empty).");
      setPrice(row.price === null ? "" : String(row.price));
      return;
    }
    if (next !== row.price) onSave(row.id, { price: next });
  };

  const toggleVendor = (v: VehicleVendor) => {
    const next = row.vendors.includes(v)
      ? row.vendors.filter((x) => x !== v)
      : [...row.vendors, v];
    onSave(row.id, { vendors: next });
  };

  return (
    <tr className="border-b last:border-0 hover:bg-muted/20">
      <td className="p-1.5">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          className="h-8"
        />
      </td>
      <td className="p-1.5 text-xs text-muted-foreground">
        {row.class} · {row.manufacturer_display}
      </td>
      <td className="p-1.5">
        <Input
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          onBlur={commitPrice}
          inputMode="numeric"
          placeholder="—"
          className="h-8 tabular-nums"
        />
      </td>
      <td className="p-1.5">
        <select
          value={row.availability}
          onChange={(e) =>
            onSave(row.id, { availability: e.target.value as AvailabilityStatus })
          }
          className="h-8 w-full rounded-md border bg-background px-2 text-sm"
        >
          {AVAILABILITY_KEYS.map((a) => (
            <option key={a} value={a}>
              {AVAILABILITY_LABEL[a]}
            </option>
          ))}
        </select>
      </td>
      <td className="p-1.5">
        <Popover>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="h-8 w-full truncate rounded-md border bg-background px-2 text-left text-xs hover:bg-accent/30"
            >
              {row.vendors.length === 0
                ? "—"
                : row.vendors.map((v) => VENDOR_LABEL[v]).join(", ")}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56" align="end">
            <div className="flex flex-col gap-1.5">
              {VENDOR_OPTIONS.map((v) => (
                <label
                  key={v}
                  className="flex cursor-pointer items-center gap-2 text-sm"
                >
                  <Checkbox
                    checked={row.vendors.includes(v)}
                    onCheckedChange={() => toggleVendor(v)}
                  />
                  {VENDOR_LABEL[v]}
                </label>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </td>
    </tr>
  );
}
