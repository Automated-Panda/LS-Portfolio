-- Phase 4b: granular per-instance properties.
-- Existing 15 type-level rows are dropped; data is re-imported by
-- npm run db:import from the new instance-level seed.
-- Pre-launch, only test ownership state is lost.

-- 1. Drop existing rows (cascades through property_upgrades,
--    user_owned_properties, user_owned_property_upgrades).
truncate table public.properties cascade;

-- 2. Add per-instance columns. NOT NULL is safe now because the
--    table is empty after the truncate above.
alter table public.properties
  add column if not exists subtype          text not null,
  add column if not exists subtype_display  text not null,
  add column if not exists neighborhood     text,
  add column if not exists capacity         int  not null default 0;

-- 3. Index the new filterable columns.
create index if not exists properties_subtype_idx
  on public.properties(subtype);
create index if not exists properties_neighborhood_idx
  on public.properties(neighborhood);
