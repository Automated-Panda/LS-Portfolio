-- 0046_upgrade_mutex_allow_none.sql
-- Mutually-exclusive ("pick one") upgrade groups can optionally let the user
-- opt out — i.e. show a "None" choice. Off by default: a yacht must have a
-- model, so no None is shown. The flag lives per upgrade row but is kept
-- consistent across a group's members by the admin UI (the group toggle writes
-- it to every member sharing the mutex_group). Idempotent.

alter table public.property_upgrades
  add column if not exists mutex_allow_none boolean not null default false;
