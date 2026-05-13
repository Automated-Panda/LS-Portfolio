-- handle_new_user is invoked by the on_auth_user_created trigger only.
-- It must not be callable via /rest/v1/rpc by anon or authenticated.
revoke execute on function public.handle_new_user() from anon, authenticated, public;
