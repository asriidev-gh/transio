-- Subscription state written by the billing webhook (RevenueCat).
--
-- Webhook deliveries can arrive out of order or be retried, so every update carries the event
-- time and an older event never overwrites a newer one.

alter table public.subscriptions
  add column if not exists environment text,
  add column if not exists last_event_ms bigint not null default 0;

-- Returns true when the row was written, false when a newer event had already been applied.
create or replace function public.apply_subscription_event(
  p_user_id uuid,
  p_is_active boolean,
  p_plan_id text,
  p_expires_at timestamptz,
  p_environment text,
  p_event_ms bigint
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  insert into public.subscriptions as s
    (user_id, is_active, plan_id, expires_at, environment, last_event_ms, updated_at)
  values
    (p_user_id, p_is_active, p_plan_id, p_expires_at, p_environment, p_event_ms,
     timezone('utc', now()))
  on conflict (user_id) do update set
    is_active = excluded.is_active,
    plan_id = coalesce(excluded.plan_id, s.plan_id),
    expires_at = excluded.expires_at,
    environment = excluded.environment,
    last_event_ms = excluded.last_event_ms,
    updated_at = excluded.updated_at
  where s.last_event_ms <= excluded.last_event_ms;

  get diagnostics v_rows = row_count;
  return v_rows > 0;
end;
$$;

revoke all on function public.apply_subscription_event(uuid, boolean, text, timestamptz, text, bigint)
  from public, anon, authenticated;
grant execute on function public.apply_subscription_event(uuid, boolean, text, timestamptz, text, bigint)
  to service_role;
