-- Track how a vehicle can currently be obtained in GTA Online.
--   available     - buyable now from an in-game store/website
--   discontinued  - off the website, but rotates back via Simeon's Premium
--                   Deluxe Motorsport / LS Car Meet test rides
--   unobtainable  - cannot be obtained at all (e.g. Albany Franken Stange)
--   blacklisted   - banned/dev vehicles players aren't meant to own (FIB Buffalo)
--
-- Default 'available'; the exceptions live in data/seed/vehicle-availability.json
-- and are applied during build + import (same pattern as the price overlay).
--
-- Applied via MCP on 2026-05-28; this file is the source-of-truth record.

alter table public.vehicles
  add column if not exists availability text not null default 'available'
  check (availability in ('available', 'discontinued', 'unobtainable', 'blacklisted'));

comment on column public.vehicles.availability is 'How the vehicle can currently be obtained: available | discontinued | unobtainable | blacklisted.';
