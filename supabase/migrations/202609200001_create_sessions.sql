-- Phase 3: sessions table with Row Level Security
-- Users may only access their own sessions.

create extension if not exists "pgcrypto";

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  session_type text not null,
  description text,
  recorded_at timestamptz not null default timezone('utc', now()),
  duration_seconds integer,
  audio_path text,
  status text not null default 'recording',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint sessions_title_not_empty check (char_length(trim(title)) > 0),
  constraint sessions_session_type_check check (
    session_type in (
      'seminar',
      'group_discussion',
      'bible_study',
      'meeting',
      'lecture',
      'other'
    )
  ),
  constraint sessions_status_check check (
    status in (
      'recording',
      'uploaded',
      'transcribing',
      'transcribed',
      'summarizing',
      'completed',
      'failed'
    )
  ),
  constraint sessions_duration_nonnegative check (
    duration_seconds is null or duration_seconds >= 0
  )
);

create index if not exists sessions_user_id_recorded_at_idx
  on public.sessions (user_id, recorded_at desc);

create or replace function public.set_sessions_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists sessions_set_updated_at on public.sessions;
create trigger sessions_set_updated_at
  before update on public.sessions
  for each row
  execute function public.set_sessions_updated_at();

alter table public.sessions enable row level security;

drop policy if exists "sessions_select_own" on public.sessions;
create policy "sessions_select_own"
  on public.sessions
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "sessions_insert_own" on public.sessions;
create policy "sessions_insert_own"
  on public.sessions
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "sessions_update_own" on public.sessions;
create policy "sessions_update_own"
  on public.sessions
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "sessions_delete_own" on public.sessions;
create policy "sessions_delete_own"
  on public.sessions
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Deny anon access explicitly (no policies for anon).
revoke all on table public.sessions from anon;
grant select, insert, update, delete on table public.sessions to authenticated;
