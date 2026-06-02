-- 0027_admin_roles.sql
-- Role system (owner/editor/user), per-user notifications, and a manual
-- admin credit-adjustment RPC for the User Management admin page.

-- ── profiles.role ────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'editor', 'owner'));

-- Seed the owner via the bootstrap email BEFORE the guard trigger exists.
update public.profiles p
  set role = 'owner'
  from auth.users u
  where u.id = p.id and lower(u.email) = lower('james@automatedpanda.com');

-- Prevent privilege escalation: an authenticated/anon caller (one whose JWT
-- carries a role claim that isn't 'service_role') may never change `role`.
-- Direct DB / migration connections have no JWT claims and are allowed.
create or replace function public.prevent_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_jwt_role text;
begin
  if new.role is distinct from old.role then
    v_jwt_role := nullif(current_setting('request.jwt.claims', true), '')::jsonb->>'role';
    if v_jwt_role is not null and v_jwt_role <> 'service_role' then
      raise exception 'Changing profiles.role is not permitted';
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_profiles_prevent_role_change on public.profiles;
create trigger trg_profiles_prevent_role_change
  before update on public.profiles
  for each row execute procedure public.prevent_role_change();

-- ── notifications ────────────────────────────────────────────────────────────
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,
  title       text not null,
  body        text,
  data        jsonb not null default '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists idx_notifications_user_unread
  on public.notifications (user_id, read_at);

alter table public.notifications enable row level security;

create policy "Users can view own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can mark own notifications read"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ── admin_adjust_credits ─────────────────────────────────────────────────────
-- Manual, audited adjustment of the NEVER-EXPIRING bucket (balance_credits).
-- Clamps the bucket at zero, logs the ACTUAL applied delta (post-clamp) with the
-- existing 'adjustment' reason, and returns the user's new total balance.
create or replace function public.admin_adjust_credits(
  p_user_id uuid,
  p_delta   integer,
  p_note    text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_old   integer;
  v_new   integer;
  v_total integer;
begin
  if p_delta = 0 then
    raise exception 'admin_adjust_credits: delta must be non-zero';
  end if;

  insert into public.user_credits (user_id)
    values (p_user_id)
    on conflict (user_id) do nothing;

  select balance_credits into v_old
    from public.user_credits where user_id = p_user_id for update;
  v_new := greatest(0, v_old + p_delta);

  update public.user_credits
    set balance_credits = v_new
    where user_id = p_user_id;

  select free_monthly + sub_monthly + balance_credits into v_total
    from public.user_credits where user_id = p_user_id;

  insert into public.credit_transactions
    (user_id, delta, reason, bucket, balance_after, metadata)
    values (
      p_user_id,
      v_new - v_old,
      'adjustment',
      'purchased',
      v_total,
      jsonb_build_object('note', p_note, 'admin', true)
    );

  return v_total;
end; $$;

revoke all on function public.admin_adjust_credits(uuid, integer, text) from public;
revoke all on function public.admin_adjust_credits(uuid, integer, text) from anon;
revoke all on function public.admin_adjust_credits(uuid, integer, text) from authenticated;
grant execute on function public.admin_adjust_credits(uuid, integer, text) to service_role;
