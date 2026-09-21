-- Phase 11: thumbs feedback on summary / transcript

create table if not exists public.session_content_feedback (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  target text not null check (target in ('summary', 'transcript')),
  rating text not null check (rating in ('up', 'down')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint session_content_feedback_session_target_unique unique (session_id, target)
);

create index if not exists session_content_feedback_session_id_idx
  on public.session_content_feedback (session_id);

create or replace function public.set_session_content_feedback_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists session_content_feedback_set_updated_at on public.session_content_feedback;
create trigger session_content_feedback_set_updated_at
  before update on public.session_content_feedback
  for each row
  execute function public.set_session_content_feedback_updated_at();

alter table public.session_content_feedback enable row level security;

drop policy if exists "session_content_feedback_select_own" on public.session_content_feedback;
create policy "session_content_feedback_select_own"
  on public.session_content_feedback
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_content_feedback.session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "session_content_feedback_insert_own" on public.session_content_feedback;
create policy "session_content_feedback_insert_own"
  on public.session_content_feedback
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = session_content_feedback.session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "session_content_feedback_update_own" on public.session_content_feedback;
create policy "session_content_feedback_update_own"
  on public.session_content_feedback
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_content_feedback.session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = session_content_feedback.session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "session_content_feedback_delete_own" on public.session_content_feedback;
create policy "session_content_feedback_delete_own"
  on public.session_content_feedback
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = session_content_feedback.session_id
        and s.user_id = auth.uid()
    )
  );

comment on table public.session_content_feedback is
  'Per-session thumbs up/down on summary or transcript quality.';
