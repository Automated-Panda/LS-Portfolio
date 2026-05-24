-- Piece 1: per-subtype ownership caps + group pooling.
-- Apartments + stand-alone garages share a 10-property cap post-Criminal
-- Enterprises (1.61). Specialist businesses cap at 1 each.

alter table public.properties
  add column if not exists ownership_group text;

-- Backfill: every property's group defaults to its subtype.
update public.properties set ownership_group = subtype where ownership_group is null;

-- Then collapse apartments + standalone garages into the residential pool.
-- Stilt houses are tagged subtype='high-end-apartment' (per Vinewood Hills
-- neighborhood) in the seed, so they're covered by that bucket.
update public.properties
  set ownership_group = 'residential'
  where subtype in (
    'high-end-apartment', 'mid-end-apartment', 'low-end-apartment',
    'stand-alone-garage'
  );

alter table public.properties
  alter column ownership_group set not null;

create index if not exists properties_ownership_group_idx
  on public.properties(ownership_group);

create table if not exists public.property_ownership_limits (
  ownership_group text primary key,
  max_owned       int not null check (max_owned > 0)
);

-- Eclipse Blvd Garage: no row inserted; server treats "no row" as unlimited.

insert into public.property_ownership_limits (ownership_group, max_owned) values
  ('residential',              10),
  ('casino-penthouse',          1),
  ('nightclub',                 1),
  ('ceo-office',                1),
  ('mc-clubhouse',              1),
  ('bunker',                    1),
  ('hangar',                    1),
  ('facility',                  1),
  ('arcade',                    1),
  ('auto-shop',                 1),  -- verify
  ('agency',                    1),  -- verify
  ('salvage-yard',              1),  -- verify
  ('vehicle-warehouse',         1),
  ('super-yacht',               1),
  ('biker-business-coke',       1),
  ('biker-business-meth',       1),
  ('biker-business-weed',       1),
  ('biker-business-cash',       1),
  ('biker-business-forgery',    1)
on conflict (ownership_group) do nothing;

-- Reference table: readable by everyone, writable by service role.
alter table public.property_ownership_limits enable row level security;

create policy "Ownership limits are readable by everyone"
  on public.property_ownership_limits for select using (true);
