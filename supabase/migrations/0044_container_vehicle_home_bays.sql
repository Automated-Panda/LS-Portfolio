-- 0044_container_vehicle_home_bays.sql
-- Container vehicles live at their business HQ: the MOC in a Bunker, the
-- Terrorbyte in a Nightclub or Garment Factory. Like the Facility's weaponized
-- bays (0036), model each as an included-on-purchase, single-vehicle bay (a
-- vehicle-bound sub_slot) on the host property — so the vehicle has a real spot
-- there and the storage picker can bind it to that property (lib/bays.ts).
-- Migration-only (DB is the source of truth for property structure). Idempotent.

-- Bunker → Mobile Operations Center
insert into public.property_upgrades
  (id, property_id, display_name, tier, capacity, required_upgrade_id,
   sort_order, price, included_on_purchase, mutex_group, sub_slots)
select
  p.id || '-moc-bay', p.id, 'MOC Storage', null, 1, null, 50, 0, true, null,
  '[{"label":"Mobile Operations Center","capacity":1,"vehicle_id":"moc"}]'::jsonb
from public.properties p
where p.subtype = 'bunker'
on conflict (id) do update set
  capacity = excluded.capacity,
  display_name = excluded.display_name,
  included_on_purchase = excluded.included_on_purchase,
  sub_slots = excluded.sub_slots;

-- Nightclub + Garment Factory → Terrorbyte
insert into public.property_upgrades
  (id, property_id, display_name, tier, capacity, required_upgrade_id,
   sort_order, price, included_on_purchase, mutex_group, sub_slots)
select
  p.id || '-terrorbyte-bay', p.id, 'Terrorbyte Storage', null, 1, null, 50, 0,
  true, null,
  '[{"label":"Terrorbyte","capacity":1,"vehicle_id":"terbyte"}]'::jsonb
from public.properties p
where p.subtype in ('nightclub', 'garment-factory')
on conflict (id) do update set
  capacity = excluded.capacity,
  display_name = excluded.display_name,
  included_on_purchase = excluded.included_on_purchase,
  sub_slots = excluded.sub_slots;
