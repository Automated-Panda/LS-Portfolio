-- 0047_multi_character_foundation.sql
-- Multi-character accounts — Phase 1 (data foundation). ADDITIVE + backward
-- compatible: existing code still filters owned data by user_id, so behaviour is
-- unchanged until the queries/actions are rewired to scope by active character.
--
-- Structure (all under one GTVault login / auth.users row):
--   game_profiles  = a GTA account (holds GTA+, groups characters). UI "Profile".
--   characters     = an in-game character that OWNS the assets. UI "Character".
--   profiles.active_character_id = the currently-selected character.
-- Owned + organizer tables gain a nullable character_id (kept alongside user_id
-- so RLS stays as-is). Existing users are migrated to one "Main" profile +
-- "Character 1" holding everything, GTA+ copied across.

-- ---- game_profiles (UI "Profile" = a GTA account) ------------------------
create table if not exists public.game_profiles (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Profile',
  gta_plus    boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists idx_game_profiles_user on public.game_profiles(user_id);

alter table public.game_profiles enable row level security;
drop policy if exists "own game_profiles select" on public.game_profiles;
drop policy if exists "own game_profiles insert" on public.game_profiles;
drop policy if exists "own game_profiles update" on public.game_profiles;
drop policy if exists "own game_profiles delete" on public.game_profiles;
create policy "own game_profiles select" on public.game_profiles for select using (auth.uid() = user_id);
create policy "own game_profiles insert" on public.game_profiles for insert with check (auth.uid() = user_id);
create policy "own game_profiles update" on public.game_profiles for update using (auth.uid() = user_id);
create policy "own game_profiles delete" on public.game_profiles for delete using (auth.uid() = user_id);

-- ---- characters (UI "Character" = owns the assets) -----------------------
create table if not exists public.characters (
  id              uuid primary key default gen_random_uuid(),
  game_profile_id uuid not null references public.game_profiles(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade, -- denormalised for RLS + scoping
  name            text not null default 'Character',
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);
create index if not exists idx_characters_user on public.characters(user_id);
create index if not exists idx_characters_profile on public.characters(game_profile_id);

alter table public.characters enable row level security;
drop policy if exists "own characters select" on public.characters;
drop policy if exists "own characters insert" on public.characters;
drop policy if exists "own characters update" on public.characters;
drop policy if exists "own characters delete" on public.characters;
create policy "own characters select" on public.characters for select using (auth.uid() = user_id);
create policy "own characters insert" on public.characters for insert with check (auth.uid() = user_id);
create policy "own characters update" on public.characters for update using (auth.uid() = user_id);
create policy "own characters delete" on public.characters for delete using (auth.uid() = user_id);

-- ---- account-level pointers ----------------------------------------------
alter table public.profiles
  add column if not exists active_character_id uuid references public.characters(id) on delete set null,
  add column if not exists extra_profile_slots int not null default 0; -- purchased slots beyond the 1 free

-- ---- character scope on owned + organizer tables -------------------------
alter table public.user_owned_vehicles
  add column if not exists character_id uuid references public.characters(id) on delete cascade;
alter table public.user_owned_properties
  add column if not exists character_id uuid references public.characters(id) on delete cascade;
alter table public.organizer_plans
  add column if not exists character_id uuid references public.characters(id) on delete cascade;
alter table public.conversations
  add column if not exists character_id uuid references public.characters(id) on delete cascade;
create index if not exists idx_uov_character on public.user_owned_vehicles(character_id);
create index if not exists idx_uop_character on public.user_owned_properties(character_id);
create index if not exists idx_org_plans_character on public.organizer_plans(character_id);
create index if not exists idx_conversations_character on public.conversations(character_id);

-- ---- backfill existing users (idempotent: only users without an active char)
do $$
declare r record; v_gp uuid; v_ch uuid;
begin
  for r in select id, gta_plus from public.profiles where active_character_id is null loop
    insert into public.game_profiles (user_id, name, gta_plus, sort_order)
      values (r.id, 'Main', coalesce(r.gta_plus, false), 0) returning id into v_gp;
    insert into public.characters (game_profile_id, user_id, name, sort_order)
      values (v_gp, r.id, 'Character 1', 0) returning id into v_ch;
    update public.profiles set active_character_id = v_ch where id = r.id;
    update public.user_owned_vehicles   set character_id = v_ch where user_id = r.id;
    update public.user_owned_properties set character_id = v_ch where user_id = r.id;
    update public.organizer_plans       set character_id = v_ch where user_id = r.id;
    update public.conversations         set character_id = v_ch where user_id = r.id;
  end loop;
end $$;

-- ---- new-signup trigger: also create a default profile + character --------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  v_username text;
  v_gp uuid;
  v_ch uuid;
begin
  v_username := nullif(new.raw_user_meta_data->>'username', '');

  insert into public.profiles (id, username) values (new.id, v_username);
  insert into public.user_credits (user_id, free_monthly, free_period_start, balance_credits)
    values (new.id, 10, now(), 20);

  insert into public.game_profiles (user_id, name) values (new.id, 'Main') returning id into v_gp;
  insert into public.characters (game_profile_id, user_id, name)
    values (v_gp, new.id, 'Character 1') returning id into v_ch;
  update public.profiles set active_character_id = v_ch where id = new.id;

  return new;
end; $$;
