import { NextResponse } from "next/server";

import { isAdmin } from "@/lib/admin/guard";
import { createClient } from "@/lib/supabase/server";

/**
 * Downloads a snapshot of all admin-curated values as JSON, for committing a
 * git backup. The vehicle_* sections match the seed sidecar formats
 * (vehicle-prices/availability/vendors); properties/upgrades are included as a
 * reference backup.
 */
export async function GET() {
  if (!(await isAdmin())) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const supabase = await createClient();
  const [v, p, u] = await Promise.all([
    supabase.from("vehicles").select("id, price, availability, vendors").order("id"),
    supabase
      .from("properties")
      .select("id, price, capacity, counts_as_garage")
      .order("id"),
    supabase
      .from("property_upgrades")
      .select("id, display_name, capacity, price")
      .order("id"),
  ]);
  if (v.error || p.error || u.error) {
    return new NextResponse("Export failed", { status: 500 });
  }

  const vehicle_prices: Record<string, number> = {};
  const vehicle_availability: Record<string, string> = {};
  const vehicle_vendors: Record<string, string[]> = {};
  for (const r of v.data ?? []) {
    if (r.price !== null) vehicle_prices[r.id] = r.price;
    if (r.availability && r.availability !== "available") {
      vehicle_availability[r.id] = r.availability;
    }
    if (Array.isArray(r.vendors) && r.vendors.length > 0) {
      vehicle_vendors[r.id] = r.vendors;
    }
  }

  const properties: Record<string, unknown> = {};
  for (const r of p.data ?? []) {
    properties[r.id] = {
      price: r.price,
      capacity: r.capacity,
      counts_as_garage: r.counts_as_garage,
    };
  }

  const property_upgrades: Record<string, unknown> = {};
  for (const r of u.data ?? []) {
    property_upgrades[r.id] = {
      display_name: r.display_name,
      capacity: r.capacity,
      price: r.price,
    };
  }

  const payload = {
    exported_at: new Date().toISOString(),
    vehicle_prices,
    vehicle_availability,
    vehicle_vendors,
    properties,
    property_upgrades,
  };

  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(payload, null, 2), {
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="gt-vault-curated-${date}.json"`,
    },
  });
}
