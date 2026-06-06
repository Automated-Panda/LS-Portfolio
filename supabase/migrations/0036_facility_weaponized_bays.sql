-- 0036_facility_weaponized_bays.sql
-- The Facility (Doomsday Heist) stores 7 personal vehicles (already its
-- base_capacity) PLUS 5 dedicated, single-vehicle weaponized bays — each bay
-- only fits one specific vehicle:
--   Avenger · Thruster · TM-02 Khanjali · Chernobog · RCV
--
-- Modelled as one included-on-purchase "Weaponized Bays" upgrade (capacity 5)
-- whose sub_slots carry a `vehicle_id` binding — a new sub_slot field that
-- pins a bay to exactly one vehicle. These five vehicles live ONLY in a
-- Facility bay (summon-only otherwise); the app honours that via lib/bays.ts.
--
-- DB is the source of truth for property structure (facilities were folded in
-- 0032/0033), so this is migration-only. Idempotent.

insert into public.property_upgrades
  (id, property_id, display_name, tier, capacity, required_upgrade_id,
   sort_order, price, included_on_purchase, mutex_group, sub_slots)
select
  p.id || '-weaponized-bays',
  p.id,
  'Weaponized Bays',
  null,
  5,
  null,
  5,
  0,
  true,
  null,
  '[
    {"label":"Avenger","capacity":1,"vehicle_id":"avenger"},
    {"label":"Thruster","capacity":1,"vehicle_id":"thruster"},
    {"label":"Khanjali","capacity":1,"vehicle_id":"khanjali"},
    {"label":"Chernobog","capacity":1,"vehicle_id":"chernobog"},
    {"label":"RCV","capacity":1,"vehicle_id":"riot2"}
  ]'::jsonb
from public.properties p
where p.subtype = 'facility'
on conflict (id) do update set
  capacity = excluded.capacity,
  display_name = excluded.display_name,
  included_on_purchase = excluded.included_on_purchase,
  sub_slots = excluded.sub_slots;
