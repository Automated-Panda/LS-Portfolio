-- Sub-slot model: an upgrade row (an "install unit") can be subdivided
-- into addressable slots. e.g. CEO Office Floor 1 (20 cars) splits into
-- 1A / 1B / 1C with capacities 6/7/7. The upgrade itself is what users
-- buy; the sub-slot is what users address when assigning vehicles.
--
-- Applied via MCP on 2026-05-28.

alter table public.property_upgrades
  add column if not exists sub_slots jsonb;

alter table public.user_owned_vehicles
  add column if not exists sub_slot text;

comment on column public.property_upgrades.sub_slots is 'Optional sub-slot breakdown for upgrades that are visually divided (e.g. CEO Office floors A/B/C, mansion garage/driveway/podium). JSON shape: [{label: string, capacity: int}]. Sum should equal upgrade.capacity. Null = no sub-slots.';
comment on column public.user_owned_vehicles.sub_slot is 'Label of the specific sub-slot within assigned_upgrade_id where this vehicle parks. Null when the upgrade has no sub-slots, or vehicle is unassigned.';
