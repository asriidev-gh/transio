-- Server-side usage quotas.
--
-- Free usage is counted per DEVICE (a hashed device id), so a new account or a reinstall does
-- not reset it. Pro usage is counted per account per UTC day. A global per-day counter is the
-- spend kill switch. Only the API (service role) touches these tables: RLS is on with no
-- policies, and the functions are not executable by anon or authenticated users.

create table if not exists public.device_usage (
  device_hash text not null,
  feature text not null check (feature in ('session', 'summary', 'voiceTranslate')),
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (device_hash, feature)
);

-- Pro daily usage. A lifetime counter for accounts with no known device uses the sentinel
-- day 1970-01-01.
create table if not exists public.account_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  feature text not null check (feature in ('session', 'summary', 'voiceTranslate')),
  day date not null,
  used integer not null default 0 check (used >= 0),
  primary key (user_id, feature, day)
);

create table if not exists public.global_usage (
  day date not null,
  feature text not null check (feature in ('session', 'summary', 'voiceTranslate')),
  used integer not null default 0 check (used >= 0),
  primary key (day, feature)
);

-- A Voice translate conversation is charged once, however many turns it has.
create table if not exists public.quota_conversations (
  owner text not null,
  conversation_id text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (owner, conversation_id)
);

-- One guest (anonymous) account per device.
create table if not exists public.guest_devices (
  device_hash text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

-- Filled by the billing webhook later. Until then nobody is Pro on the server.
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  is_active boolean not null default false,
  plan_id text,
  expires_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.device_usage enable row level security;
alter table public.account_usage enable row level security;
alter table public.global_usage enable row level security;
alter table public.quota_conversations enable row level security;
alter table public.guest_devices enable row level security;
alter table public.subscriptions enable row level security;

-- Returns 'ok', 'already_counted', 'free_limit', 'daily_limit' or 'paused'.
-- Every step runs in one sub-transaction: a denial raises, which rolls back the counters that
-- were already incremented, so a refused request never leaves a partial charge behind.
create or replace function public.consume_quota(
  p_feature text,
  p_user_id uuid,
  p_device_hash text,
  p_is_pro boolean,
  p_free_limit integer,
  p_pro_daily_limit integer,
  p_global_limit integer,
  p_conversation_id text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (timezone('utc', now()))::date;
  v_owner text;
  v_rows integer;
begin
  begin
    if p_conversation_id is not null then
      v_owner := case
        when p_is_pro or p_device_hash is null then 'user:' || p_user_id::text
        else 'device:' || p_device_hash
      end;
      insert into public.quota_conversations (owner, conversation_id)
        values (v_owner, p_conversation_id)
        on conflict do nothing;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then
        return 'already_counted';
      end if;
    end if;

    if p_global_limit is not null then
      insert into public.global_usage as g (day, feature, used)
        values (v_day, p_feature, 1)
        on conflict (day, feature) do update set used = g.used + 1
          where g.used < p_global_limit;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then
        raise exception 'quota_denied:paused';
      end if;
    end if;

    if p_is_pro then
      insert into public.account_usage as a (user_id, feature, day, used)
        values (p_user_id, p_feature, v_day, 1)
        on conflict (user_id, feature, day) do update set used = a.used + 1
          where a.used < p_pro_daily_limit;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then
        raise exception 'quota_denied:daily_limit';
      end if;
    elsif p_device_hash is not null then
      insert into public.device_usage as d (device_hash, feature, used)
        values (p_device_hash, p_feature, 1)
        on conflict (device_hash, feature) do update
          set used = d.used + 1, updated_at = timezone('utc', now())
          where d.used < p_free_limit;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then
        raise exception 'quota_denied:free_limit';
      end if;
    else
      insert into public.account_usage as a (user_id, feature, day, used)
        values (p_user_id, p_feature, date '1970-01-01', 1)
        on conflict (user_id, feature, day) do update set used = a.used + 1
          where a.used < p_free_limit;
      get diagnostics v_rows = row_count;
      if v_rows = 0 then
        raise exception 'quota_denied:free_limit';
      end if;
    end if;

    return 'ok';
  exception
    when raise_exception then
      if sqlerrm like 'quota_denied:%' then
        return substr(sqlerrm, length('quota_denied:') + 1);
      end if;
      raise;
  end;
end;
$$;

-- Undo one successful consume_quota call, for example when the request then failed.
create or replace function public.refund_quota(
  p_feature text,
  p_user_id uuid,
  p_device_hash text,
  p_is_pro boolean,
  p_global_limit integer,
  p_conversation_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_day date := (timezone('utc', now()))::date;
  v_owner text;
  v_rows integer;
begin
  if p_conversation_id is not null then
    v_owner := case
      when p_is_pro or p_device_hash is null then 'user:' || p_user_id::text
      else 'device:' || p_device_hash
    end;
    delete from public.quota_conversations
      where owner = v_owner and conversation_id = p_conversation_id;
    get diagnostics v_rows = row_count;
    if v_rows = 0 then
      return;
    end if;
  end if;

  if p_global_limit is not null then
    update public.global_usage
      set used = greatest(used - 1, 0)
      where day = v_day and feature = p_feature;
  end if;

  if p_is_pro then
    update public.account_usage
      set used = greatest(used - 1, 0)
      where user_id = p_user_id and feature = p_feature and day = v_day;
  elsif p_device_hash is not null then
    update public.device_usage
      set used = greatest(used - 1, 0)
      where device_hash = p_device_hash and feature = p_feature;
  else
    update public.account_usage
      set used = greatest(used - 1, 0)
      where user_id = p_user_id and feature = p_feature and day = date '1970-01-01';
  end if;
end;
$$;

revoke all on function public.consume_quota(text, uuid, text, boolean, integer, integer, integer, text)
  from public, anon, authenticated;
revoke all on function public.refund_quota(text, uuid, text, boolean, integer, text)
  from public, anon, authenticated;
grant execute on function public.consume_quota(text, uuid, text, boolean, integer, integer, integer, text)
  to service_role;
grant execute on function public.refund_quota(text, uuid, text, boolean, integer, text)
  to service_role;
