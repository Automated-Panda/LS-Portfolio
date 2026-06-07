// app/admin/content/admin-content-list.tsx
"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { ChevronDown, ChevronRight, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { propertyImageUrl } from "@/lib/properties";
import { normalizeSearch } from "@/lib/vehicles";
import { groupUpgrades, mutexGroupLabels } from "@/lib/upgrade-groups";

import {
  createUpgradeAdmin,
  deleteUpgradeAdmin,
  updateMutexGroupAdmin,
  updatePropertyAdmin,
  updateUpgradeAdmin,
  type PropertyPatch,
  type UpgradePatch,
} from "../actions";
import { AdminImageCell } from "../admin-image-cell";
import { AdminStatusCell } from "../admin-status-cell";
import { AdminPager, usePagination } from "../admin-pager";

export type AdminContentUpgrade = {
  id: string;
  display_name: string;
  capacity: number;
  price: number | null;
  mutex_group: string | null;
  mutex_allow_none: boolean;
  included_on_purchase: boolean;
  required_upgrade_id: string | null;
  sort_order: number;
};
export type AdminContentProperty = {
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
  status: string;
  upgrades: AdminContentUpgrade[];
};

const PAGE_SIZE = 50;

export function AdminContentList({
  rows,
  noun,
}: {
  rows: AdminContentProperty[];
  noun: string; // "property" | "business"
}) {
  const [items, setItems] = useState(rows);
  useEffect(() => setItems(rows), [rows]);
  const [search, setSearch] = useState("");
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = normalizeSearch(search).trim();
    if (!q) return items;
    return items.filter(
      (r) =>
        normalizeSearch(r.display_name).includes(q) ||
        normalizeSearch(r.subtype_display).includes(q) ||
        normalizeSearch(r.neighborhood ?? "").includes(q),
    );
  }, [items, search]);
  const { page, setPage, totalPages, pageItems } = usePagination(filtered, PAGE_SIZE, search);

  // ---- optimistic mutators ----
  const setUpgrades = (propId: string, fn: (u: AdminContentUpgrade[]) => AdminContentUpgrade[]) =>
    setItems((cur) =>
      cur.map((p) => (p.id === propId ? { ...p, upgrades: fn(p.upgrades) } : p)),
    );

  const patchProperty = (id: string, patch: PropertyPatch) => {
    let prev: AdminContentProperty | undefined;
    setItems((cur) =>
      cur.map((p) => {
        if (p.id !== id) return p;
        prev = p;
        return { ...p, ...patch } as AdminContentProperty;
      }),
    );
    startTransition(async () => {
      const res = await updatePropertyAdmin(id, patch);
      if ("error" in res) {
        toast.error(res.error);
        if (prev) setItems((cur) => cur.map((p) => (p.id === id ? prev! : p)));
      }
    });
  };

  const patchUpgrade = (propId: string, upId: string, patch: UpgradePatch) => {
    setUpgrades(propId, (us) =>
      us.map((u) => (u.id === upId ? { ...u, ...patch } as AdminContentUpgrade : u)),
    );
    startTransition(async () => {
      const res = await updateUpgradeAdmin(upId, patch);
      if ("error" in res) toast.error(res.error);
    });
  };

  const addUpgrade = (propId: string) => {
    startTransition(async () => {
      const res = await createUpgradeAdmin(propId, { display_name: "New upgrade" });
      if ("error" in res) {
        toast.error(res.error);
        return;
      }
      setUpgrades(propId, (us) => [
        ...us,
        {
          id: res.id,
          display_name: "New upgrade",
          capacity: 0,
          price: null,
          mutex_group: null,
          mutex_allow_none: false,
          included_on_purchase: false,
          required_upgrade_id: null,
          sort_order: (us.at(-1)?.sort_order ?? 0) + 1,
        },
      ]);
    });
  };

  const removeUpgrade = (propId: string, upId: string) => {
    let prev: AdminContentUpgrade[] | undefined;
    setItems((cur) =>
      cur.map((p) => {
        if (p.id !== propId) return p;
        prev = p.upgrades;
        return { ...p, upgrades: p.upgrades.filter((u) => u.id !== upId) };
      }),
    );
    startTransition(async () => {
      const res = await deleteUpgradeAdmin(upId);
      if ("error" in res) {
        toast.error(res.error);
        if (prev) setUpgrades(propId, () => prev!);
      }
    });
  };

  const patchGroup = (
    propId: string,
    group: string,
    patch: { label?: string; allowNone?: boolean },
  ) => {
    setUpgrades(propId, (us) =>
      us.map((u) =>
        u.mutex_group === group
          ? {
              ...u,
              mutex_group: patch.label ?? u.mutex_group,
              mutex_allow_none: patch.allowNone ?? u.mutex_allow_none,
            }
          : u,
      ),
    );
    startTransition(async () => {
      const res = await updateMutexGroupAdmin(propId, group, patch);
      if ("error" in res) toast.error(res.error);
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          placeholder={`Search ${noun === "business" ? "businesses" : "properties"}…`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <span className="text-xs text-muted-foreground">
          {filtered.length}{" "}
          {filtered.length === 1
            ? noun
            : noun === "business"
              ? "businesses"
              : "properties"}
        </span>
      </div>

      <div className="overflow-hidden rounded-md border">
        {pageItems.map((p) => (
          <ContentItem
            key={p.id}
            property={p}
            onProperty={patchProperty}
            onUpgrade={patchUpgrade}
            onAddUpgrade={addUpgrade}
            onRemoveUpgrade={removeUpgrade}
            onGroup={patchGroup}
          />
        ))}
        {pageItems.length === 0 && (
          <p className="p-6 text-center text-sm text-muted-foreground">No matches.</p>
        )}
      </div>
      <AdminPager page={page} totalPages={totalPages} onPage={setPage} />
    </div>
  );
}

function ContentItem({
  property: p,
  onProperty,
  onUpgrade,
  onAddUpgrade,
  onRemoveUpgrade,
  onGroup,
}: {
  property: AdminContentProperty;
  onProperty: (id: string, patch: PropertyPatch) => void;
  onUpgrade: (propId: string, upId: string, patch: UpgradePatch) => void;
  onAddUpgrade: (propId: string) => void;
  onRemoveUpgrade: (propId: string, upId: string) => void;
  onGroup: (propId: string, group: string, patch: { label?: string; allowNone?: boolean }) => void;
}) {
  const [open, setOpen] = useState(false);
  const count = p.upgrades.length;
  return (
    <div className="border-b last:border-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left hover:bg-muted/20"
      >
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
        <span className="font-medium">{p.display_name}</span>
        <span className="rounded-full border bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
          {p.subtype_display}
        </span>
        <StatusDot status={p.status} />
        <span className="ml-auto rounded-full border border-[#84cc16]/40 bg-[#84cc16]/10 px-2 py-0.5 text-[10px] text-[#84cc16]">
          {count} upgrade{count === 1 ? "" : "s"}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t bg-muted/10 px-3 py-3 pl-9">
          <DetailsEditor property={p} onProperty={onProperty} />
          <UpgradesEditor
            property={p}
            onUpgrade={onUpgrade}
            onAddUpgrade={onAddUpgrade}
            onRemoveUpgrade={onRemoveUpgrade}
            onGroup={onGroup}
          />
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const c =
    status === "published" ? "text-green-400" : status === "draft" ? "text-amber-400" : "text-zinc-400";
  return (
    <span className={`text-[10px] ${c}`} title={status}>
      ●
    </span>
  );
}

function DetailsEditor({
  property: p,
  onProperty,
}: {
  property: AdminContentProperty;
  onProperty: (id: string, patch: PropertyPatch) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Details
      </p>
      <div className="flex flex-wrap items-start gap-4">
        <AdminImageCell entity="properties" id={p.id} initialUrl={propertyImageUrl(p.image_path)} />
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground">Status</span>
          <AdminStatusCell entity="properties" id={p.id} initial={p.status} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <TextField label="Name" value={p.display_name} onCommit={(v) => v && onProperty(p.id, { display_name: v })} />
        <TextField label="Subtype label" value={p.subtype_display} onCommit={(v) => v && onProperty(p.id, { subtype_display: v })} />
        <TextField label="Neighborhood" value={p.neighborhood ?? ""} nullable onCommit={(v) => onProperty(p.id, { neighborhood: v || null })} />
        <NumField label="Capacity" value={p.capacity} onCommit={(n) => onProperty(p.id, { capacity: n ?? 0 })} />
        <NumField label="Price ($)" value={p.price} nullable onCommit={(n) => onProperty(p.id, { price: n })} />
        <label className="flex items-end gap-2 pb-1.5 text-xs">
          <Checkbox
            checked={p.counts_as_garage}
            onCheckedChange={(c) => onProperty(p.id, { counts_as_garage: !!c })}
          />
          <span>Counts as garage</span>
        </label>
      </div>
    </div>
  );
}

function UpgradesEditor({
  property: p,
  onUpgrade,
  onAddUpgrade,
  onRemoveUpgrade,
  onGroup,
}: {
  property: AdminContentProperty;
  onUpgrade: (propId: string, upId: string, patch: UpgradePatch) => void;
  onAddUpgrade: (propId: string) => void;
  onRemoveUpgrade: (propId: string, upId: string) => void;
  onGroup: (propId: string, group: string, patch: { label?: string; allowNone?: boolean }) => void;
}) {
  const sorted = [...p.upgrades].sort((a, b) => a.sort_order - b.sort_order);
  const entries = groupUpgrades(sorted);
  const groups = mutexGroupLabels(sorted);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Upgrades
      </p>
      <div className="grid grid-cols-[1fr_56px_92px_auto] gap-x-2 px-1 text-[9px] uppercase tracking-wide text-muted-foreground/70">
        <span>Name</span>
        <span>Cap</span>
        <span>Price</span>
        <span>Options</span>
      </div>

      {entries.map((e) =>
        e.type === "single" ? (
          <UpgradeRow
            key={e.upgrade.id}
            property={p}
            upgrade={e.upgrade}
            groups={groups}
            onUpgrade={onUpgrade}
            onRemove={onRemoveUpgrade}
          />
        ) : (
          <MutexBlock
            key={`g:${e.group.key}`}
            property={p}
            group={e.group}
            groups={groups}
            onUpgrade={onUpgrade}
            onRemove={onRemoveUpgrade}
            onGroup={onGroup}
          />
        ),
      )}

      {p.upgrades.length === 0 && (
        <p className="px-1 py-2 text-xs text-muted-foreground/70">No upgrades yet.</p>
      )}

      <div className="mt-1">
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onAddUpgrade(p.id)}>
          <Plus className="h-3.5 w-3.5" /> Add upgrade
        </Button>
      </div>
    </div>
  );
}

function MutexBlock({
  property: p,
  group,
  groups,
  onUpgrade,
  onRemove,
  onGroup,
}: {
  property: AdminContentProperty;
  group: { key: string; label: string; allowNone: boolean; members: AdminContentUpgrade[] };
  groups: string[];
  onUpgrade: (propId: string, upId: string, patch: UpgradePatch) => void;
  onRemove: (propId: string, upId: string) => void;
  onGroup: (propId: string, g: string, patch: { label?: string; allowNone?: boolean }) => void;
}) {
  const [label, setLabel] = useState(group.label);
  useEffect(() => setLabel(group.label), [group.label]);
  return (
    <div className="rounded-lg border border-violet-500/40 bg-violet-500/5 p-1.5">
      <div className="flex items-center gap-2 px-1 pb-1 text-[11px] text-violet-300">
        <span title="Mutually exclusive — users pick one">⇄ Pick one</span>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={() => label.trim() && label.trim() !== group.key && onGroup(p.id, group.key, { label: label.trim() })}
          className="h-6 w-32 border-violet-500/40 bg-background/60 text-xs"
        />
        <label className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <Checkbox
            checked={group.allowNone}
            onCheckedChange={(c) => onGroup(p.id, group.key, { allowNone: !!c })}
          />
          Allow “None”
        </label>
      </div>
      {group.members.map((u) => (
        <UpgradeRow
          key={u.id}
          property={p}
          upgrade={u}
          groups={groups}
          inGroup
          onUpgrade={onUpgrade}
          onRemove={onRemove}
        />
      ))}
    </div>
  );
}

function UpgradeRow({
  property: p,
  upgrade: u,
  groups,
  inGroup = false,
  onUpgrade,
  onRemove,
}: {
  property: AdminContentProperty;
  upgrade: AdminContentUpgrade;
  groups: string[];
  inGroup?: boolean;
  onUpgrade: (propId: string, upId: string, patch: UpgradePatch) => void;
  onRemove: (propId: string, upId: string) => void;
}) {
  const siblings = p.upgrades.filter((x) => x.id !== u.id);
  return (
    <div className="grid grid-cols-[1fr_56px_92px_auto] items-center gap-x-2 gap-y-1 rounded-md px-1 py-1 hover:bg-muted/30">
      <TextField value={u.display_name} dense onCommit={(v) => v && onUpgrade(p.id, u.id, { display_name: v })} />
      <NumField value={u.capacity} dense onCommit={(n) => onUpgrade(p.id, u.id, { capacity: n ?? 0 })} />
      <NumField value={u.price} nullable dense onCommit={(n) => onUpgrade(p.id, u.id, { price: n })} />
      <div className="flex flex-wrap items-center gap-1.5">
        {inGroup ? (
          <button
            type="button"
            onClick={() => onUpgrade(p.id, u.id, { mutex_group: null })}
            className="rounded border px-1.5 py-0.5 text-[10px] text-violet-300 hover:bg-violet-500/10"
            title="Remove from the pick-one group"
          >
            ✕ group
          </button>
        ) : (
          <input
            list={`groups-${p.id}`}
            defaultValue={u.mutex_group ?? ""}
            onBlur={(e) => {
              const v = e.target.value.trim();
              if ((v || null) !== (u.mutex_group ?? null)) onUpgrade(p.id, u.id, { mutex_group: v || null });
            }}
            placeholder="group…"
            className="h-6 w-20 rounded border bg-background px-1.5 text-[10px]"
            title="Type a group name to make this a 'pick one' option"
          />
        )}
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground" title="Auto-installed when the property is bought">
          <Checkbox
            checked={u.included_on_purchase}
            onCheckedChange={(c) => onUpgrade(p.id, u.id, { included_on_purchase: !!c })}
          />
          Auto
        </label>
        <select
          value={u.required_upgrade_id ?? ""}
          onChange={(e) => onUpgrade(p.id, u.id, { required_upgrade_id: e.target.value || null })}
          className="h-6 max-w-[120px] rounded border bg-background px-1 text-[10px]"
          title="Requires this upgrade first"
        >
          <option value="">requires: —</option>
          {siblings.map((s) => (
            <option key={s.id} value={s.id}>
              {s.display_name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => onRemove(p.id, u.id)}
          className="text-muted-foreground/60 hover:text-red-400"
          title="Delete upgrade"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <datalist id={`groups-${p.id}`}>
        {groups.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
    </div>
  );
}

// ---- small field helpers (commit on blur, revert on empty when non-nullable) ----
function TextField({
  label,
  value,
  nullable = false,
  dense = false,
  onCommit,
}: {
  label?: string;
  value: string;
  nullable?: boolean;
  dense?: boolean;
  onCommit: (v: string) => void;
}) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  const commit = () => {
    const t = v.trim();
    if (!t && !nullable) return setV(value);
    if (t !== value) onCommit(t);
  };
  const input = (
    <Input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      placeholder={nullable ? "—" : undefined}
      className={dense ? "h-7 text-xs" : "h-8"}
    />
  );
  if (!label) return input;
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {input}
    </label>
  );
}

function NumField({
  label,
  value,
  nullable = false,
  dense = false,
  onCommit,
}: {
  label?: string;
  value: number | null;
  nullable?: boolean;
  dense?: boolean;
  onCommit: (n: number | null) => void;
}) {
  const [v, setV] = useState(value === null ? "" : String(value));
  useEffect(() => setV(value === null ? "" : String(value)), [value]);
  const commit = () => {
    const t = v.trim();
    if (t === "") {
      if (nullable) {
        if (value !== null) onCommit(null);
      } else setV(value === null ? "" : String(value));
      return;
    }
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) {
      toast.error("Enter a number ≥ 0.");
      return setV(value === null ? "" : String(value));
    }
    if (n !== value) onCommit(n);
  };
  const input = (
    <Input
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={commit}
      inputMode="numeric"
      placeholder={nullable ? "—" : undefined}
      className={`tabular-nums ${dense ? "h-7 text-xs" : "h-8"}`}
    />
  );
  if (!label) return input;
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {input}
    </label>
  );
}
