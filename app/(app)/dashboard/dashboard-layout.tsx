import type { PlanSummaryRow } from "@/lib/queries/organizer";

import { BreakdownChips } from "@/components/dashboard/breakdown-chips";
import { CapacityCard } from "@/components/dashboard/capacity-card";
import { CatalogCard } from "@/components/dashboard/catalog-card";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import { NetWorthCard } from "@/components/dashboard/net-worth-card";
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
  netWorth: {
    total: number;
    vehicles: number;
    properties: number;
    upgrades: number;
    unpricedItems: number;
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

      <NetWorthCard
        total={data.netWorth.total}
        vehicles={data.netWorth.vehicles}
        properties={data.netWorth.properties}
        upgrades={data.netWorth.upgrades}
        unpricedItems={data.netWorth.unpricedItems}
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
