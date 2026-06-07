// app/admin/content/fetch-content.ts
import { createAdminClient } from "@/lib/supabase/admin";

import type { AdminContentProperty } from "./admin-content-list";

type RawUpgrade = {
  id: string;
  display_name: string;
  capacity: number;
  price: number | null;
  mutex_group: string | null;
  mutex_allow_none: boolean;
  included_on_purchase: boolean;
  required_upgrade_id: string | null;
  sort_order: number | null;
};
type RawProperty = {
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
  property_upgrades: RawUpgrade[] | null;
};

/** Fetch properties (of the given property_types) with their upgrades, shaped
 *  for the admin Content list. */
export async function fetchContent(types: string[]): Promise<AdminContentProperty[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("properties")
    .select(
      "id, display_name, property_type, subtype, subtype_display, neighborhood, capacity, counts_as_garage, price, image_path, status, property_upgrades(id, display_name, capacity, price, mutex_group, mutex_allow_none, included_on_purchase, required_upgrade_id, sort_order)",
    )
    .in("property_type", types)
    .order("display_name", { ascending: true });
  if (error) throw error;

  const rows = (data ?? []) as unknown as RawProperty[];
  return rows.map((r) => ({
    id: r.id,
    display_name: r.display_name,
    property_type: r.property_type,
    subtype: r.subtype,
    subtype_display: r.subtype_display,
    neighborhood: r.neighborhood,
    capacity: r.capacity,
    counts_as_garage: r.counts_as_garage,
    price: r.price,
    image_path: r.image_path,
    status: r.status,
    upgrades: (r.property_upgrades ?? [])
      .map((u) => ({
        id: u.id,
        display_name: u.display_name,
        capacity: u.capacity,
        price: u.price,
        mutex_group: u.mutex_group,
        mutex_allow_none: u.mutex_allow_none,
        included_on_purchase: u.included_on_purchase,
        required_upgrade_id: u.required_upgrade_id,
        sort_order: u.sort_order ?? 0,
      }))
      .sort((a, b) => a.sort_order - b.sort_order),
  }));
}
