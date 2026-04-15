-- LS Garage Manager — initial schema
-- Reference tables are seeded from data/seed/*.json via scripts/import-seed.ts.
-- User tables are protected by RLS; users only ever see their own rows.

-- =========================================================================
-- Reference tables (populated by seed import)
-- =========================================================================

create table if not exists public.manufacturers (
  id            text primary key,
  display       text not null,
  country       text,
  created_at    timestamptz not null default now()
);

create table if not exists public.vehicle_tags (
  id            text primary key,
  display       text not null,
  rule          jsonb not null,
  created_at    timestamptz not null default now()
);

create table if not exists public.vehicles (
  id                  text primary key,
  internal_name       text not null unique,
  display_name        text not null,
  manufacturer_id     text not null references public.manufacturers(id),
  class               text not null,
  release_update      text,
  is_garage_storable  boolean not null default true,
  variant_of          text references public.vehicles(id) on delete set null,
  image_path          text,
  source_durtyfree    text,
  source_fandom       text,
  created_at          timestamptz not null default now()
);

create index if not exists vehicles_manufacturer_idx on public.vehicles(manufacturer_id);
create index if not exists vehicles_class_idx on public.vehicles(class);
create index if not exists vehicles_variant_of_idx on public.vehicles(variant_of);

create table if not exists public.vehicle_tag_links (
  vehicle_id    text not null references public.vehicles(id) on delete cascade,
  tag_id        text not null references public.vehicle_tags(id) on delete cascade,
  primary key (vehicle_id, tag_id)
);

create index if not exists vehicle_tag_links_tag_idx on public.vehicle_tag_links(tag_id);

create table if not exists public.properties (
  id                text primary key,
  display_name      text not null,
  property_type     text not null check (property_type in ('business','residence','garage','special')),
  location          text,
  image_path        text,
  counts_as_garage  boolean not null default true,
  source_fandom     text,
  source_gtabase    text,
  created_at        timestamptz not null default now()
);

create table if not exists public.property_upgrades (
  id                   text primary key,
  property_id          text not null references public.properties(id) on delete cascade,
  display_name         text not null,
  tier                 int,
  capacity             int not null default 0,
  required_upgrade_id  text references public.property_upgrades(id) on delete set null,
  notes                text,
  sort_order           int not null default 0,
  created_at           timestamptz not null default now()
);

create index if not exists property_upgrades_property_idx on public.property_upgrades(property_id);

-- =========================================================================
-- User tables (per-user, RLS enforced)
-- =========================================================================

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique,
  display_name  text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists public.user_owned_properties (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  property_id    text not null references public.properties(id) on delete cascade,
  custom_name    text,
  created_at     timestamptz not null default now(),
  unique (user_id, property_id)
);

create index if not exists user_owned_properties_user_idx on public.user_owned_properties(user_id);

create table if not exists public.user_owned_property_upgrades (
  id                        uuid primary key default gen_random_uuid(),
  user_owned_property_id    uuid not null references public.user_owned_properties(id) on delete cascade,
  property_upgrade_id       text not null references public.property_upgrades(id) on delete cascade,
  created_at                timestamptz not null default now(),
  unique (user_owned_property_id, property_upgrade_id)
);

create index if not exists user_owned_property_upgrades_parent_idx
  on public.user_owned_property_upgrades(user_owned_property_id);

create table if not exists public.user_owned_vehicles (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references auth.users(id) on delete cascade,
  vehicle_id            text not null references public.vehicles(id),
  nickname              text,
  notes                 text,
  assigned_upgrade_id   text references public.property_upgrades(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists user_owned_vehicles_user_idx on public.user_owned_vehicles(user_id);
create index if not exists user_owned_vehicles_vehicle_idx on public.user_owned_vehicles(vehicle_id);
create index if not exists user_owned_vehicles_assignment_idx on public.user_owned_vehicles(assigned_upgrade_id);

-- =========================================================================
-- Auto-create profile row on signup
-- =========================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, null);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================================
-- Row Level Security
-- =========================================================================

-- Reference tables: readable by everyone, writable by service role only.
alter table public.manufacturers         enable row level security;
alter table public.vehicle_tags          enable row level security;
alter table public.vehicles              enable row level security;
alter table public.vehicle_tag_links     enable row level security;
alter table public.properties            enable row level security;
alter table public.property_upgrades     enable row level security;

create policy "Reference tables are readable by everyone"
  on public.manufacturers for select using (true);
create policy "Reference tables are readable by everyone"
  on public.vehicle_tags for select using (true);
create policy "Reference tables are readable by everyone"
  on public.vehicles for select using (true);
create policy "Reference tables are readable by everyone"
  on public.vehicle_tag_links for select using (true);
create policy "Reference tables are readable by everyone"
  on public.properties for select using (true);
create policy "Reference tables are readable by everyone"
  on public.property_upgrades for select using (true);

-- Profiles: users can read any profile (for usernames) but only modify their own.
alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);

create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert with check (auth.uid() = id);

-- User-owned properties: owners only
alter table public.user_owned_properties enable row level security;

create policy "Users can view own properties"
  on public.user_owned_properties for select using (auth.uid() = user_id);
create policy "Users can insert own properties"
  on public.user_owned_properties for insert with check (auth.uid() = user_id);
create policy "Users can update own properties"
  on public.user_owned_properties for update using (auth.uid() = user_id);
create policy "Users can delete own properties"
  on public.user_owned_properties for delete using (auth.uid() = user_id);

-- User-owned property upgrades: check via join
alter table public.user_owned_property_upgrades enable row level security;

create policy "Users can view own property upgrades"
  on public.user_owned_property_upgrades for select using (
    exists (
      select 1 from public.user_owned_properties uop
      where uop.id = user_owned_property_upgrades.user_owned_property_id
        and uop.user_id = auth.uid()
    )
  );
create policy "Users can insert own property upgrades"
  on public.user_owned_property_upgrades for insert with check (
    exists (
      select 1 from public.user_owned_properties uop
      where uop.id = user_owned_property_upgrades.user_owned_property_id
        and uop.user_id = auth.uid()
    )
  );
create policy "Users can delete own property upgrades"
  on public.user_owned_property_upgrades for delete using (
    exists (
      select 1 from public.user_owned_properties uop
      where uop.id = user_owned_property_upgrades.user_owned_property_id
        and uop.user_id = auth.uid()
    )
  );

-- User-owned vehicles: owners only
alter table public.user_owned_vehicles enable row level security;

create policy "Users can view own vehicles"
  on public.user_owned_vehicles for select using (auth.uid() = user_id);
create policy "Users can insert own vehicles"
  on public.user_owned_vehicles for insert with check (auth.uid() = user_id);
create policy "Users can update own vehicles"
  on public.user_owned_vehicles for update using (auth.uid() = user_id);
create policy "Users can delete own vehicles"
  on public.user_owned_vehicles for delete using (auth.uid() = user_id);
