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
  const activeUndoForWidget =
    activeUndoPlan && activeUndoPlan.applied_at && activeUndoPlan.undo_expires_at
      ? {
          id: activeUndoPlan.id,
          appliedAt: activeUndoPlan.applied_at,
          expiresAt: activeUndoPlan.undo_expires_at,
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
