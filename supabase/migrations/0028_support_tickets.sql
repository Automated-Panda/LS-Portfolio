-- 0028_support_tickets.sql
-- User-submitted support/feedback tickets + admin-only internal notes.

create table if not exists public.support_tickets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  category     text not null check (category in ('bug','feature','data','suggestion','general','complaint')),
  message      text not null,
  related_item text,
  priority     text not null default 'normal' check (priority in ('low','normal','high')),
  status       text not null default 'new' check (status in ('new','in_review','planned','fixed','rejected','closed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_support_tickets_status
  on public.support_tickets (status, created_at desc);

create or replace function public.touch_support_tickets_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_support_tickets_touch on public.support_tickets;
create trigger trg_support_tickets_touch
  before update on public.support_tickets
  for each row execute procedure public.touch_support_tickets_updated_at();

alter table public.support_tickets enable row level security;

-- Users may submit + read their own tickets. Admin reads/writes go through the
-- service-role client (bypasses RLS), so there are no admin policies here.
create policy "Users can insert own tickets"
  on public.support_tickets for insert
  with check (auth.uid() = user_id);

create policy "Users can view own tickets"
  on public.support_tickets for select
  using (auth.uid() = user_id);

-- Internal notes: admin-only. RLS enabled with NO policies => service-role only.
create table if not exists public.support_ticket_notes (
  id         uuid primary key default gen_random_uuid(),
  ticket_id  uuid not null references public.support_tickets(id) on delete cascade,
  author_id  uuid references auth.users(id),
  body       text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_support_ticket_notes_ticket
  on public.support_ticket_notes (ticket_id, created_at);

alter table public.support_ticket_notes enable row level security;
