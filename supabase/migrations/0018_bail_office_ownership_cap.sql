-- Bail Office can only be owned 1 at a time (single office per character).
-- Per gtabase.com: buying a different bail office sells the current one.
insert into public.property_ownership_limits (ownership_group, max_owned)
  values ('bail-office', 1)
on conflict (ownership_group) do update set max_owned = 1;
