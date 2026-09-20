-- Phase 6: transcripts table with RLS (via owning session)

create table if not exists public.transcripts (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  text text not null,
  language text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint transcripts_text_not_empty check (char_length(trim(text)) > 0),
  constraint transcripts_session_id_unique unique (session_id)
);

create index if not exists transcripts_session_id_idx
  on public.transcripts (session_id);

create or replace function public.set_transcripts_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists transcripts_set_updated_at on public.transcripts;
create trigger transcripts_set_updated_at
  before update on public.transcripts
  for each row
  execute function public.set_transcripts_updated_at();

alter table public.transcripts enable row level security;

drop policy if exists "transcripts_select_own" on public.transcripts;
create policy "transcripts_select_own"
  on public.transcripts
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = transcripts.session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "transcripts_insert_own" on public.transcripts;
create policy "transcripts_insert_own"
  on public.transcripts
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = transcripts.session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "transcripts_update_own" on public.transcripts;
create policy "transcripts_update_own"
  on public.transcripts
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = transcripts.session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = transcripts.session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "transcripts_delete_own" on public.transcripts;
create policy "transcripts_delete_own"
  on public.transcripts
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = transcripts.session_id
        and s.user_id = auth.uid()
    )
  );

revoke all on table public.transcripts from anon;
grant select, insert, update, delete on table public.transcripts to authenticated;
