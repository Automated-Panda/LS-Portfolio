-- Fixup: 0005 used 'super-yacht' as the limits-table key but the seed has
-- subtype='yacht' (yachts-seed.ts). Result: the Super Yacht property had no
-- ownership cap because the join key didn't match. Realign to the seed.

delete from public.property_ownership_limits
  where ownership_group = 'super-yacht';

insert into public.property_ownership_limits (ownership_group, max_owned)
  values ('yacht', 1)
  on conflict (ownership_group) do nothing;
