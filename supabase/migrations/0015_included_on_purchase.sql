-- Some upgrades are included with the property purchase (e.g. Vinewood
-- Car Club's 5 floors are all unlocked by the GTA+ subscription, MC
-- Clubhouse garages come with the clubhouse, etc.). These should be
-- auto-installed when a user adds the property to their portfolio so
-- they don't need to manually tick every "free" upgrade.
--
-- Applied via MCP on 2026-05-28.

alter table public.property_upgrades
  add column if not exists included_on_purchase boolean not null default false;

comment on column public.property_upgrades.included_on_purchase is 'When true, this upgrade is unlocked the moment the property is purchased — togglePropertyOwnership auto-inserts a user_owned_property_upgrades row for every included_on_purchase=true row on the property.';

-- Backfill the flag for known "free / included" upgrades.
update public.property_upgrades
  set included_on_purchase = true
  where id like 'vinewood-car-club-floor-%'
     or id like 'mc-clubhouse-%-garage'
     or id like 'agency-%-garage'
     or id like 'auto-shop-%-garage'
     or id like 'hangar-%-storage'
     or id like 'facility-%-garage'
     or id like 'cargo-warehouse-%-interior-style';

insert into public.user_owned_property_upgrades (user_owned_property_id, property_upgrade_id)
select uop.id, pu.id
from public.user_owned_properties uop
join public.property_upgrades pu on pu.property_id = uop.property_id
where pu.included_on_purchase = true
on conflict (user_owned_property_id, property_upgrade_id) do nothing;
