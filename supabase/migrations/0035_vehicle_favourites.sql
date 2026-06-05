-- 0035_vehicle_favourites.sql
-- Let users mark owned vehicles as favourites. Primarily so the AI Organizer
-- can target them ("organize my favourite cars into my mansions"), but also
-- surfaced as a ⭐ toggle + a "Favourites" filter chip in the app.
--
-- Modelled as a first-class boolean (not a reserved tag) so the star toggle is
-- clean and the organizer gets a dedicated filter predicate.
-- Idempotent.

alter table public.user_owned_vehicles
  add column if not exists is_favourite boolean not null default false;
