-- Dashboard catalog coverage: per-ownership-group cap + user's owned count.
-- See 0017 for the corrected shape (one row per ownership_group, with
-- is_business bucketing). Kept here for migration ordering.

create or replace function public.dashboard_catalog_group_rows(p_user_id uuid)
returns table (
  ownership_group  text,
  property_type    text,
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
      o.property_type,
      count(*)::int as ownable_count
    from ownable o
    group by o.ownership_group, o.property_type
  ),
  caps as (
    select
      g.ownership_group,
      g.property_type,
      coalesce(pol.max_owned, g.ownable_count) as cap
    from groups g
    left join public.property_ownership_limits pol
      on pol.ownership_group = g.ownership_group
  ),
  owned as (
    select
      p.ownership_group,
      p.property_type,
      count(distinct uop.property_id)::int as owned_in_group
    from public.user_owned_properties uop
    join public.properties p on p.id = uop.property_id
    where uop.user_id = p_user_id
    group by p.ownership_group, p.property_type
  )
  select
    c.ownership_group,
    c.property_type,
    c.cap,
    coalesce(o.owned_in_group, 0) as owned_in_group
  from caps c
  left join owned o
    on o.ownership_group = c.ownership_group
   and o.property_type = c.property_type;
$$;

grant execute on function public.dashboard_catalog_group_rows(uuid)
  to authenticated;
