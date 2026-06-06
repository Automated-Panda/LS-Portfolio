-- 0042_freakshop_property.sql
-- The Freakshop — home of the Acid Lab (Brickade 6x6). A minimal property so the
-- Acid Lab container vehicle can be parked there (Phase 3). No income/business
-- nature is modelled. counts_as_garage false, base capacity 0 (the Acid Lab is a
-- vehicle, not personal car storage). DB-only manual row (like the MOC) — protect
-- from full catalogue rebuilds. Image added later via temp-images. Idempotent.

insert into public.properties
  (id, display_name, property_type, counts_as_garage, subtype, subtype_display,
   capacity, ownership_group, status)
values
  ('freakshop', 'The Freakshop', 'special', false, 'freakshop', 'Freakshop',
   0, 'freakshop', 'published')
on conflict (id) do nothing;
