# Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the `/dashboard` stub with the real Phase 6 portfolio overview — story-stacked widgets (totals, quick actions, needs-attention, breakdown, capacity + catalog, recent activity) for users with ownership, and a welcoming onboarding view for brand-new accounts.

**Architecture:** Approach C — page-level server component fans out the 5 existing queries + 1 new slim catalog query in `Promise.all`, derives all metrics inline, and passes plain props to presentational widget components. No new server actions; navigation is via `next/link` only. Empty-state branch in `page.tsx` swaps to `<EmptyDashboard>` when ownership is fully zero.

**Tech Stack:** Next.js 15 (App Router, RSC) · TypeScript · Supabase · shadcn/ui · Tailwind · lucide-react

**Verification approach (project-specific):** This project has no automated test framework. Verification is `npm run typecheck` + manual browser smoke on `localhost:3000`. **Do not introduce a test framework.** Each task ends with typecheck + commit; final task is the full smoke checklist from the spec.

**Reference spec:** [`docs/specs/2026-05-26-dashboard-design.md`](../specs/2026-05-26-dashboard-design.md)

---

## File Structure

**Created:**
- `lib/queries/dashboard.ts` — `getCatalogTotals()`
- `app/(app)/dashboard/dashboard-layout.tsx` — server component composing widgets in C1 order
- `app/(app)/dashboard/empty-dashboard.tsx` — onboarding view for brand-new accounts
- `components/dashboard/totals-strip.tsx`
- `components/dashboard/quick-actions.tsx`
- `components/dashboard/needs-attention.tsx`
- `components/dashboard/breakdown-chips.tsx`
- `components/dashboard/capacity-card.tsx`
- `components/dashboard/catalog-card.tsx`
- `components/dashboard/recent-activity.tsx`

**Modified:**
- `app/(app)/dashboard/page.tsx` — rewrite from stub to real fetch + derive + branch
- `app/(app)/my-vehicles/page.tsx` — accept `searchParams.unassigned` and thread to client
- `app/(app)/my-vehicles/my-vehicles-client.tsx` — make `unassignedOnly` URL-driven via `?unassigned=1`
- `docs/plan.md` — phase entry for "Phase 6 dashboard landed"

---

## Pre-flight checks

Before starting, confirm with James:

- [ ] `.env.local` points at hosted Supabase (default).
- [ ] Working tree is clean (`git status`).
- [ ] Branch: create `feat/phase-6-dashboard` before Task 1.

---

## Task 1: New catalog-totals query

**Files:**
- Create: `lib/queries/dashboard.ts`

- [ ] **Step 1: Create the query file**

Create `lib/queries/dashboard.ts`:

```ts
import { createClient } from "@/lib/supabase/server";

export type CatalogTotals = {
  vehicles: number;
  properties: number;
};

/**
 * Counts of every vehicle and property row in the catalog. Used by the
 * dashboard Catalog widget to compute "owned unique types / catalog total".
 * No user filter, no joins — just two head-only counts.
 */
export async function getCatalogTotals(): Promise<CatalogTotals> {
  const supabase = await createClient();
  const [v, p] = await Promise.all([
    supabase.from("vehicles").select("id", { count: "exact", head: true }),
    supabase.from("properties").select("id", { count: "exact", head: true }),
  ]);
  if (v.error) throw v.error;
  if (p.error) throw p.error;
  return { vehicles: v.count ?? 0, properties: p.count ?? 0 };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add lib/queries/dashboard.ts
git commit -m "Phase 6: lib/queries/dashboard.ts — getCatalogTotals()"
```

---

## Task 2: URL-driven `?unassigned=1` on /my-vehicles (piggyback)

The `<NeedsAttention>` widget will deep-link to `/my-vehicles?unassigned=1`. Today `unassignedOnly` is `useState` local to `my-vehicles-client.tsx`. Convert to URL-driven so the deep link works and the filter survives navigation back.

**Files:**
- Modify: `app/(app)/my-vehicles/page.tsx`
- Modify: `app/(app)/my-vehicles/my-vehicles-client.tsx`

- [ ] **Step 1: Thread searchParams through the page**

Replace `app/(app)/my-vehicles/page.tsx` with:

