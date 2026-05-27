-- Add canonical purchase prices to vehicles, properties, and property_upgrades.
-- Nullable because some entries are mission-only / unobtainable / not-for-sale
-- and a few have not yet been sourced.
--
-- Applied via MCP on 2026-05-28; this file is the source-of-truth record.

alter table public.vehicles
  add column if not exists price bigint check (price is null or price >= 0);

alter table public.properties
  add column if not exists price bigint check (price is null or price >= 0);

alter table public.property_upgrades
  add column if not exists price bigint check (price is null or price >= 0);

comment on column public.vehicles.price is 'Base GTA Online purchase price in $ (USD-coded). Null = not for sale / mission-only / unobtainable.';
comment on column public.properties.price is 'Base GTA Online purchase price in $.';
comment on column public.property_upgrades.price is 'Upgrade purchase price in $.';
