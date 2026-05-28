-- Which in-game storefront a vehicle is purchased from. Nullable — many
-- vehicles (mission-only, awards) have no purchase vendor.
--   southern_san_andreas - Southern San Andreas Super Autos
--   legendary_motorsport  - Legendary Motorsport
--   elitas_travel         - Elitas Travel (aircraft)
--   warstock              - Warstock Cache & Carry
--   dock_tease            - Dock Tease (boats)
--   pedal_metal           - Pedal & Metal (cycles)
--
-- Derived from the cached Fandom "purchasable from X" categories; the
-- exceptions live in data/seed/vehicle-vendors.json (applied in build + import).
--
-- Applied via MCP on 2026-05-28; this file is the source-of-truth record.

alter table public.vehicles
  add column if not exists vendor text
  check (vendor is null or vendor in (
    'southern_san_andreas', 'legendary_motorsport', 'elitas_travel',
    'warstock', 'dock_tease', 'pedal_metal'
  ));

comment on column public.vehicles.vendor is 'In-game purchase storefront, or null if not purchasable from a standard vendor.';
