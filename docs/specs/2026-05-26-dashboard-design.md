# Dashboard — Design Spec

**Date:** 2026-05-26
**Phase:** 6 — Dashboard
**Status:** Spec → awaiting user review → implementation plan

---

## 1. Goal

Replace the `/dashboard` stub (four em-dashed cards) with a real portfolio overview. The dashboard is the user's landing page after login — it should communicate where their portfolio stands at a glance and surface the next sensible action.

**Purpose:** stats-led, with secondary CTAs. Informative first, actionable second.

**Audience:** equal weight to onboarding and returning-user states. A user with zero ownership sees a welcoming empty state guiding them to setup paths. A user with any ownership sees the full widget dashboard.

---

## 2. Layout (C1 — story-stacked + quick actions near top)

Vertical sections, each its own "story", full-width on desktop. Selected during brainstorming over hero-strip and main-sidebar variants.

```
┌─────────────────────────────────────────────┐
│ Welcome, <name>.                            │  (page title block)
├─────────────────────────────────────────────┤
│ Vehicles 127         Properties 12          │
│ 127 cars · 8 air     7 res · 3 garage       │  TotalsStrip
│ · 4 boats            · 2 other              │
│                                             │
│                  Businesses 5               │
├─────────────────────────────────────────────┤
│ ⚡ Quick actions    [+Vehicle] [+Prop] [✨] │  QuickActions
├─────────────────────────────────────────────┤
│ ⚠️ Needs attention                          │  NeedsAttention (conditional)
│ 14 unassigned vehicles · Plan within undo   │
├─────────────────────────────────────────────┤
│ 📊 Portfolio breakdown                      │  BreakdownChips
│ Super 18 · Sport 22 · Muscle 15 · …         │
│ Apt 7 · Garage 3 · Business 5               │
├─────────────────────────────────────────────┤
│ 🎯 Capacity         🏆 Catalog              │  CapacityCard + CatalogCard
│ 127 / 280 (45%)     127 / 808 vehicles 16%  │
│ ▓▓▓▓░░░░░░          ▓░░░░░░░░░               │
├─────────────────────────────────────────────┤
│ 🤖 Recent activity                          │  RecentActivity
│ "Move drift cars to Eclipse"  applied 3h ago│
│ "Spread sports across props"  checklist 1d  │
└─────────────────────────────────────────────┘
```

Mobile: same vertical order; totals strip collapses from 3-col to 1-col; capacity + catalog stack.

---

## 3. Architecture

### File layout

```
app/(app)/dashboard/
  page.tsx                  server component — auth, parallel fetch, derive metrics, branch empty/full
  dashboard-layout.tsx      server component — renders widgets in C1 order, receives derived props
  empty-dashboard.tsx       server component — onboarding mode, used when no owned items

components/dashboard/
  totals-strip.tsx          3 hero stat cards
  quick-actions.tsx         pill row of nav CTAs
  needs-attention.tsx       conditional amber panel
  breakdown-chips.tsx       class + subtype chip rows
  capacity-card.tsx         used/total + progress bar
  catalog-card.tsx          owned/total + progress bar (vehicles + properties)
  recent-activity.tsx       last 5 organizer plans

lib/queries/
  dashboard.ts              NEW — getCatalogTotals(): { vehicles, properties }
```

### Data fetching — Approach C (reuse existing queries + page-level composition)

The page-level server component fans out six queries in parallel and derives all dashboard metrics in the page body. Widgets are presentational — they receive plain props.

```ts
const [
  counts,                 // getOwnedCounts(userId)              — already exists
  vehicleInstances,       // getOwnedVehicleInstances(userId)    — already exists
  ownedProperties,        // getOwnedPropertiesWithStorage(userId) — already exists
  recentPlans,            // getRecentPlans(userId, 5)           — already exists
  activeUndoPlan,         // getActiveUndoablePlan(userId)       — already exists
  catalogTotals,          // getCatalogTotals()                  — new, slim
] = await Promise.all([...]);
```

Rationale: existing queries are already optimised for parallel fetch; widgets stay swappable; adding a future widget needs new props rather than new SQL. Tradeoff: `getOwnedVehicleInstances` returns more data than the dashboard strictly needs (full storage detail per vehicle), but at 100-300 instances per user the payload is well under 50kb.

### New query: `lib/queries/dashboard.ts`

