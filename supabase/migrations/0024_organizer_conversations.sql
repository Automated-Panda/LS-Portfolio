-- Threads for the AI organizer. A conversation groups multiple plan rows
-- (organizer_plans.conversation_id) into one continuable transcript.
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_conversations_user
  on public.conversations(user_id, updated_at desc);

alter table public.conversations enable row level security;

create policy "Users can view own conversations"
  on public.conversations for select using (auth.uid() = user_id);
create policy "Users can insert own conversations"
  on public.conversations for insert with check (auth.uid() = user_id);
create policy "Users can update own conversations"
  on public.conversations for update using (auth.uid() = user_id);
create policy "Users can delete own conversations"
  on public.conversations for delete using (auth.uid() = user_id);

create or replace function public.touch_conversation_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end; $$;

drop trigger if exists trg_conversations_touch on public.conversations;
create trigger trg_conversations_touch
  before update on public.conversations
  for each row execute procedure public.touch_conversation_updated_at();

alter table public.organizer_plans
  add column if not exists conversation_id uuid
    references public.conversations(id) on delete cascade;

create index if not exists idx_organizer_plans_conversation
  on public.organizer_plans(conversation_id, created_at);
