"use client";

import { Check, ChevronDown, Trophy } from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/ui/card";

type Row = { ownedUnique: number; total: number; percent: number };

export type GroupDetail = {
  slug: string;
  label: string;
  isBusiness: boolean;
  cap: number;
  owned: number;
  ownableTotal: number;
  unowned: Array<{ id: string; display_name: string }>;
};

type Props = {
  vehicles: Row;
  properties: Row;
  businesses: Row;
  groups: GroupDetail[];
};

function ProgressRow({
  label,
  row,
}: {
  label: string;
  row: Row;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="tabular-nums">
          {row.ownedUnique} / {row.total}{" "}
          <span className="text-muted-foreground">({row.percent}%)</span>
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-accent transition-all"
          style={{ width: `${row.percent}%` }}
        />
      </div>
    </div>
  );
}

function GroupBreakdownRow({ group }: { group: GroupDetail }) {
  const complete = group.owned >= group.cap;
  const remaining = Math.max(0, group.cap - group.owned);
  const percent = group.cap === 0 ? 0 : Math.round((group.owned / group.cap) * 100);

  // "Open-pool" groups are ones where the user picks ANY N from a larger
  // bucket (e.g. residential cap 10 with 92 candidates). We don't list the
  // unowned items in that case — the list would be huge and not actionable.
  // "Specific-choice" groups are ones where cap == ownableTotal: every
  // option matters, so the unowned names are useful to surface.
  const isOpenPool = group.ownableTotal > group.cap;

  return (
    <div className="flex flex-col gap-1 py-1.5">
      <div className="flex items-baseline justify-between text-xs">
        <span className="truncate text-foreground/90">{group.label}</span>
        <span className="ml-2 shrink-0 tabular-nums text-muted-foreground">
          {complete ? (
            <span className="inline-flex items-center gap-1 text-emerald-400">
              <Check className="h-3 w-3" />
              {group.owned} / {group.cap}
            </span>
          ) : (
            <>
              {group.owned} / {group.cap}
            </>
          )}
        </span>
      </div>
      <div className="h-1 rounded-full bg-muted overflow-hidden">
        <div
          className={complete ? "h-full bg-emerald-500/70" : "h-full bg-accent/70"}
          style={{ width: `${percent}%` }}
        />
      </div>
      {!complete && (
        <p className="text-[10px] leading-snug text-muted-foreground">
          {isOpenPool
            ? `Pick ${remaining} more from ${group.ownableTotal} options.`
            : group.unowned.length > 0
              ? `Missing: ${group.unowned.map((u) => u.display_name).join(", ")}`
              : `Add ${remaining} more.`}
        </p>
      )}
    </div>
  );
}

export function CatalogCard({ vehicles, properties, businesses, groups }: Props) {
  const [expanded, setExpanded] = useState(false);

  const propertyGroups = groups.filter((g) => !g.isBusiness);
  const businessGroups = groups.filter((g) => g.isBusiness);

  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Trophy className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider font-medium">
              Catalog
            </span>
          </div>
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            aria-expanded={expanded}
          >
            {expanded ? "Hide details" : "Show details"}
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </button>
        </div>

        <ProgressRow label="Vehicles" row={vehicles} />
        <ProgressRow label="Properties" row={properties} />
        <ProgressRow label="Businesses" row={businesses} />

        {!expanded && (
          <p className="text-xs text-muted-foreground">
            Properties &amp; Businesses are scored against the in-game
            ownership cap (e.g. 10 apartments, 1 nightclub). Vehicles is
            unique catalogue coverage.
          </p>
        )}

        {expanded && (
          <div className="flex flex-col gap-4 pt-1">
            <Section title="Properties" groups={propertyGroups} />
            <Section title="Businesses" groups={businessGroups} />
            <p className="text-[10px] text-muted-foreground">
              Cap-based scoring — buckets where you pick any N from a larger
              pool (e.g. apartments) show how many more to add; specific-choice
              buckets list the exact options left.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

function Section({
  title,
  groups,
}: {
  title: string;
  groups: GroupDetail[];
}) {
  if (groups.length === 0) return null;
  return (
    <div className="flex flex-col">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-col divide-y divide-border/40">
        {groups.map((g) => (
          <GroupBreakdownRow key={g.slug} group={g} />
        ))}
      </div>
    </div>
  );
}
