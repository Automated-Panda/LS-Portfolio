-- 0033_fold_garage_property_upgrades.sql
-- Follow-up to 0032. Stand-Alone Garages and Arcades show a phantom "garage"
-- upgrade in the catalog, but that garage comes WITH the property when you buy
-- it — it is not a separate purchasable add-on:
--   * Stand-Alone Garage — the garage IS the property; its 2/6/10-car capacity
--     was modelled as a single priced "N-Car Garage" upgrade. The property
--     price already equals that upgrade's price.
--   * Arcade — the basement garage (10 cars) is included with the arcade.
-- 0032 skipped these because their price is non-zero (it only folded free,
-- price-0 built-in garages). Fold the capacity into the property's base
-- `capacity` and remove the upgrade rows, so they stop appearing as upgrades.
--
-- Genuinely optional paid garages (CEO Office levels, Nightclub storage,
-- Master Penthouse "Garage Access", Arena Workshop's two purchasable floors)
-- are NOT touched — they remain upgrades.
--
-- Idempotent: after this runs there are no capacity-bearing upgrades left for
-- these two subtypes, so a re-run folds/deletes nothing.

-- 0. Re-point any vehicles parked on a folded upgrade to bare-property storage.
-- The FK is ON DELETE SET NULL, so step 3's delete would do this implicitly;
-- we do it explicitly first so the intent (vehicles move to base capacity,
-- which now holds the slots) is unambiguous and order-independent.
update public.user_owned_vehicles v
set assigned_upgrade_id = null
from public.property_upgrades u
join public.properties pr on pr.id = u.property_id
where v.assigned_upgrade_id::text = u.id::text
  and u.capacity > 0
  and pr.subtype in ('stand-alone-garage', 'arcade');

-- 1. Fold each property's included garage slots into its base capacity.
update public.properties p
set capacity = p.capacity + sub.slots
from (
  select u.property_id, sum(u.capacity) as slots
  from public.property_upgrades u
  join public.properties pr on pr.id = u.property_id
  where u.capacity > 0
    and pr.subtype in ('stand-alone-garage', 'arcade')
  group by u.property_id
) sub
where sub.property_id = p.id;

-- 2. Remove user "ownership" rows for those folded upgrades. Effective capacity
-- is preserved because the slots now live in the property's base capacity.
delete from public.user_owned_property_upgrades o
using public.property_upgrades u
join public.properties pr on pr.id = u.property_id
where o.property_upgrade_id::text = u.id::text
  and u.capacity > 0
  and pr.subtype in ('stand-alone-garage', 'arcade');

-- 3. Delete the folded garage upgrade rows.
delete from public.property_upgrades u
using public.properties pr
where pr.id = u.property_id
  and u.capacity > 0
  and pr.subtype in ('stand-alone-garage', 'arcade');
