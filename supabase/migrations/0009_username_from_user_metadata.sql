-- The original handle_new_user trigger inserted a profiles row with username=null,
-- and signUpAction did a follow-up UPDATE to set the real username. That worked
-- when email confirmation was OFF (signUp returned an authenticated session) but
-- breaks now that confirmation is ON — no session means no RLS auth.uid(), so
-- the UPDATE silently fails.
--
-- Fix: pull the username out of raw_user_meta_data (which signUpAction now passes
-- via options.data). The trigger runs as SECURITY DEFINER so RLS is bypassed.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_username text;
begin
  v_username := nullif(new.raw_user_meta_data->>'username', '');
  insert into public.profiles (id, username)
  values (new.id, v_username);
  return new;
end;
$$;
