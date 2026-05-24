-- Piece 2: AI organizer plan storage.
-- One row per generated plan. Plan steps + undo snapshot live as JSONB
-- on the row — they're loaded together with the plan and rarely queried
-- independently, so separate tables would just force joins for no benefit.

do $$
begin
  if not exists (select 1 from pg_type where typname = 'organizer_plan_status') then
    create type organizer_plan_status as enum (
      'pending',
      'applied',
      'checklist',
      'completed',
      'undone',
      'dismissed'
    );
  end if;
end $$;

create table if not exists public.organizer_plans (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  prompt              text not null,
  parsed_intent       jsonb not null,
  plan_steps          jsonb not null,
  status              organizer_plan_status not null default 'pending',
  applied_at          timestamptz,
  undo_snapshot       jsonb,
  undo_expires_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_organizer_plans_user
  on public.organizer_plans(user_id, created_at desc);

-- Note: a partial index on `undo_expires_at > now()` is rejected by Postgres
-- because now() is not IMMUTABLE. Index on (user_id, status) instead;
-- the query filters undo_expires_at at runtime.
create index if not exists idx_organizer_plans_active_undo
  on public.organizer_plans(user_id, status)
  where status = 'applied';

alter table public.organizer_plans enable row level security;

create policy "Users can view own plans"
  on public.organizer_plans for select using (auth.uid() = user_id);
create policy "Users can insert own plans"
  on public.organizer_plans for insert with check (auth.uid() = user_id);
create policy "Users can update own plans"
  on public.organizer_plans for update using (auth.uid() = user_id);
create policy "Users can delete own plans"
  on public.organizer_plans for delete using (auth.uid() = user_id);

create or replace function public.touch_organizer_plan_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_organizer_plans_touch on public.organizer_plans;
create trigger trg_organizer_plans_touch
  before update on public.organizer_plans
  for each row execute procedure public.touch_organizer_plan_updated_at();
