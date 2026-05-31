import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { getOwnedCounts } from "@/lib/queries/vehicles";
import { getOwnedVehicleInstances } from "@/lib/queries/my-vehicles";
import { getOwnedPropertiesWithStorage } from "@/lib/queries/my-properties";
import {
  getActiveUndoablePlan,
  getRecentPlans,
} from "@/lib/queries/organizer";
import { getCatalogCoverage } from "@/lib/queries/dashboard";
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
    catalogCoverage,
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
    getCatalogCoverage(user.id),
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
  // Businesses bucket into MC / Executive / Other for a clean compositional
  // split (mirrors the vehicle + property cards). "Other" catches standalone
  // businesses not tied to the MC or CEO/VIP loops (Nightclub, Arcade, Bunker,
  // Auto Shop, Hangar, Facility, Salvage Yard, Yacht, SP businesses, …).
  const MC_GROUPS = new Set([
    "mc-clubhouse",
    "biker-business-weed",
    "biker-business-coke",
    "biker-business-meth",
    "biker-business-cash",
    "biker-business-forgery",
  ]);
  const EXEC_GROUPS = new Set([
    "ceo-office",
    "agency",
    "vehicle-warehouse",
    "cargo-warehouse",
  ]);

  let residential = 0, garage = 0, otherProp = 0;
  let mcBiz = 0, execBiz = 0, otherBiz = 0;
  for (const p of ownedProperties) {
    // Businesses live in this same table but each carries its own
    // ownership_group (nightclub, agency, bunker…), so key off property_type —
    // not ownership_group === "business" — to split them out.
    if (p.property_type === "business") {
      if (MC_GROUPS.has(p.ownership_group)) mcBiz += 1;
      else if (EXEC_GROUPS.has(p.ownership_group)) execBiz += 1;
      else otherBiz += 1;
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
  const businessSplits: SubSplit = [
    { label: "MC", count: mcBiz },
    { label: "Executive", count: execBiz },
    { label: "Other", count: otherBiz },
  ];

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


  // Catalog coverage now uses cap-based denominators (e.g. residential cap of
  // 10, nightclub cap of 1) and splits properties from businesses — see
  // getCatalogCoverage / dashboard_catalog_group_rows.

  // --- Net worth ---
  // Sum vehicle prices over instances, property prices over owned, and
  // upgrade prices over installed upgrades. Null prices = not sourced yet —
  // count them so the widget can flag potential underestimate.
  let vehiclesValue = 0;
  let propertiesValue = 0;
  let upgradesValue = 0;
  let unpricedItems = 0;
  // Names of the owned items missing a price, so the card can list which ones.
  const unpricedVehicleCounts = new Map<string, number>();
  const unpricedProperties: string[] = [];
  const unpricedUpgrades: string[] = [];
  for (const v of vehicleInstances) {
    if (v.price === null) {
      unpricedItems += 1;
      unpricedVehicleCounts.set(
        v.display_name,
        (unpricedVehicleCounts.get(v.display_name) ?? 0) + 1,
      );
    } else vehiclesValue += v.price;
  }
  for (const p of ownedProperties) {
    if (p.price === null) {
      unpricedItems += 1;
      unpricedProperties.push(p.display_name);
    } else propertiesValue += p.price;
    for (const u of p.upgrades) {
      if (!u.is_installed) continue;
      if (u.price === null) {
        unpricedItems += 1;
        unpricedUpgrades.push(`${p.display_name} · ${u.display_name}`);
      } else upgradesValue += u.price;
    }
  }
  const netWorthTotal = vehiclesValue + propertiesValue + upgradesValue;
  const unpricedVehicles = Array.from(unpricedVehicleCounts.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, n]) => (n > 1 ? `${name} ×${n}` : name));
  unpricedProperties.sort((a, b) => a.localeCompare(b));
  unpricedUpgrades.sort((a, b) => a.localeCompare(b));

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
    },
    catalog: catalogCoverage,
    netWorth: {
      total: netWorthTotal,
      vehicles: vehiclesValue,
      properties: propertiesValue,
      upgrades: upgradesValue,
      unpricedItems,
      unpriced: {
        vehicles: unpricedVehicles,
        properties: unpricedProperties,
        upgrades: unpricedUpgrades,
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
