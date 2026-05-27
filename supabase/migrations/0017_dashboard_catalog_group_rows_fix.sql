-- Recreate dashboard_catalog_group_rows with ONE row per ownership_group.
-- The previous shape (0016) returned one row per (group, property_type)
-- which would double-count the "residential" group (it covers apartments +
-- standalone garages but the cap of 10 is shared across both). Bucket as
-- business / not via bool_or so the caller can split Properties vs
-- Businesses.

drop function if exists public.dashboard_catalog_group_rows(uuid);

create or replace function public.dashboard_catalog_group_rows(p_user_id uuid)
returns table (
  ownership_group  text,
  is_business      boolean,
  cap              integer,
  owned_in_group   integer
)
language sql
stable
security definer
set search_path = public
as $$
  with ownable as (
    select p.id, p.ownership_group, p.property_type
    from public.properties p
    where not exists (
      select 1 from public.properties c
      where c.parent_building = p.id
    )
  ),
  groups as (
    select
      o.ownership_group,
      bool_or(o.property_type = 'business') as is_business,
      count(*)::int as ownable_count
    from ownable o
    group by o.ownership_group
  ),
  caps as (
    select
      g.ownership_group,
      g.is_business,
      coalesce(pol.max_owned, g.ownable_count) as cap
    from groups g
    left join public.property_ownership_limits pol
      on pol.ownership_group = g.ownership_group
  ),
  owned as (
    select
      p.ownership_group,
      count(distinct uop.property_id)::int as owned_in_group
    from public.user_owned_properties uop
    join public.properties p on p.id = uop.property_id
    where uop.user_id = p_user_id
    group by p.ownership_group
  )
  select
    c.ownership_group,
    c.is_business,
    c.cap,
    coalesce(o.owned_in_group, 0) as owned_in_group
  from caps c
  left join owned o on o.ownership_group = c.ownership_group;
$$;

grant execute on function public.dashboard_catalog_group_rows(uuid)
  to authenticated;
