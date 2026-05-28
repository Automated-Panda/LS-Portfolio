-- Vehicles can be sold at more than one storefront (e.g. a car bought from
-- Southern San Andreas that's also customizable/bought at Benny's), so replace
-- the single `vendor` column with a `vendors` array. Adds 'bennys'.
-- (Luxury Autos and Premium Deluxe Motorsport are intentionally excluded —
-- they rotate weekly and aren't worth maintaining.)
--
-- Applied via MCP on 2026-05-28; this file is the source-of-truth record.

alter table public.vehicles drop constraint if exists vehicles_vendor_check;
alter table public.vehicles drop column if exists vendor;

alter table public.vehicles
  add column if not exists vendors text[] not null default '{}'
  check (vendors <@ array[
    'southern_san_andreas', 'legendary_motorsport', 'elitas_travel',
    'warstock', 'dock_tease', 'pedal_metal', 'bennys'
  ]::text[]);

comment on column public.vehicles.vendors is 'In-game purchase storefronts where the vehicle is sold (may be several); empty if not purchasable from a standard vendor.';
