-- Special Cargo Warehouses: 22 instances across 3 sizes (small/medium/large)
-- pooled into one `cargo-warehouse` ownership group. In-game cap is 5 total
-- regardless of size mix.

insert into public.property_ownership_limits (ownership_group, max_owned) values
  ('cargo-warehouse', 5)
on conflict (ownership_group) do nothing;
