-- Piece 1: vehicle storage link to property + custom tags per instance.

-- 1. Link each owned vehicle to a specific owned property (nullable).
--    Denormalised alongside the existing assigned_upgrade_id so queries
--    can reach the parent property without joining through property_upgrades.
alter table public.user_owned_vehicles
  add column if not exists stored_in_property_id uuid
    references public.user_owned_properties(id) on delete set null;

create index if not exists user_owned_vehicles_stored_property_idx
  on public.user_owned_vehicles(stored_in_property_id);

-- 2. Custom user-defined tags on each owned vehicle instance.
--    text[] keeps schema flat; GIN index makes filter queries cheap.
alter table public.user_owned_vehicles
  add column if not exists custom_tags text[] not null default '{}';

create index if not exists user_owned_vehicles_custom_tags_idx
  on public.user_owned_vehicles using gin(custom_tags);
