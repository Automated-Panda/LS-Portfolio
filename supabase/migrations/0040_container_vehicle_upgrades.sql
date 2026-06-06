-- 0040_container_vehicle_upgrades.sql
-- Phase 1b catalogue data for container vehicles (hybrid entities). Seeds
-- vehicle_upgrades rows for the three containers that already exist in the
-- vehicle catalogue: Terrorbyte (terbyte), Kosatka (kosatka), Acid Lab
-- (brickade2). Storage bays are sub_slots with vehicle_id bindings (same shape
-- as the property weaponized bays, migrations 0036/0037). The MOC is a separate
-- follow-up (it needs a catalogue vehicle row first). Idempotent.

insert into public.vehicle_upgrades
  (id, vehicle_id, display_name, capacity, sub_slots, required_upgrade_id,
   mutex_group, included_on_purchase, price, sort_order)
values
  -- Terrorbyte: the Oppressor Mk II bay lives on the (paid) Specialized Workshop.
  ('terbyte-specialized-workshop', 'terbyte', 'Specialized Workshop', 1,
   '[{"label":"Oppressor Mk II","capacity":1,"vehicle_id":"oppressor2"}]'::jsonb,
   null, null, false, 495000, 1),
  ('terbyte-drone-station', 'terbyte', 'Drone Station', 0, null, null, null, false, 815000, 2),
  ('terbyte-weapon-workshop', 'terbyte', 'Weapon Workshop', 0, null, null, null, false, 245000, 3),
  ('terbyte-turret-station', 'terbyte', 'Turret Station', 0, null, null, null, false, 297000, 4),
  ('terbyte-master-control-terminal', 'terbyte', 'Master Control Terminal', 0, null, null, null, false, 1250000, 5),

  -- Kosatka: the moon pool (included) holds the Sparrow + Kraken Avisa.
  ('kosatka-moon-pool', 'kosatka', 'Moon Pool', 2,
   '[{"label":"Sparrow","capacity":1,"vehicle_id":"seasparrow2"},{"label":"Kraken Avisa","capacity":1,"vehicle_id":"avisa"}]'::jsonb,
   null, null, true, null, 1),
  ('kosatka-sonar-station', 'kosatka', 'Sonar Station', 0, null, null, null, false, 1200000, 2),
  ('kosatka-guided-missiles', 'kosatka', 'Guided Missiles', 0, null, null, null, false, 1900000, 3),

  -- Acid Lab (Brickade 6x6): the Manchez Scout C comes with the lab (included).
  ('brickade2-bike-storage', 'brickade2', 'Bike Storage', 1,
   '[{"label":"Acid Bike","capacity":1,"vehicle_id":"manchez2"}]'::jsonb,
   null, null, true, null, 1),
  ('brickade2-equipment-upgrade', 'brickade2', 'Equipment Upgrade', 0, null, null, null, false, 250000, 2)
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
