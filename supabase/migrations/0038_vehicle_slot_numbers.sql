-- 0038_vehicle_slot_numbers.sql
-- Numbered garage slots. Each car-garage storage area (base storage or a
-- car-storage upgrade row / garage floor) has physical slots 1..capacity, and a
-- vehicle can be placed in a specific numbered slot — mirroring how GTA garages
-- show numbered parking spots.
--
-- The slot is scoped to (stored_in_property_id, assigned_upgrade_id): each floor
-- numbers independently. NULL = the car is in the garage but not yet placed in a
-- spot ("unplaced"). We do NOT backfill — every existing car starts unplaced so
-- the numbers only ever reflect deliberate placement.
--
-- Weaponized bays / hangars / docks are unaffected: bays use sub_slot, and the
-- app only writes slot_number for counts_as_garage car-storage areas.
-- Idempotent.

alter table public.user_owned_vehicles
  add column if not exists slot_number int;

-- Slots are positive when set.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'user_owned_vehicles_slot_positive'
  ) then
    alter table public.user_owned_vehicles
      add constraint user_owned_vehicles_slot_positive
      check (slot_number is null or slot_number >= 1);
  end if;
end $$;

-- One car per (property, area, slot). assigned_upgrade_id is coalesced to '' so
-- base-storage slots (null upgrade) are still enforced as a single area. Partial
-- index — unplaced cars (slot_number null) are exempt.
create unique index if not exists user_owned_vehicles_slot_uniq
  on public.user_owned_vehicles (
    stored_in_property_id,
    coalesce(assigned_upgrade_id, ''),
    slot_number
  )
  where slot_number is not null;

-- Atomically exchange two cars' slot numbers within an area. Values are swapped
-- as-is, INCLUDING null — so "drop car A onto B's occupied spot" places A in the
-- slot and displaces B to where A was (possibly unplaced/null). Car A is nulled
-- first so the unique index above never trips mid-swap. SECURITY INVOKER → RLS
-- still applies; the explicit auth.uid() guards are belt-and-suspenders.
create or replace function public.swap_vehicle_slots(a uuid, b uuid)
returns void
language plpgsql
security invoker
as $$
declare
  sa int;
  sb int;
begin
  select slot_number into sa
    from public.user_owned_vehicles where id = a and user_id = auth.uid();
  select slot_number into sb
    from public.user_owned_vehicles where id = b and user_id = auth.uid();
  update public.user_owned_vehicles set slot_number = null where id = a and user_id = auth.uid();
  update public.user_owned_vehicles set slot_number = sa   where id = b and user_id = auth.uid();
  update public.user_owned_vehicles set slot_number = sb   where id = a and user_id = auth.uid();
end;
$$;

grant execute on function public.swap_vehicle_slots(uuid, uuid) to authenticated;