```tsx
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOwnedVehicleInstances } from "@/lib/queries/my-vehicles";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";

import { MyVehiclesClient } from "./my-vehicles-client";

export default async function MyVehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ unassigned?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const initialUnassignedOnly = sp.unassigned === "1";

  const [instances, ownedProperties, { data: tags }] = await Promise.all([
    getOwnedVehicleInstances(user.id),
    getOwnedPropertiesWithStorage(user.id),
    supabase.from("vehicle_tags").select("id, display"),
  ]);

  const tagLookup = Object.fromEntries(
    (tags ?? []).map((t) => [t.id, t.display]),
  );

  return (
    <MyVehiclesClient
      instances={instances}
      ownedProperties={ownedProperties}
      tagLookup={tagLookup}
      initialUnassignedOnly={initialUnassignedOnly}
    />
  );
}
```

- [ ] **Step 2: Sync `unassignedOnly` state with URL in the client**

In `app/(app)/my-vehicles/my-vehicles-client.tsx`:

1. Add `initialUnassignedOnly: boolean` to the `Props` type.
2. Add the import: `import { useRouter, useSearchParams } from "next/navigation";`
3. Change `useState(false)` for `unassignedOnly` to `useState(initialUnassignedOnly)`.
4. Add a `useEffect` that pushes URL changes when the filter toggles.

Full updated component:

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LocationFilter } from "@/components/portfolio/location-filter";
import type { OwnedVehicleInstance } from "@/lib/queries/my-vehicles";
import type { OwnedPropertyDetail } from "@/lib/queries/my-properties";

import { MyVehiclesGrid } from "./my-vehicles-grid";
import { MyVehiclesTable } from "./my-vehicles-table";
import { UnassignedBanner } from "./unassigned-banner";

type Props = {
  instances: OwnedVehicleInstance[];
  ownedProperties: OwnedPropertyDetail[];
  tagLookup: Record<string, string>;
  initialUnassignedOnly: boolean;
};

const VIEW_KEY = "my-vehicles:view";

