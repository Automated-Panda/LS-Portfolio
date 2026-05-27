-- Mutually-exclusive upgrade groups: e.g. the Super Yacht's 3 model variants
-- (Aquarius / Pisces / Orion) — you can only own ONE model, not all three.
-- When the user installs an upgrade with a non-null mutex_group, the server
-- auto-uninstalls every other upgrade in the same group on the same
-- owned-property row.
--
-- Applied via MCP on 2026-05-28.

alter table public.property_upgrades
  add column if not exists mutex_group text;

comment on column public.property_upgrades.mutex_group is 'Optional cluster label. Upgrades sharing the same mutex_group on the same property are mutually exclusive — installing one auto-uninstalls the others (e.g. Super Yacht model variants).';

create index if not exists property_upgrades_mutex_group_idx
  on public.property_upgrades(property_id, mutex_group)
  where mutex_group is not null;
