-- Mansions update: add the 3 Vinewood mansions added by Rockstar in the
-- "A Safehouse in the Hills" update (early 2025) as a new residence subtype
-- with its own ownership group. Players can own all 3 simultaneously, so
-- the cap is 3 (one per distinct mansion).

insert into public.property_ownership_limits (ownership_group, max_owned) values
  ('mansion', 3)
on conflict (ownership_group) do nothing;
