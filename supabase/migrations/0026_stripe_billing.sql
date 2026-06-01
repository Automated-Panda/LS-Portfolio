-- 0026_stripe_billing.sql
-- Stripe ↔ user mapping + an atomic, idempotent credit-grant function used by
-- the Stripe webhook to fulfill purchases.

alter table public.user_credits
  add column if not exists stripe_customer_id     text,
  add column if not exists stripe_subscription_id text;

create index if not exists idx_user_credits_stripe_customer
  on public.user_credits (stripe_customer_id);

-- grant_credits: atomic fulfillment. Locks the user's row, is idempotent on
-- stripe_event_id, updates the correct bucket, and writes the audit row — all
-- in one transaction. 'purchased' ADDS to the never-expiring bucket;
-- 'subscription' SETS the monthly allotment (does not stack) + marks active.
create or replace function public.grant_credits(
  p_user_id         uuid,
  p_amount          integer,
  p_kind            text,          -- 'purchased' | 'subscription'
  p_reason          credit_reason,
  p_stripe_event_id text,
  p_sub_period_end  timestamptz default null
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket text;
  v_total  integer;
begin
  -- Idempotency: skip if this Stripe event was already applied.
  if p_stripe_event_id is not null and exists (
    select 1 from public.credit_transactions where stripe_event_id = p_stripe_event_id
  ) then
    return;
  end if;

  -- Lock the user's credit row for the duration of the transaction.
  perform 1 from public.user_credits where user_id = p_user_id for update;
  if not found then
    raise exception 'grant_credits: no user_credits row for %', p_user_id;
  end if;

  if p_kind = 'purchased' then
    update public.user_credits
      set balance_credits = balance_credits + p_amount
      where user_id = p_user_id;
    v_bucket := 'purchased';
  elsif p_kind = 'subscription' then
    update public.user_credits
      set sub_monthly     = p_amount,
          has_active_sub  = true,
          sub_period_end  = p_sub_period_end
      where user_id = p_user_id;
    v_bucket := 'sub';
  else
    raise exception 'grant_credits: invalid kind %', p_kind;
  end if;

  select free_monthly + sub_monthly + balance_credits into v_total
    from public.user_credits where user_id = p_user_id;

  insert into public.credit_transactions
    (user_id, delta, reason, bucket, balance_after, stripe_event_id)
    values (p_user_id, p_amount, p_reason, v_bucket, v_total, p_stripe_event_id);
end;
$$;

-- Lock it down: only the service role (server) may grant credits.
revoke all on function public.grant_credits(uuid, integer, text, credit_reason, text, timestamptz) from public;
revoke all on function public.grant_credits(uuid, integer, text, credit_reason, text, timestamptz) from anon;
revoke all on function public.grant_credits(uuid, integer, text, credit_reason, text, timestamptz) from authenticated;
grant execute on function public.grant_credits(uuid, integer, text, credit_reason, text, timestamptz) to service_role;
