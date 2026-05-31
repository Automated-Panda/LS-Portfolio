-- Adds a GTA+ membership flag to profiles. Drives GTA+-dependent perks
-- (currently the larger McKenzie -> Hangar capacity boost: +20 vs +15).
alter table public.profiles
  add column if not exists gta_plus boolean not null default false;
