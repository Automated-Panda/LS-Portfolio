"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { propertyImageUrl } from "@/lib/properties";
import { normalizeSearch } from "@/lib/vehicles";

import { updatePropertyAdmin, type PropertyPatch } from "../actions";
import { AdminImageCell } from "../admin-image-cell";

export type AdminPropertyRow = {
  id: string;
  display_name: string;
  property_type: string;
  subtype: string;
  subtype_display: string;
  neighborhood: string | null;
  capacity: number;
  counts_as_garage: boolean;
  price: number | null;
  image_path: string | null;
};

const CAP = 150;

export function AdminPropertiesTable({ rows }: { rows: AdminPropertyRow[] }) {
  const [data, setData] = useState<AdminPropertyRow[]>(rows);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = normalizeSearch(search).trim();
    if (!q) return data;
    return data.filter(
      (r) =>
        normalizeSearch(r.display_name).includes(q) ||
        normalizeSearch(r.subtype_display).includes(q) ||
        normalizeSearch(r.neighborhood ?? "").includes(q),
    );
  }, [data, search]);

  const save = (id: string, patch: PropertyPatch) => {
    let prev: AdminPropertyRow | undefined;
    setData((cur) =>
      cur.map((r) => {
        if (r.id !== id) return r;
        prev = r;
        return { ...r, ...patch } as AdminPropertyRow;
      }),
    );
    startTransition(async () => {
      const res = await updatePropertyAdmin(id, patch);
      if ("error" in res) {
        toast.error(res.error);
        if (prev) setData((cur) => cur.map((r) => (r.id === id ? prev! : r)));
      }
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Search properties…"
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
              <th className="w-44 p-2">Image</th>
              <th className="p-2">Name</th>
              <th className="p-2">Type</th>
              <th className="p-2">Subtype label</th>
              <th className="p-2">Neighborhood</th>
              <th className="w-24 p-2">Capacity</th>
              <th className="w-16 p-2">Garage?</th>
              <th className="w-28 p-2">Price</th>
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
  row: AdminPropertyRow;
  onSave: (id: string, patch: PropertyPatch) => void;
}) {
  const [name, setName] = useState(row.display_name);
  const [subtype, setSubtype] = useState(row.subtype_display);
  const [hood, setHood] = useState(row.neighborhood ?? "");
  const [cap, setCap] = useState(String(row.capacity));
  const [price, setPrice] = useState(row.price === null ? "" : String(row.price));

  useEffect(() => setName(row.display_name), [row.display_name]);
  useEffect(() => setSubtype(row.subtype_display), [row.subtype_display]);
  useEffect(() => setHood(row.neighborhood ?? ""), [row.neighborhood]);
  useEffect(() => setCap(String(row.capacity)), [row.capacity]);
  useEffect(
    () => setPrice(row.price === null ? "" : String(row.price)),
    [row.price],
  );

  const commitName = () => {
    const v = name.trim();
    if (!v) return setName(row.display_name);
    if (v !== row.display_name) onSave(row.id, { display_name: v });
  };
  const commitSubtype = () => {
    const v = subtype.trim();
    if (!v) return setSubtype(row.subtype_display);
    if (v !== row.subtype_display) onSave(row.id, { subtype_display: v });
  };
  const commitHood = () => {
    const v = hood.trim();
    if ((v || null) !== row.neighborhood) onSave(row.id, { neighborhood: v || null });
  };
  const commitCap = () => {
    const n = Number(cap.trim());
    if (!Number.isInteger(n) || n < 0) {
      toast.error("Capacity must be a whole number ≥ 0.");
      return setCap(String(row.capacity));
    }
    if (n !== row.capacity) onSave(row.id, { capacity: n });
  };
  const commitPrice = () => {
    const t = price.trim();
    const next = t === "" ? null : Number(t);
    if (next !== null && (!Number.isFinite(next) || next < 0)) {
      toast.error("Price must be a number ≥ 0 (or empty).");
      return setPrice(row.price === null ? "" : String(row.price));
    }
    if (next !== row.price) onSave(row.id, { price: next });
  };

  return (
    <tr className="border-b last:border-0 hover:bg-muted/20">
      <td className="p-1.5">
        <AdminImageCell entity="properties" id={row.id} initialUrl={propertyImageUrl(row.image_path)} />
      </td>
      <td className="p-1.5">
        <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={commitName} className="h-8" />
      </td>
      <td className="p-1.5 text-xs text-muted-foreground">{row.property_type}</td>
      <td className="p-1.5">
        <Input value={subtype} onChange={(e) => setSubtype(e.target.value)} onBlur={commitSubtype} className="h-8" />
      </td>
      <td className="p-1.5">
        <Input value={hood} onChange={(e) => setHood(e.target.value)} onBlur={commitHood} placeholder="—" className="h-8" />
      </td>
      <td className="p-1.5">
        <Input value={cap} onChange={(e) => setCap(e.target.value)} onBlur={commitCap} inputMode="numeric" className="h-8 tabular-nums" />
      </td>
      <td className="p-1.5 text-center">
        <Checkbox
          checked={row.counts_as_garage}
          onCheckedChange={(c) => onSave(row.id, { counts_as_garage: !!c })}
        />
      </td>
      <td className="p-1.5">
        <Input value={price} onChange={(e) => setPrice(e.target.value)} onBlur={commitPrice} inputMode="numeric" placeholder="—" className="h-8 tabular-nums" />
      </td>
    </tr>
  );
}
