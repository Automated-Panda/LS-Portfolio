-- 0025_add_credits.sql
-- Credit balances (bucketed) + append-only audit log for the AI credit system.

-- ── user_credits: source of truth for balances ──────────────────────────────
create table if not exists public.user_credits (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  free_monthly       integer not null default 0 check (free_monthly >= 0),
  free_period_start  timestamptz not null default now(),
  sub_monthly        integer not null default 0 check (sub_monthly >= 0),
  sub_period_end     timestamptz,
  balance_credits    integer not null default 0 check (balance_credits >= 0),
  has_active_sub     boolean not null default false,
  updated_at         timestamptz not null default now()
);

alter table public.user_credits enable row level security;

-- Users may READ their own balance. All writes go through the service-role
-- client (server-only); there are intentionally no user write policies.
create policy "Users can view own credits"
  on public.user_credits for select
  using (auth.uid() = user_id);

-- Auto-touch updated_at on every write (mirrors the pattern in 0024).
create or replace function public.touch_user_credits_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_user_credits_touch on public.user_credits;
create trigger trg_user_credits_touch
  before update on public.user_credits
  for each row execute procedure public.touch_user_credits_updated_at();

-- ── credit_transactions: append-only audit log + webhook idempotency ─────────
do $$
begin
  if not exists (select 1 from pg_type where typname = 'credit_reason') then
    create type credit_reason as enum (
      'signup_bonus',
      'monthly_free_refill',
      'subscription_grant',
      'purchase',
      'spend',
      'refund',
      'adjustment'
    );
  end if;
end $$;

create table if not exists public.credit_transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  delta           integer not null,
  reason          credit_reason not null,
  bucket          text not null check (bucket in ('free', 'sub', 'purchased')),
  balance_after   integer not null constraint credit_transactions_balance_after_check check (balance_after >= 0),
  stripe_event_id text unique,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists idx_credit_transactions_user
  on public.credit_transactions (user_id, created_at desc);

alter table public.credit_transactions enable row level security;

create policy "Users can view own credit transactions"
  on public.credit_transactions for select
  using (auth.uid() = user_id);

-- ── Signup grant: extend handle_new_user to seed a credits row ───────────────
-- 20 one-time signup bonus (never-expiring bucket) + 10 free monthly.
-- NOTE: preserves the username-from-metadata behavior added in 0009.
-- The 10 / 20 below mirror FREE_MONTHLY / SIGNUP_BONUS in lib/credits/constants.ts;
-- keep them in sync if those constants change (migrations are point-in-time SQL).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_username text;
begin
  v_username := nullif(new.raw_user_meta_data->>'username', '');

  insert into public.profiles (id, username)
  values (new.id, v_username);

  insert into public.user_credits (user_id, free_monthly, free_period_start, balance_credits)
  values (new.id, 10, now(), 20); -- 10 = free monthly allotment, 20 = one-time signup bonus

  return new;
end; $$;

-- ── Backfill existing users so current accounts get balances too ─────────────
-- Existing users all get free_period_start = migration run time; their first monthly refill counts from now.
insert into public.user_credits (user_id, free_monthly, free_period_start, balance_credits)
select id, 10, now(), 20 from public.profiles
on conflict (user_id) do nothing;
