-- 0030_admin_activity_log.sql
-- Append-only audit log of admin actions. Written + read only via the
-- service-role client (owner-gated page) — RLS on, no policies.
create table if not exists public.admin_activity_log (
  id           uuid primary key default gen_random_uuid(),
  actor_id     uuid references auth.users(id),
  actor_email  text,
  action       text not null,
  target_label text,
  target_id    text,
  changes      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

create index if not exists idx_admin_activity_created
  on public.admin_activity_log (created_at desc);

alter table public.admin_activity_log enable row level security;
