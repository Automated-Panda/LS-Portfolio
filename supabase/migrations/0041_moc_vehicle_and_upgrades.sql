-- 0041_moc_vehicle_and_upgrades.sql
-- The Mobile Operations Center (MOC) has no catalogue vehicle row yet (only its
-- cabs Mule/Hauler Custom exist as separate vehicles). Add the MOC as a single
-- container vehicle (Approach A) + its upgrades: cab choice as a mutex cosmetic
-- group, Command Centre, and the Vehicle & Weapon Workshop that gates its
-- one vehicle bay (any personal vehicle). Image is added later via temp-images
-- (maps to data/images/vehicles/moc.webp). Idempotent.

insert into public.vehicles
  (id, internal_name, display_name, manufacturer_id, class, price, availability, vendors, status)
values
  ('moc', 'moc', 'Mobile Operations Center', 'hvy', 'COMMERCIAL', 1225000,
   'available', '{warstock}', 'published')
on conflict (id) do nothing;

insert into public.vehicle_upgrades
  (id, vehicle_id, display_name, capacity, sub_slots, required_upgrade_id,
   mutex_group, included_on_purchase, price, sort_order)
values
  -- Cab choice (cosmetic, mutually exclusive).
  ('moc-cab-phantom', 'moc', 'Cab: Phantom Custom', 0, null, null, 'moc-cab', false, null, 1),
  ('moc-cab-hauler',  'moc', 'Cab: Hauler Custom',  0, null, null, 'moc-cab', false, null, 2),
  ('moc-cab-pounder', 'moc', 'Cab: Pounder Custom', 0, null, null, 'moc-cab', false, null, 3),
  ('moc-cab-mule',    'moc', 'Cab: Mule Custom',    0, null, null, 'moc-cab', false, null, 4),
  -- Command Centre (Bay 1).
  ('moc-command-center', 'moc', 'Command Centre', 0, null, null, null, false, 1545000, 5),
  -- Vehicle & Weapon Workshop (Bays 2 & 3) — enables the one vehicle bay.
  ('moc-vehicle-weapon-workshop', 'moc', 'Vehicle & Weapon Workshop', 1, null,
   null, null, false, 710000, 6)
on conflict (id) do update set
  vehicle_id = excluded.vehicle_id,
  display_name = excluded.display_name,
  capacity = excluded.capacity,
  sub_slots = excluded.sub_slots,
  required_upgrade_id = excluded.required_upgrade_id,
  mutex_group = excluded.mutex_group,
  included_on_purchase = excluded.included_on_purchase,
  price = excluded.price,
  sort_order = excluded.sort_order;
