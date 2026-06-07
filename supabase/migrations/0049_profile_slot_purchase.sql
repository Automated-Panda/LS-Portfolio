-- 0049_profile_slot_purchase.sql
-- One-time "$2.99 extra GTA-account profile" purchase. On a successful Stripe
-- checkout the webhook calls grant_profile_slot() which bumps
-- profiles.extra_profile_slots by 1, idempotently keyed on the Stripe event id
-- (mirrors grant_credits). The grants table is the idempotency ledger + audit.
-- Idempotent.

create table if not exists public.profile_slot_grants (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  stripe_event_id text unique,
  created_at      timestamptz not null default now()
);
alter table public.profile_slot_grants enable row level security;
-- No user policies — written only by the webhook (service role).

create or replace function public.grant_profile_slot(p_user_id uuid, p_stripe_event_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Idempotency: skip if this Stripe event already granted a slot.
  if p_stripe_event_id is not null and exists (
    select 1 from public.profile_slot_grants where stripe_event_id = p_stripe_event_id
  ) then
    return;
  end if;

  insert into public.profile_slot_grants (user_id, stripe_event_id)
    values (p_user_id, p_stripe_event_id);

  update public.profiles
    set extra_profile_slots = extra_profile_slots + 1
    where id = p_user_id;
end;
$$;

grant execute on function public.grant_profile_slot(uuid, text) to service_role;
