-- 0039_vehicle_upgrades_and_nesting.sql
-- Container vehicles (Terrorbyte/MOC/Kosatka/Acid Lab) — Approach A. Vehicles
-- gain an upgrade subsystem (mirroring property_upgrades) and can store other
-- owned vehicles (one level deep). Spec:
-- docs/superpowers/specs/2026-06-06-hybrid-entities-design.md. Idempotent.

-- 1. Nesting: a vehicle parked INSIDE a container vehicle. Reuses the existing
--    sub_slot column to name the bay. App enforces mutual exclusivity with
--    stored_in_property_id.
alter table public.user_owned_vehicles
  add column if not exists stored_in_vehicle_id uuid
    references public.user_owned_vehicles(id) on delete set null;

-- 2. Catalogue upgrades for vehicles (mirrors property_upgrades).
create table if not exists public.vehicle_upgrades (
  id                    text primary key,
  vehicle_id            text not null references public.vehicles(id) on delete cascade,
  display_name          text not null,
  capacity              int not null default 0,
  sub_slots             jsonb,
  required_upgrade_id   text references public.vehicle_upgrades(id),
  mutex_group           text,
  included_on_purchase  boolean not null default false,
  price                 bigint,
  sort_order            int not null default 0
);
create index if not exists vehicle_upgrades_vehicle_idx
  on public.vehicle_upgrades(vehicle_id);

-- 3. Per-user installed vehicle upgrades (mirrors user_owned_property_upgrades).
create table if not exists public.user_owned_vehicle_upgrades (
  id                       uuid primary key default gen_random_uuid(),
  user_owned_vehicle_id    uuid not null references public.user_owned_vehicles(id) on delete cascade,
  vehicle_upgrade_id       text not null references public.vehicle_upgrades(id) on delete cascade,
  created_at               timestamptz not null default now(),
  unique (user_owned_vehicle_id, vehicle_upgrade_id)
);
create index if not exists user_owned_vehicle_upgrades_parent_idx
  on public.user_owned_vehicle_upgrades(user_owned_vehicle_id);

-- RLS: catalogue is world-readable (like property_upgrades); owned rows are
-- owner-only via the parent user_owned_vehicles row.
alter table public.vehicle_upgrades enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'vehicle_upgrades'
                 and policyname = 'Vehicle upgrades are viewable by everyone') then
    create policy "Vehicle upgrades are viewable by everyone"
      on public.vehicle_upgrades for select using (true);
  end if;
end $$;

alter table public.user_owned_vehicle_upgrades enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'user_owned_vehicle_upgrades'
                 and policyname = 'Users can view own vehicle upgrades') then
    create policy "Users can view own vehicle upgrades"
      on public.user_owned_vehicle_upgrades for select using (
        exists (select 1 from public.user_owned_vehicles uov
                where uov.id = user_owned_vehicle_upgrades.user_owned_vehicle_id
                  and uov.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'user_owned_vehicle_upgrades'
                 and policyname = 'Users can insert own vehicle upgrades') then
    create policy "Users can insert own vehicle upgrades"
      on public.user_owned_vehicle_upgrades for insert with check (
        exists (select 1 from public.user_owned_vehicles uov
                where uov.id = user_owned_vehicle_upgrades.user_owned_vehicle_id
                  and uov.user_id = auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'user_owned_vehicle_upgrades'
                 and policyname = 'Users can delete own vehicle upgrades') then
    create policy "Users can delete own vehicle upgrades"
      on public.user_owned_vehicle_upgrades for delete using (
        exists (select 1 from public.user_owned_vehicles uov
                where uov.id = user_owned_vehicle_upgrades.user_owned_vehicle_id
                  and uov.user_id = auth.uid()));
  end if;
end $$;
