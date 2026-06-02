-- 0032_fold_builtin_garages.sql
-- Built-in garages (Auto Shop / Clubhouse / Facility / Agency / Mansion garages,
-- and the Vinewood Club Garage floors) come WITH the property — they are not
-- purchasable upgrades. They were wrongly modelled as free (price 0),
-- capacity-bearing rows in property_upgrades. Fold their slots into the
-- property's base capacity and remove the upgrade rows.
--
-- Idempotent: after this runs there are no free capacity-bearing upgrades left,
-- so a re-run folds nothing. Paid capacity add-ons (e.g. Master Penthouse
-- "Garage Access (10-car)" at $1.5M) are NOT free, so they are left untouched.

-- 1. Add each property's free built-in garage slots to its base capacity.
update public.properties p
set capacity = p.capacity + sub.slots
from (
  select property_id, sum(capacity) as slots
  from public.property_upgrades
  where capacity > 0 and coalesce(price, 0) = 0
  group by property_id
) sub
where sub.property_id = p.id;

-- 2. Remove user "ownership" rows for those built-in upgrades. Effective capacity
-- is preserved because the slots now live in the property's base capacity.
delete from public.user_owned_property_upgrades o
using public.property_upgrades u
where o.property_upgrade_id::text = u.id::text
  and u.capacity > 0 and coalesce(u.price, 0) = 0;

-- 3. Delete the built-in garage upgrade rows.
delete from public.property_upgrades
where capacity > 0 and coalesce(price, 0) = 0;
