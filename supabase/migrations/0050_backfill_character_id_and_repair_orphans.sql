-- 0050_backfill_character_id_and_repair_orphans.sql
-- Two jobs, both idempotent and safe to re-run.
--
-- 1. BACKFILL. Migration 0047 added character_id to the owned/organizer tables
--    and backfilled every row that existed at the time, and all app writes set
--    it. But any row written in the window between 0047 being applied and the
--    character-scoped code being deployed has character_id IS NULL — invisible
--    to every character-scoped query. Adopt those rows into the user's earliest
--    character so nothing is stranded once the remaining queries tighten from
--    user_id to character_id.
--
-- 2. ORPHAN FLAG. A bug in togglePropertyOwnership (fixed alongside this
--    migration) could delete another character's user_owned_properties row,
--    which set stored_in_property_id = NULL on every car parked there via
--    ON DELETE SET NULL. assigned_upgrade_id and slot_number were NOT cleared
--    (they reference the *catalog*, not the owned row), so affected cars are
--    identifiable and partially recoverable. This migration does not guess a
--    destination — it only reports them via a view so the damage is visible.

-- ---- 1. backfill NULL character_id --------------------------------------
do $$
declare r record; v_ch uuid;
begin
  for r in
    select distinct user_id from (
      select user_id from public.user_owned_vehicles   where character_id is null
      union select user_id from public.user_owned_properties where character_id is null
      union select user_id from public.organizer_plans       where character_id is null
      union select user_id from public.conversations         where character_id is null
    ) u
  loop
    -- Prefer the account's currently-active character; fall back to its earliest.
    select p.active_character_id into v_ch
      from public.profiles p where p.id = r.user_id;
    if v_ch is null then
      select c.id into v_ch
        from public.characters c
        where c.user_id = r.user_id
        order by c.created_at asc
        limit 1;
    end if;
    if v_ch is null then
      continue; -- no character at all: leave alone rather than invent one
    end if;

    update public.user_owned_vehicles   set character_id = v_ch
      where user_id = r.user_id and character_id is null;
    update public.user_owned_properties set character_id = v_ch
      where user_id = r.user_id and character_id is null;
    update public.organizer_plans       set character_id = v_ch
      where user_id = r.user_id and character_id is null;
    update public.conversations         set character_id = v_ch
      where user_id = r.user_id and character_id is null;
  end loop;
end $$;

-- ---- 2. surface cars orphaned by the cross-character delete --------------
-- A car that is unparked (stored_in_property_id is null) but still remembers a
-- floor/bay or a numbered slot was almost certainly unparked by the deleted
-- property, not by the user. The upgrade points back at the property it
-- belonged to, so the original garage is knowable.
-- security_invoker: a plain view runs as its OWNER, which would bypass RLS and
-- expose every account's rows through PostgREST. With security_invoker the
-- underlying user_owned_vehicles RLS applies to the caller. Also revoked from
-- the API roles — this is an owner/service-role diagnostic, not app surface.
create or replace view public.orphaned_vehicle_assignments
with (security_invoker = true) as
select
  v.id            as owned_vehicle_id,
  v.user_id,
  v.character_id,
  v.vehicle_id,
  v.nickname,
  v.assigned_upgrade_id,
  v.slot_number,
  pu.property_id  as former_property_id,
  p.display_name  as former_property_name
from public.user_owned_vehicles v
left join public.property_upgrades pu on pu.id = v.assigned_upgrade_id
left join public.properties p on p.id = pu.property_id
where v.stored_in_property_id is null
  and (v.assigned_upgrade_id is not null or v.slot_number is not null);

comment on view public.orphaned_vehicle_assignments is
  'Cars left unparked but still holding a floor/bay or slot number - the fingerprint of a property row deleted out from under them. Diagnostic only.';

revoke all on public.orphaned_vehicle_assignments from anon, authenticated;
grant select on public.orphaned_vehicle_assignments to service_role;
