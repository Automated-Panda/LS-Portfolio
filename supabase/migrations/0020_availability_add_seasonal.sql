-- Add a 5th availability status: 'seasonal' for event-only vehicles
-- (Halloween/Christmas) like the Franken Stange, Lurcher, and Sanctus, which
-- return during seasonal events rather than via Simeon / LS Car Meet.
--
-- Applied via MCP on 2026-05-28; this file is the source-of-truth record.

alter table public.vehicles drop constraint if exists vehicles_availability_check;

alter table public.vehicles
  add constraint vehicles_availability_check
  check (availability in ('available', 'discontinued', 'unobtainable', 'blacklisted', 'seasonal'));
