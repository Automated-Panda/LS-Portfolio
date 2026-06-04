-- 0034_floored_garages_eclipse_vinewood.sql
-- Per-floor car assignment for the two "stacked" garages:
--   * Eclipse Boulevard Garages — 5 floors × 10 = 50 (new)
--   * The Vinewood Club Garage   — 5 floors × 20 = 100 (restored)
--
-- These two are genuine multi-floor garages where picking a car's floor is a
-- real feature. Migration 0032 had flattened ALL free, capacity-bearing
-- upgrades into base capacity (correct for built-in Auto Shop / Clubhouse /
-- Mansion garages, but it also wiped Vinewood's floor picker). This migration
-- intentionally re-introduces floors for JUST these two, modelling each floor
-- as an included-on-purchase upgrade row — same pattern the instance/property
-- drawers already render generically. No component changes required.
--
-- Idempotent: re-running upserts the same floor rows, re-zeros base capacity,
-- and the car redistribution is deterministic.

-- 1. (Re)create the floor upgrade rows. Capacity lives here, not on the property.
insert into public.property_upgrades
  (id, property_id, display_name, tier, capacity, required_upgrade_id, notes, sort_order, price, included_on_purchase)
values
  ('vinewood-car-club-floor-1', 'vinewood-car-club', 'Floor 1', 1, 20, null, 'Included with GTA+ subscription.', 0, 0, true),
  ('vinewood-car-club-floor-2', 'vinewood-car-club', 'Floor 2', 2, 20, null, 'Included with GTA+ subscription.', 1, 0, true),
  ('vinewood-car-club-floor-3', 'vinewood-car-club', 'Floor 3', 3, 20, null, 'Included with GTA+ subscription.', 2, 0, true),
  ('vinewood-car-club-floor-4', 'vinewood-car-club', 'Floor 4', 4, 20, null, 'Included with GTA+ subscription.', 3, 0, true),
  ('vinewood-car-club-floor-5', 'vinewood-car-club', 'Floor 5', 5, 20, null, 'Included with GTA+ subscription.', 4, 0, true),
  ('eclipse-blvd-garages-floor-1', 'eclipse-blvd-garages-all', 'Floor 1', 1, 10, null, 'Included with the garage.', 0, 0, true),
  ('eclipse-blvd-garages-floor-2', 'eclipse-blvd-garages-all', 'Floor 2', 2, 10, null, 'Included with the garage.', 1, 0, true),
  ('eclipse-blvd-garages-floor-3', 'eclipse-blvd-garages-all', 'Floor 3', 3, 10, null, 'Included with the garage.', 2, 0, true),
  ('eclipse-blvd-garages-floor-4', 'eclipse-blvd-garages-all', 'Floor 4', 4, 10, null, 'Included with the garage.', 3, 0, true),
  ('eclipse-blvd-garages-floor-5', 'eclipse-blvd-garages-all', 'Floor 5', 5, 10, null, 'Included with the garage.', 4, 0, true)
on conflict (id) do update set
  property_id = excluded.property_id,
  display_name = excluded.display_name,
  tier = excluded.tier,
  capacity = excluded.capacity,
  notes = excluded.notes,
  sort_order = excluded.sort_order,
  price = excluded.price,
  included_on_purchase = excluded.included_on_purchase;

-- 2. All capacity now lives on the floors — zero the property base so the
--    drawers show a floor picker instead of a phantom "Base storage" bucket.
update public.properties
set capacity = 0
where id in ('vinewood-car-club', 'eclipse-blvd-garages-all');

-- 3. Auto-install every floor for everyone who already owns these properties
--    (included_on_purchase rows), so existing owners get the floors for free.
insert into public.user_owned_property_upgrades (user_owned_property_id, property_upgrade_id)
select uop.id, pu.id
from public.user_owned_properties uop
join public.property_upgrades pu on pu.property_id = uop.property_id
where uop.property_id in ('vinewood-car-club', 'eclipse-blvd-garages-all')
  and pu.included_on_purchase = true
on conflict (user_owned_property_id, property_upgrade_id) do nothing;

-- 4. Vinewood cars were knocked to "base" (assigned_upgrade_id = null) when 0032
--    deleted the floor rows. Spread them back across floors 1-5, 20 per floor,
--    per owned-garage instance, in a stable order. (Eclipse has no parked cars.)
with ranked as (
  select
    v.id,
    least(
      ceil(
        row_number() over (
          partition by v.stored_in_property_id
          order by v.created_at, v.id
        )::numeric / 20
      ),
      5
    )::int as floor_no
  from public.user_owned_vehicles v
  join public.user_owned_properties uop on uop.id = v.stored_in_property_id
  where uop.property_id = 'vinewood-car-club'
)
update public.user_owned_vehicles v
set assigned_upgrade_id = 'vinewood-car-club-floor-' || ranked.floor_no
from ranked
where ranked.id = v.id;
