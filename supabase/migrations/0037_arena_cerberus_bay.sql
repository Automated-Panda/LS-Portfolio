-- 0037_arena_cerberus_bay.sql
-- The Arena Workshop's garage floors are each "9 regular spots + 1 large
-- vehicle spot", and that large spot is the ONLY place the Cerberus (all three
-- variants — Apocalypse / Future Shock / Nightmare) can be stored.
--
-- Model the large spots as a single included "Large Vehicle Bay" upgrade whose
-- sub_slot is bound to the Cerberus family (new `vehicle_ids` set on sub_slots,
-- alongside the single `vehicle_id` from 0036). The regular floor capacities
-- drop by 1 each (the large spot is now counted in the Large Vehicle Bay) so
-- the Arena still totals 30 storage slots.
--
-- DB is the source of truth for property structure. Idempotent.

-- Regular spots: 10 → 9 per floor (the 10th becomes the large spot).
update public.properties
  set capacity = 9
  where id = 'arena-workshop' and capacity = 10;

update public.property_upgrades
  set capacity = 9
  where id in ('arena-workshop-garage-b1', 'arena-workshop-garage-b2')
    and capacity = 10;

-- The large-vehicle bay (Cerberus family), up to one per floor.
insert into public.property_upgrades
  (id, property_id, display_name, tier, capacity, required_upgrade_id,
   sort_order, price, included_on_purchase, mutex_group, sub_slots)
values
  ('arena-workshop-large-bay', 'arena-workshop', 'Large Vehicle Bay', null, 3,
   null, 6, 0, true, null,
   '[{"label":"Large Vehicle","capacity":3,"vehicle_ids":["cerberus","cerberus2","cerberus3"]}]'::jsonb)
on conflict (id) do update set
  capacity = excluded.capacity,
  display_name = excluded.display_name,
  included_on_purchase = excluded.included_on_purchase,
  sub_slots = excluded.sub_slots;
