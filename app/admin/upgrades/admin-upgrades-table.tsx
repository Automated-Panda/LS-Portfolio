"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { normalizeSearch } from "@/lib/vehicles";

import { updateUpgradeAdmin, type UpgradePatch } from "../actions";

export type AdminUpgradeRow = {
  id: string;
  property_id: string;
  property_display_name: string;
  display_name: string;
  capacity: number;
  price: number | null;
};

const CAP = 300;

export function AdminUpgradesTable({ rows }: { rows: AdminUpgradeRow[] }) {
  const [data, setData] = useState<AdminUpgradeRow[]>(rows);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = normalizeSearch(search).trim();
    if (!q) return data;
    return data.filter(
      (r) =>
        normalizeSearch(r.display_name).includes(q) ||
        normalizeSearch(r.property_display_name).includes(q),
    );
  }, [data, search]);

  const save = (id: string, patch: UpgradePatch) => {
    let prev: AdminUpgradeRow | undefined;
    setData((cur) =>
      cur.map((r) => {
        if (r.id !== id) return r;
        prev = r;
        return { ...r, ...patch } as AdminUpgradeRow;
      }),
    );
    startTransition(async () => {
      const res = await updateUpgradeAdmin(id, patch);
      if ("error" in res) {
        toast.error(res.error);
        if (prev) setData((cur) => cur.map((r) => (r.id === id ? prev! : r)));
      }
    });
  };

  const shown = filtered.slice(0, CAP);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder="Search upgrades or properties…"
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
              <th className="p-2">Upgrade</th>
              <th className="w-24 p-2">Capacity</th>
              <th className="w-28 p-2">Price</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => {
              const newGroup = i === 0 || shown[i - 1].property_id !== r.property_id;
              return (
                <Group key={r.id} row={r} showHeader={newGroup} onSave={save} />
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Group({
  row,
  showHeader,
  onSave,
}: {
  row: AdminUpgradeRow;
  showHeader: boolean;
  onSave: (id: string, patch: UpgradePatch) => void;
}) {
  return (
    <>
      {showHeader && (
        <tr className="bg-muted/30">
          <td colSpan={3} className="px-2 py-1 text-xs font-semibold">
            {row.property_display_name}
          </td>
        </tr>
      )}
      <UpgradeRow row={row} onSave={onSave} />
    </>
  );
}

function UpgradeRow({
  row,
  onSave,
}: {
  row: AdminUpgradeRow;
  onSave: (id: string, patch: UpgradePatch) => void;
}) {
  const [name, setName] = useState(row.display_name);
  const [cap, setCap] = useState(String(row.capacity));
  const [price, setPrice] = useState(row.price === null ? "" : String(row.price));

  useEffect(() => setName(row.display_name), [row.display_name]);
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
      <td className="p-1.5 pl-4">
        <Input value={name} onChange={(e) => setName(e.target.value)} onBlur={commitName} className="h-8" />
      </td>
      <td className="p-1.5">
        <Input value={cap} onChange={(e) => setCap(e.target.value)} onBlur={commitCap} inputMode="numeric" className="h-8 tabular-nums" />
      </td>
      <td className="p-1.5">
        <Input value={price} onChange={(e) => setPrice(e.target.value)} onBlur={commitPrice} inputMode="numeric" placeholder="—" className="h-8 tabular-nums" />
      </td>
    </tr>
  );
}