```ts
export async function getCatalogTotals(): Promise<{
  vehicles: number;
  properties: number;
}> {
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

Pure counts, no joins, no user filter. Could be cached but not worth it at this stage.

---

## 4. Derived dashboard data shape

```ts
type DashboardData = {
  vehicles: {
    total: number;                                  // instance count
    splits: { cars: number; aircraft: number; boats: number };
  };
  properties: {
    total: number;
    splits: { residential: number; garage: number; other: number };
  };
  businesses: {
    total: number;
    splits: Array<{ subtypeDisplay: string; count: number }>;   // top 3
  };

  capacity: {
    used: number;
    total: number;
    percent: number;        // 0 when total === 0
  };

  breakdown: {
    vehicleClasses: Array<{ label: string; count: number }>;    // top 5
    propertySubtypes: Array<{ label: string; count: number }>;  // top 3
  };

  catalog: {
    vehicles:   { ownedUnique: number; total: number; percent: number };
    properties: { ownedUnique: number; total: number; percent: number };
  };

  attention: {
    unassignedVehicles: number;
    activeUndoPlan: { id: string; appliedAt: string; expiresAt: string } | null;
  };

  recentPlans: PlanSummaryRow[];                   // already-typed in lib/queries/organizer.ts
};
```

### Key derivations

- **`vehicles.splits`** — group `getOwnedVehicleInstances()` by a coarse `assetClass(class)` helper. Buckets: `aircraft` (Planes, Helicopters), `boats` (Boats), `cars` (everything else, including motorcycles/bikes/cycles — we don't surface bikes as their own line in the TotalsStrip sub-line). New helper lives in `lib/vehicles.ts`.
- **`properties.splits`** — group `ownedProperties` by `ownership_group` (`residential`, `garage`, anything else → `other`).
- **`capacity.total`** — reduce over `ownedProperties`: `base_capacity + Σ upgrade.capacity where upgrade.is_installed`.
- **`capacity.used`** — count vehicles with `storage !== null`.
- **`unassignedVehicles`** — same list, `storage === null`.
- **`activeUndoPlan`** — direct from `getActiveUndoablePlan()`; trimmed to id/appliedAt/expiresAt for the widget.
- **`catalog.vehicles.ownedUnique`** — count distinct `vehicle_id` values in `vehicleInstances` (instances of the same vehicle collapse to 1). Same for properties.

### Empty-state trigger

```ts
if (counts.vehicles === 0 && counts.properties === 0 && counts.businesses === 0) {
  return <EmptyDashboard userName={profile.display_name ?? profile.username} />;
}
```

`profile` is already fetched by `(app)/layout.tsx`; the dashboard page re-fetches it (or accepts it via props) to derive the greeting name. We'll re-fetch in `page.tsx` to keep the page self-contained — one extra `profiles` row read is negligible.

Partial setup (e.g. 0 vehicles, 1 property) still renders the full dashboard. Individual widgets handle their own zero cases.

---

## 5. Widget specs

All widgets are **server components** receiving plain props. No `"use client"` directives. Navigation is via `next/link` only — no server actions, no client-side state.

### 5.1 `<TotalsStrip>`

Three hero cards in a row:

- **Vehicles** — big number `total` + sub-line `127 cars · 8 aircraft · 4 boats` (zero-class items omitted). Whole card → `/my-vehicles`.
- **Properties** — big number `total` + sub-line `7 residential · 3 garages · 2 other`. Whole card → `/my-properties`.
- **Businesses** — big number `total` + sub-line of top 3 business subtypes by count. Whole card → `/my-businesses`.

Card chrome: existing `<Card>` primitive. Hover state matches existing card-as-link pattern.

### 5.2 `<QuickActions>`

Pill row in a slim card with forest-green-tinted background:

- `+ Vehicle` → `/vehicles`
- `+ Property` → `/properties`
- `✨ Organize` → `/organize`

Each pill is a small `<Button variant="outline">` style with an icon. Stays one row on desktop; wraps on mobile.

### 5.3 `<NeedsAttention>` (conditional)

Returns `null` when both `attention.unassignedVehicles === 0` and `attention.activeUndoPlan === null`.

Amber-tinted panel (`border-amber-500/30 bg-amber-500/5`). Up to two rows:

- **N unassigned vehicles** → `/my-vehicles?unassigned=1` (link target depends on the piggyback task below)
- **Plan within undo window** — "Last plan applied <relativeTime>, undo expires in <countdown>" → `/organize`

### 5.4 `<BreakdownChips>`

Single card with two label rows:

- **Vehicles by class** — top 5 chips: `Super 18` · `Sport 22` · `Muscle 15` · `Bike 12` · `Sport Classic 9`. Chip click → `/vehicles?class=<class>` (filter already exists).
- **Properties by type** — top 3 chips: `Apartment 7` · `Garage 3` · `Business 5`. Chip click → `/properties?subtype=<subtype>` (filter already exists).

Chips use the existing `<Badge>` primitive.

### 5.5 `<CapacityCard>` + `<CatalogCard>`

Side-by-side row, 2-col on desktop (`md:grid-cols-2`), stacked on mobile.

- **Capacity** — progress bar + `127 / 280 (45%)` + caption "Garage slots used across all properties". When `capacity.total === 0`, render `— / —` with caption "No properties owned yet".
- **Catalog** — two stacked progress bars + counts: `127 / 808 vehicles (16%)` and `12 / 166 properties (7%)`. Caption "Unique types owned out of the GTA V catalog".

Both use the same internal progress-bar component (shadcn `<Progress>` or a simple Tailwind bar).

### 5.6 `<RecentActivity>`

List card. Shows last 5 `recentPlans` rows:

- Truncated prompt (60ch with ellipsis)
- Relative time ("3h ago", "1d ago")
- Status pill (`applied` · `checklist` · `undone` · `failed`) — color-coded
- Step count ("3 steps")

Whole row → `/organize` (deep link to specific plan deferred — not in scope).

Empty case: small "No organizer activity yet — try the AI Organizer" CTA → `/organize`.

---

## 6. Empty / onboarding dashboard

Renders when `vehicles.total === 0 && properties.total === 0 && businesses.total === 0`.

### Content

- **Hero block** — "Welcome to LS Portfolio, <name>." + sub-line "Let's build your portfolio."
- **Primary CTA** — single large button: **Run the setup wizard** → `/wizard`.
- **Secondary cards** — three smaller cards explaining the manual paths, each with its own small CTA:
  - 🚗 **Browse all vehicles** → `/vehicles` ("Pick from 800+ vehicles in the GTA V catalog and mark what you own.")
  - 🏠 **Browse properties** → `/properties` ("166 properties — apartments, garages, businesses.")
  - ✨ **Try the AI organizer** → `/organize`, **disabled with tooltip** "Add vehicles + a property first" (organizer is meaningless with empty portfolio)

### Layout

Same `<Card>` chrome as the full dashboard. Centred content, plenty of whitespace. Feels like a welcoming empty state, not a blank page.

---

## 7. Piggyback: URL-driven `unassigned` filter on `/my-vehicles`

The `NeedsAttention` widget wants to deep-link to "show me my unassigned vehicles". Today `unassignedOnly` is local React state in `my-vehicles-client.tsx`, not URL-driven.

**Fix as part of this work:** convert `unassignedOnly` state to a URL-driven `?unassigned=1` param, consistent with how `/vehicles` does `?q=`, `?class=`, `?mfr=`. Roughly 10 lines: `useSearchParams` to read, `router.replace` on toggle.

Without this piggyback the widget would have to link to `/my-vehicles` with no filter and let the user click — fine but unpolished.

---

## 8. Error handling, mobile, performance, testing

### Error handling

- Page-level: if any of the parallel queries throws, the nearest Next `error.tsx` boundary catches. No dashboard-specific boundary.
- Per-widget defensive: divide-by-zero guards on capacity / catalog percentages (`total === 0 → render — / —`).

### Mobile

- Same C1 vertical stack on mobile.
- TotalsStrip: 3-col → 1-col stacked on `< sm`.
- Capacity + Catalog row: `md:grid-cols-2` → stacked on mobile.
- Quick actions pill row wraps.
- BreakdownChips chip rows wrap naturally.

### Performance

- 6 queries in `Promise.all`. Largest payload is `getOwnedVehicleInstances` — under 50kb at expected scale.
- No client-side data fetching; full SSR.
- Page is dynamic (auth-gated), no Next caching.

### Testing

Consistent with project pattern: no automated tests this phase. Manual smoke pass on `localhost:3000`:

- Empty state renders for a brand-new account
- Returning-user dashboard renders without errors when account has full data
- `Needs attention` panel appears when unassigned > 0
- `Needs attention` panel hides when all vehicles assigned and no active undo plan
- Capacity bar maths correct (sum of base + installed-upgrade capacity)
- Catalog % maths correct (unique vehicle/property types owned vs catalog totals)
- All chip links navigate to working filtered routes (`?class=`, `?subtype=`)
- `?unassigned=1` link on `/my-vehicles` opens with the filter pre-applied
- Mobile breakpoints don't break layout
- Empty state's "Try AI organizer" card is disabled with tooltip

---

## 9. Out of scope (deferred)

- Per-asset-class drill-downs (click vehicles → distribution chart)
- Re-orderable / configurable widgets
- Live updates (current design is render-on-navigate)
- Sparklines / trend lines (no historical data captured yet)
- Per-plan deep links from RecentActivity (`/organize?plan=<id>`)
- Pro tier paywall wrap (when Stripe lands in Phase 9)

---

## 10. Open questions

None at spec-write time. The `unassigned` filter piggyback (§7) is the only behavioural ambiguity uncovered during design and is included in scope.