export function MyVehiclesClient({
  instances,
  ownedProperties,
  tagLookup,
  initialUnassignedOnly,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const tagSuggestions = useMemo(
    () =>
      Array.from(new Set(instances.flatMap((i) => i.custom_tags))).sort(),
    [instances],
  );
  const [view, setView] = useState<"cards" | "table">("cards");
  const [search, setSearch] = useState("");
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<string[]>([]);
  const [unassignedOnly, setUnassignedOnly] = useState(initialUnassignedOnly);

  useEffect(() => {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "table" || v === "cards") setView(v);
  }, []);
  useEffect(() => {
    localStorage.setItem(VIEW_KEY, view);
  }, [view]);

  // Sync ?unassigned=1 with state without scrolling or adding history entries.
  useEffect(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (unassignedOnly) {
      params.set("unassigned", "1");
    } else {
      params.delete("unassigned");
    }
    const qs = params.toString();
    router.replace(qs ? `/my-vehicles?${qs}` : "/my-vehicles", {
      scroll: false,
    });
  }, [unassignedOnly, router, searchParams]);

  const filtered = instances.filter((i) => {
    if (unassignedOnly && i.storage) return false;
    if (selectedPropertyIds.length > 0 && (!i.storage || !selectedPropertyIds.includes(i.storage.owned_property_id))) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!i.display_name.toLowerCase().includes(q) && !(i.nickname ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const unassignedCount = instances.filter((i) => !i.storage).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">My Vehicles ({instances.length})</h1>
        <div className="flex flex-wrap gap-2">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Search"
            className="w-48"
          />
          <LocationFilter
            properties={ownedProperties.map((p) => ({ id: p.id, display_name: p.display_name }))}
            selectedPropertyIds={selectedPropertyIds}
            unassignedOnly={unassignedOnly}
            onChange={({ properties, unassignedOnly }) => {
              setSelectedPropertyIds(properties);
              setUnassignedOnly(unassignedOnly);
            }}
          />
          <div className="flex rounded-md border">
            <Button
              size="sm"
              variant={view === "cards" ? "default" : "ghost"}
              onClick={() => setView("cards")}
            >▦ Cards</Button>
            <Button
              size="sm"
              variant={view === "table" ? "default" : "ghost"}
              onClick={() => setView("table")}
            >☰ Table</Button>
          </div>
        </div>
      </div>
      <UnassignedBanner count={unassignedCount} />
      {view === "cards" ? (
        <MyVehiclesGrid
          instances={filtered}
          ownedProperties={ownedProperties}
          tagLookup={tagLookup}
          tagSuggestions={tagSuggestions}
        />
      ) : (
        <MyVehiclesTable
          instances={filtered}
          ownedProperties={ownedProperties}
          tagSuggestions={tagSuggestions}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Manual smoke**

- Start dev server (`npm run dev`).
- Visit `/my-vehicles?unassigned=1` directly — the **Unassigned only** checkbox should be pre-checked and the grid filtered.
- Toggle the checkbox off → URL drops the `?unassigned` param.
- Toggle it back on → URL gets `?unassigned=1` back.
- Hit back/forward — state restores.

- [ ] **Step 5: Commit**

```bash
git add app/\(app\)/my-vehicles/page.tsx app/\(app\)/my-vehicles/my-vehicles-client.tsx
git commit -m "Phase 6 prep: URL-driven ?unassigned=1 on /my-vehicles"
```

---

## Task 3: `<TotalsStrip>` widget

**Files:**
- Create: `components/dashboard/totals-strip.tsx`

- [ ] **Step 1: Create the component**

Create `components/dashboard/totals-strip.tsx`:

```tsx
import Link from "next/link";
import { Car, Home, Briefcase } from "lucide-react";

import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";

type SubSplit = Array<{ label: string; count: number }>;

type Props = {
  vehicles: { total: number; splits: SubSplit };
  properties: { total: number; splits: SubSplit };
  businesses: { total: number; splits: SubSplit };
};

function formatSplits(splits: SubSplit): string {
  return splits
    .filter((s) => s.count > 0)
    .map((s) => `${s.count} ${s.label}`)
    .join(" · ");
}

function StatCard({
  href, icon: Icon, label, total, subLine,
}: {
  href: string;
  icon: typeof Car;
  label: string;
  total: number;
  subLine: string;
}) {
  return (
    <Link
      href={href}
      className="block transition-colors hover:bg-accent/40 rounded-lg"
    >
      <Card>
        <CardContent className="flex items-center gap-4 p-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-accent/30">
            <Icon className="h-5 w-5 text-accent-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <CardDescription className="text-xs uppercase tracking-wider">
              {label}
            </CardDescription>
            <CardTitle className="text-3xl tabular-nums">{total}</CardTitle>
            {subLine && (
              <p className="text-xs text-muted-foreground truncate">{subLine}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function TotalsStrip({ vehicles, properties, businesses }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <StatCard
        href="/my-vehicles"
        icon={Car}
        label="Vehicles"
        total={vehicles.total}
        subLine={formatSplits(vehicles.splits)}
      />
      <StatCard
        href="/my-properties"
        icon={Home}
        label="Properties"
        total={properties.total}
        subLine={formatSplits(properties.splits)}
      />
      <StatCard
        href="/my-businesses"
        icon={Briefcase}
        label="Businesses"
        total={businesses.total}
        subLine={formatSplits(businesses.splits)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/totals-strip.tsx
git commit -m "Phase 6: dashboard/totals-strip.tsx — 3 stat cards with sub-splits"
```

---

## Task 4: `<QuickActions>` widget

**Files:**
- Create: `components/dashboard/quick-actions.tsx`

- [ ] **Step 1: Create the component**

Create `components/dashboard/quick-actions.tsx`:

```tsx
import Link from "next/link";
import { Plus, Sparkles, Home } from "lucide-react";

import { Card } from "@/components/ui/card";

export function QuickActions() {
  return (
    <Card className="border-accent/30 bg-accent/5">
      <div className="flex flex-wrap items-center gap-3 p-4">
        <span className="text-xs uppercase tracking-wider text-muted-foreground">
          ⚡ Quick actions
        </span>
        <Link
          href="/vehicles"
          className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-background/40 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/20"
        >
          <Plus className="h-3.5 w-3.5" /> Vehicle
        </Link>
        <Link
          href="/properties"
          className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-background/40 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/20"
        >
          <Home className="h-3.5 w-3.5" /> Property
        </Link>
        <Link
          href="/organize"
          className="inline-flex items-center gap-1.5 rounded-md border border-accent/40 bg-background/40 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent/20"
        >
          <Sparkles className="h-3.5 w-3.5" /> Organize
        </Link>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/quick-actions.tsx
git commit -m "Phase 6: dashboard/quick-actions.tsx — pill row of nav CTAs"
```

---

## Task 5: `<NeedsAttention>` widget

**Files:**
- Create: `components/dashboard/needs-attention.tsx`

- [ ] **Step 1: Create the component**

Create `components/dashboard/needs-attention.tsx`:

```tsx
import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";

import { Card } from "@/components/ui/card";

type Props = {
  unassignedVehicles: number;
  activeUndoPlan: {
    id: string;
    appliedAt: string;     // ISO
    expiresAt: string;     // ISO
  } | null;
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((then - now) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

export function NeedsAttention({ unassignedVehicles, activeUndoPlan }: Props) {
  if (unassignedVehicles === 0 && activeUndoPlan === null) return null;

  return (
    <Card className="border-amber-500/30 bg-amber-500/5">
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-amber-500">
          <AlertTriangle className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wider font-medium">
            Needs attention
          </span>
        </div>
        <div className="flex flex-col gap-1.5 text-sm">
          {unassignedVehicles > 0 && (
            <Link
              href="/my-vehicles?unassigned=1"
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-amber-500/10 transition-colors"
            >
              <span>
                <span className="font-semibold tabular-nums">
                  {unassignedVehicles}
                </span>{" "}
                unassigned {unassignedVehicles === 1 ? "vehicle" : "vehicles"}
              </span>
              <span className="text-xs text-muted-foreground">
                → Assign or organize
              </span>
            </Link>
          )}
          {activeUndoPlan && (
            <Link
              href="/organize"
              className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-amber-500/10 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                Plan applied {relativeTime(activeUndoPlan.appliedAt)} — undo
                expires {relativeTime(activeUndoPlan.expiresAt)}
              </span>
              <span className="text-xs text-muted-foreground">→ Review</span>
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/needs-attention.tsx
git commit -m "Phase 6: dashboard/needs-attention.tsx — conditional amber panel"
```

---

## Task 6: `<BreakdownChips>` widget

**Files:**
- Create: `components/dashboard/breakdown-chips.tsx`

- [ ] **Step 1: Create the component**

Create `components/dashboard/breakdown-chips.tsx`:

```tsx
import Link from "next/link";
import { BarChart3 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type ChipRow = Array<{ label: string; count: number; href: string }>;

type Props = {
  vehicleClasses: ChipRow;
  propertySubtypes: ChipRow;
};

function ChipList({ rows }: { rows: ChipRow }) {
  if (rows.length === 0) {
    return (
      <span className="text-xs text-muted-foreground">No data yet.</span>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {rows.map((r) => (
        <Link key={r.label} href={r.href}>
          <Badge
            variant="secondary"
            className="cursor-pointer hover:bg-accent/30 transition-colors"
          >
            {r.label}{" "}
            <span className="ml-1 font-semibold tabular-nums">{r.count}</span>
          </Badge>
        </Link>
      ))}
    </div>
  );
}

export function BreakdownChips({ vehicleClasses, propertySubtypes }: Props) {
  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BarChart3 className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wider font-medium">
            Portfolio breakdown
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Vehicles by class</p>
          <ChipList rows={vehicleClasses} />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">Properties by type</p>
          <ChipList rows={propertySubtypes} />
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/breakdown-chips.tsx
git commit -m "Phase 6: dashboard/breakdown-chips.tsx — class + subtype chip rows"
```

---

## Task 7: `<CapacityCard>` + `<CatalogCard>` widgets

**Files:**
- Create: `components/dashboard/capacity-card.tsx`
- Create: `components/dashboard/catalog-card.tsx`

- [ ] **Step 1: Create CapacityCard**

Create `components/dashboard/capacity-card.tsx`:

```tsx
import { Target } from "lucide-react";

import { Card } from "@/components/ui/card";

type Props = {
  used: number;
  total: number;
  percent: number;
};

export function CapacityCard({ used, total, percent }: Props) {
  const empty = total === 0;
  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Target className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wider font-medium">
            Capacity
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-semibold tabular-nums">
              {empty ? "—" : `${used} / ${total}`}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              {empty ? "" : `${percent}%`}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${empty ? 0 : percent}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {empty
              ? "No properties owned yet."
              : "Garage slots used across all properties."}
          </p>
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Create CatalogCard**

Create `components/dashboard/catalog-card.tsx`:

```tsx
import { Trophy } from "lucide-react";

import { Card } from "@/components/ui/card";

type Row = { ownedUnique: number; total: number; percent: number };

type Props = {
  vehicles: Row;
  properties: Row;
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

export function CatalogCard({ vehicles, properties }: Props) {
  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Trophy className="h-4 w-4" />
          <span className="text-xs uppercase tracking-wider font-medium">
            Catalog
          </span>
        </div>
        <ProgressRow label="Vehicles" row={vehicles} />
        <ProgressRow label="Properties" row={properties} />
        <p className="text-xs text-muted-foreground">
          Unique types owned out of the GTA V catalog.
        </p>
      </div>
    </Card>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/dashboard/capacity-card.tsx components/dashboard/catalog-card.tsx
git commit -m "Phase 6: dashboard/capacity-card.tsx + catalog-card.tsx"
```

---

## Task 8: `<RecentActivity>` widget

**Files:**
- Create: `components/dashboard/recent-activity.tsx`

- [ ] **Step 1: Create the component**

Create `components/dashboard/recent-activity.tsx`:

```tsx
import Link from "next/link";
import { Bot, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { PlanSummaryRow } from "@/lib/queries/organizer";

type Props = {
  plans: PlanSummaryRow[];
};

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "applied":
    case "completed":
      return "default";
    case "checklist":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const diffSec = Math.round((then - now) / 1000);
  const abs = Math.abs(diffSec);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(diffSec, "second");
  if (abs < 3600) return rtf.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diffSec / 3600), "hour");
  return rtf.format(Math.round(diffSec / 86400), "day");
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

export function RecentActivity({ plans }: Props) {
  return (
    <Card>
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Bot className="h-4 w-4" />
            <span className="text-xs uppercase tracking-wider font-medium">
              Recent organizer activity
            </span>
          </div>
          <Link
            href="/organize"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            View all →
          </Link>
        </div>

        {plans.length === 0 ? (
          <Link
            href="/organize"
            className="flex items-center gap-2 rounded-md border border-dashed border-muted-foreground/20 p-3 text-sm text-muted-foreground hover:bg-accent/20 transition-colors"
          >
            <Sparkles className="h-4 w-4 text-accent-foreground" />
            No organizer activity yet — try the AI Organizer
          </Link>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {plans.map((p) => (
              <li key={p.id}>
                <Link
                  href="/organize"
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent/20 transition-colors"
                >
                  <span className="flex-1 min-w-0 truncate">
                    {truncate(p.prompt, 60)}
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
                    <span>
                      {p.completed_count}/{p.step_count} steps
                    </span>
                    <Badge variant={statusVariant(p.status)} className="text-[10px]">
                      {p.status}
                    </Badge>
                    <span className="tabular-nums">
                      {relativeTime(p.created_at)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/recent-activity.tsx
git commit -m "Phase 6: dashboard/recent-activity.tsx — last 5 organizer plans"
```

---

## Task 9: `<EmptyDashboard>` shell

**Files:**
- Create: `app/(app)/dashboard/empty-dashboard.tsx`

- [ ] **Step 1: Create the empty-state component**

Create `app/(app)/dashboard/empty-dashboard.tsx`:

```tsx
import Link from "next/link";
import { Car, Home, Sparkles, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type Props = {
  userName: string | null;
};

export function EmptyDashboard({ userName }: Props) {
  const greeting = userName
    ? `Welcome to LS Portfolio, ${userName}.`
    : "Welcome to LS Portfolio.";

  return (
    <div className="flex flex-col gap-6 max-w-3xl mx-auto">
      <div className="text-center pt-4">
        <h1 className="text-3xl font-semibold tracking-tight">{greeting}</h1>
        <p className="mt-2 text-muted-foreground">
          Let&apos;s build your portfolio.
        </p>
      </div>

      <Card className="border-accent/40 bg-accent/5">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <Wand2 className="h-8 w-8 text-accent-foreground" />
          <CardTitle>Run the setup wizard</CardTitle>
          <CardDescription>
            Walk through your properties, then add the vehicles stored at each
            one. Fastest way to get started.
          </CardDescription>
          <Button asChild size="lg" className="mt-2">
            <Link href="/wizard">Start setup wizard</Link>
          </Button>
        </CardContent>
      </Card>

      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
          Or jump straight in
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <Link href="/vehicles" className="block">
            <Card className="h-full transition-colors hover:bg-accent/20">
              <CardContent className="flex flex-col gap-2 p-4">
                <Car className="h-5 w-5 text-accent-foreground" />
                <CardTitle className="text-base">Browse all vehicles</CardTitle>
                <CardDescription className="text-xs">
                  Pick from 800+ vehicles in the GTA V catalog and mark what
                  you own.
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <Link href="/properties" className="block">
            <Card className="h-full transition-colors hover:bg-accent/20">
              <CardContent className="flex flex-col gap-2 p-4">
                <Home className="h-5 w-5 text-accent-foreground" />
                <CardTitle className="text-base">Browse properties</CardTitle>
                <CardDescription className="text-xs">
                  166 properties — apartments, garages, businesses.
                </CardDescription>
              </CardContent>
            </Card>
          </Link>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="block cursor-not-allowed">
                  <Card className="h-full opacity-50">
                    <CardContent className="flex flex-col gap-2 p-4">
                      <Sparkles className="h-5 w-5 text-accent-foreground" />
                      <CardTitle className="text-base">
                        Try the AI organizer
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Natural-language portfolio organization.
                      </CardDescription>
                    </CardContent>
                  </Card>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                Add vehicles + a property first.
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify Tooltip primitive exists**

Run: `ls components/ui/tooltip.tsx`
Expected: file exists.

If it doesn't, add it via shadcn:

```bash
npx shadcn@latest add tooltip
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/dashboard/empty-dashboard.tsx
# (also add components/ui/tooltip.tsx if it was newly added)
git commit -m "Phase 6: dashboard/empty-dashboard.tsx — onboarding view"
```

---

## Task 10: `<DashboardLayout>` server component

This is the visual composition layer. Takes the derived `DashboardData` and arranges widgets in C1 vertical order.

**Files:**
- Create: `app/(app)/dashboard/dashboard-layout.tsx`

- [ ] **Step 1: Create the layout component**

Create `app/(app)/dashboard/dashboard-layout.tsx`:

```tsx
import type { PlanSummaryRow } from "@/lib/queries/organizer";

import { BreakdownChips } from "@/components/dashboard/breakdown-chips";
import { CapacityCard } from "@/components/dashboard/capacity-card";
import { CatalogCard } from "@/components/dashboard/catalog-card";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TotalsStrip } from "@/components/dashboard/totals-strip";

type SubSplit = Array<{ label: string; count: number }>;
type ChipRow = Array<{ label: string; count: number; href: string }>;

export type DashboardData = {
  greetingName: string | null;
  vehicles: { total: number; splits: SubSplit };
  properties: { total: number; splits: SubSplit };
  businesses: { total: number; splits: SubSplit };
  capacity: { used: number; total: number; percent: number };
  breakdown: { vehicleClasses: ChipRow; propertySubtypes: ChipRow };
  catalog: {
    vehicles: { ownedUnique: number; total: number; percent: number };
    properties: { ownedUnique: number; total: number; percent: number };
  };
  attention: {
    unassignedVehicles: number;
    activeUndoPlan: {
      id: string;
      appliedAt: string;
      expiresAt: string;
    } | null;
  };
  recentPlans: PlanSummaryRow[];
};

export function DashboardLayout({ data }: { data: DashboardData }) {
  const greeting = data.greetingName
    ? `Welcome back, ${data.greetingName}.`
    : "Welcome back.";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">{greeting}</h1>
        <p className="text-sm text-muted-foreground">
          Your GTA V portfolio at a glance.
        </p>
      </div>

      <TotalsStrip
        vehicles={data.vehicles}
        properties={data.properties}
        businesses={data.businesses}
      />

      <QuickActions />

      <NeedsAttention
        unassignedVehicles={data.attention.unassignedVehicles}
        activeUndoPlan={data.attention.activeUndoPlan}
      />

      <BreakdownChips
        vehicleClasses={data.breakdown.vehicleClasses}
        propertySubtypes={data.breakdown.propertySubtypes}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <CapacityCard {...data.capacity} />
        <CatalogCard
          vehicles={data.catalog.vehicles}
          properties={data.catalog.properties}
        />
      </div>

      <RecentActivity plans={data.recentPlans} />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/dashboard/dashboard-layout.tsx
git commit -m "Phase 6: dashboard/dashboard-layout.tsx — widget composition"
```

---

## Task 11: Rewrite `dashboard/page.tsx` — parallel fetch + derive + branch

This is the load-bearing one. Replaces the four-em-dash stub with the real page.

**Files:**
- Modify: `app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Replace the stub with the real page**

Replace `app/(app)/dashboard/page.tsx` entirely with:

```tsx
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOwnedCounts } from "@/lib/queries/vehicles";
import { getOwnedVehicleInstances } from "@/lib/queries/my-vehicles";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";
import {
  getActiveUndoablePlan,
  getRecentPlans,
} from "@/lib/queries/organizer";
import { getCatalogTotals } from "@/lib/queries/dashboard";
import { assetCategoryOf } from "@/lib/vehicles";

import { DashboardLayout, type DashboardData } from "./dashboard-layout";
import { EmptyDashboard } from "./empty-dashboard";

type SubSplit = Array<{ label: string; count: number }>;
type ChipRow = Array<{ label: string; count: number; href: string }>;

function topN<T>(
  items: T[],
  keyOf: (t: T) => string,
  n: number,
): Array<{ label: string; count: number }> {
  const counts = new Map<string, number>();
  for (const item of items) {
    const k = keyOf(item);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, n);
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [
    { data: profile },
    counts,
    vehicleInstances,
    ownedProperties,
    recentPlans,
    activeUndoPlan,
    catalogTotals,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .maybeSingle(),
    getOwnedCounts(user.id),
    getOwnedVehicleInstances(user.id),
    getOwnedPropertiesWithStorage(user.id),
    getRecentPlans(user.id, 5),
    getActiveUndoablePlan(user.id),
    getCatalogTotals(),
  ]);

  const greetingName = profile?.display_name ?? profile?.username ?? null;

  // Empty-state branch — fire when literally nothing is owned.
  if (counts.vehicles === 0 && counts.properties === 0 && counts.businesses === 0) {
    return <EmptyDashboard userName={greetingName} />;
  }

  // --- Vehicle splits (cars / aircraft / boats) ---
  let cars = 0, aircraft = 0, boats = 0;
  for (const v of vehicleInstances) {
    const cat = assetCategoryOf(v.class);
    if (cat === "air") aircraft += 1;
    else if (cat === "sea") boats += 1;
    else cars += 1;
  }
  const vehicleSplits: SubSplit = [
    { label: "cars", count: cars },
    { label: "aircraft", count: aircraft },
    { label: "boats", count: boats },
  ];

  // --- Property splits by ownership_group, plus business splits ---
  // ownedProperties from getOwnedPropertiesWithStorage represents both
  // residence/garage and businesses (property_type === "business" rows are
  // owned via the same table). Use ownership_group from the row to bucket;
  // businesses get their own card via getOwnedCounts. Property card excludes
  // businesses.
  let residential = 0, garage = 0, otherProp = 0;
  const businessSubtypes: string[] = [];
  for (const p of ownedProperties) {
    // ownership_group "business" lives here too; counts.businesses already
    // splits it out for the Businesses card. For the Properties card splits
    // we group only non-business groups.
    if (p.ownership_group === "business") {
      businessSubtypes.push(p.subtype_display);
      continue;
    }
    if (p.ownership_group === "residential") residential += 1;
    else if (p.ownership_group === "garage") garage += 1;
    else otherProp += 1;
  }
  const propertySplits: SubSplit = [
    { label: "residential", count: residential },
    { label: "garages", count: garage },
    { label: "other", count: otherProp },
  ];

  // Top 3 business subtypes by count.
  const businessSplits: SubSplit = topN(
    businessSubtypes,
    (s) => s,
    3,
  );

  // --- Capacity ---
  let capacityTotal = 0;
  for (const p of ownedProperties) {
    capacityTotal += p.base_capacity;
    for (const u of p.upgrades) {
      if (u.is_installed) capacityTotal += u.capacity;
    }
  }
  const capacityUsed = vehicleInstances.filter((v) => v.storage !== null)
    .length;
  const capacityPercent =
    capacityTotal === 0 ? 0 : Math.round((capacityUsed / capacityTotal) * 100);

  // --- Breakdown chips ---
  const vehicleClassTop5 = topN(vehicleInstances, (v) => v.class, 5).map(
    (r) => ({
      ...r,
      href: `/vehicles?class=${encodeURIComponent(r.label)}`,
    }),
  ) as ChipRow;

  const propertySubtypeTop3 = topN(
    ownedProperties,
    (p) => p.subtype_display,
    3,
  ).map((r) => {
    // Use the subtype slug (not the display label) for the URL.
    const slug = ownedProperties.find((p) => p.subtype_display === r.label)
      ?.subtype;
    return {
      ...r,
      href: slug
        ? `/properties?subtype=${encodeURIComponent(slug)}`
        : "/properties",
    };
  }) as ChipRow;

  // --- Catalog % (unique types owned vs catalog total) ---
  const uniqueVehicleTypes = new Set(
    vehicleInstances.map((v) => v.vehicle_id),
  ).size;
  const uniquePropertyTypes = new Set(ownedProperties.map((p) => p.property_id))
    .size;
  const catalogVehiclePercent =
    catalogTotals.vehicles === 0
      ? 0
      : Math.round((uniqueVehicleTypes / catalogTotals.vehicles) * 100);
  const catalogPropertyPercent =
    catalogTotals.properties === 0
      ? 0
      : Math.round((uniquePropertyTypes / catalogTotals.properties) * 100);

  // --- Needs attention ---
  const unassignedVehicles = vehicleInstances.filter((v) => v.storage === null)
    .length;
  const activeUndoForWidget = activeUndoPlan
    ? {
        id: activeUndoPlan.id,
        appliedAt: activeUndoPlan.applied_at ?? activeUndoPlan.created_at,
        expiresAt:
          activeUndoPlan.undo_expires_at ?? activeUndoPlan.created_at,
      }
    : null;

  const data: DashboardData = {
    greetingName,
    vehicles: { total: counts.vehicles, splits: vehicleSplits },
    properties: { total: counts.properties, splits: propertySplits },
    businesses: { total: counts.businesses, splits: businessSplits },
    capacity: {
      used: capacityUsed,
      total: capacityTotal,
      percent: capacityPercent,
    },
    breakdown: {
      vehicleClasses: vehicleClassTop5,
      propertySubtypes: propertySubtypeTop3,
    },
    catalog: {
      vehicles: {
        ownedUnique: uniqueVehicleTypes,
        total: catalogTotals.vehicles,
        percent: catalogVehiclePercent,
      },
      properties: {
        ownedUnique: uniquePropertyTypes,
        total: catalogTotals.properties,
        percent: catalogPropertyPercent,
      },
    },
    attention: {
      unassignedVehicles,
      activeUndoPlan: activeUndoForWidget,
    },
    recentPlans,
  };

  return <DashboardLayout data={data} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/dashboard/page.tsx
git commit -m "Phase 6: dashboard/page.tsx — parallel fetch + derive + branch"
```

---

## Task 12: Manual smoke + plan.md update + merge prep

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Smoke checklist — empty state**

Sign in as a brand-new account (or temporarily un-own everything via the UI / SQL).

- Visit `/dashboard`.
- Verify the empty-state hero shows: `Welcome to LS Portfolio, <name>.` (or no name if profile is bare)
- "Run the setup wizard" button is present and links to `/wizard`.
- Three secondary cards (Browse vehicles · Browse properties · Try AI organizer) render.
- Hovering "Try the AI organizer" shows tooltip `Add vehicles + a property first.` and the card is dimmed/disabled.

- [ ] **Step 3: Smoke checklist — full dashboard**

Sign in as an account with full ownership (the dev seed account).

- Visit `/dashboard`. Verify all widgets render without errors:
  - **TotalsStrip** — three cards, big numbers, sub-lines showing splits (only non-zero classes appear)
  - **QuickActions** — three pills, all link correctly
  - **NeedsAttention** — appears if unassigned vehicles > 0 OR a plan is within undo window. Should disappear when both are zero.
  - **BreakdownChips** — vehicles row shows top 5 classes with counts; properties row shows top 3 subtypes; chip click navigates to filtered `/vehicles?class=` or `/properties?subtype=`.
  - **CapacityCard** — bar fills proportionally; `used / total (percent%)` matches manual count.
  - **CatalogCard** — two bars for vehicles + properties; percents calculate against catalog totals.
  - **RecentActivity** — shows last 5 plans with status pills and relative times; "View all →" navigates to `/organize`.

- [ ] **Step 4: Smoke checklist — interactions**

- Click any TotalsStrip card → lands on `/my-vehicles`, `/my-properties`, or `/my-businesses`.
- Click `NeedsAttention` "unassigned" row → `/my-vehicles?unassigned=1` opens with the filter pre-applied.
- Click any breakdown chip → filtered browse page opens with the filter applied.
- Resize the window to mobile width (`< 640px`):
  - TotalsStrip collapses to 1-col.
  - CapacityCard + CatalogCard stack.
  - QuickActions pills wrap.
  - No overflow / no horizontal scroll.

- [ ] **Step 5: Smoke checklist — math correctness**

Pick two spot-checks against the seed data:

- **Capacity total:** open a property in `/my-properties`, sum `base_capacity + Σ installed-upgrade capacity`. Verify the dashboard total reflects the sum across all owned properties.
- **Catalog % for vehicles:** distinct `vehicle_id` count in your owned set ÷ `808` (current catalog count) × 100 → matches the percent shown.

- [ ] **Step 6: Update `docs/plan.md`**

Open `docs/plan.md` and:

1. Update the "Current phase" line to reflect Phase 6 dashboard complete.
2. Update "Last updated" to today's date.
3. Add a new "Where we left off" entry at the top of that section (2026-05-26) summarising what landed — story-stacked dashboard, 7 widgets, empty-state onboarding, URL-driven `?unassigned=1` piggyback.
4. Flip Phase 6 row in the Phase Overview table from ⚪ to 🟢/✅.

- [ ] **Step 7: Final commit**

```bash
git add docs/plan.md
git commit -m "docs: plan.md — Phase 6 dashboard landed"
```

- [ ] **Step 8: Hand off**

The branch `feat/phase-6-dashboard` is ready. Confirm with James whether to merge to `main` directly or open a PR.

---

## Out of scope (deferred, per spec §9)

- Per-asset-class drill-down charts
- Re-orderable / configurable widgets
- Live updates
- Sparklines / trend lines
- Per-plan deep links from `RecentActivity` (`/organize?plan=<id>`)
- Pro tier paywall wrap (Phase 9)
