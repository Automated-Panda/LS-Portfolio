-- 0031_catalog_status.sql
-- Catalog visibility: draft/published/archived. Existing rows default to
-- 'published' so nothing disappears. The public SELECT policy is scoped to
-- published rows; the service-role admin client bypasses RLS and sees all.

alter table public.vehicles
  add column if not exists status text not null default 'published'
  check (status in ('draft', 'published', 'archived'));
alter table public.properties
  add column if not exists status text not null default 'published'
  check (status in ('draft', 'published', 'archived'));

create index if not exists idx_vehicles_status on public.vehicles (status);
create index if not exists idx_properties_status on public.properties (status);

drop policy if exists "Reference tables are readable by everyone" on public.vehicles;
create policy "Published vehicles are readable by everyone"
  on public.vehicles for select using (status = 'published');

drop policy if exists "Reference tables are readable by everyone" on public.properties;
create policy "Published properties are readable by everyone"
  on public.properties for select using (status = 'published');
