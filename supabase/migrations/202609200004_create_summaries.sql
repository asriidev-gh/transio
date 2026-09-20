-- Phase 7: summaries table with RLS (via owning session)

create table if not exists public.summaries (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions (id) on delete cascade,
  overview text,
  key_points jsonb not null default '[]'::jsonb,
  topics jsonb not null default '[]'::jsonb,
  questions_discussed jsonb not null default '[]'::jsonb,
  action_items jsonb not null default '[]'::jsonb,
  important_insights jsonb not null default '[]'::jsonb,
  quotes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint summaries_session_id_unique unique (session_id)
);

create index if not exists summaries_session_id_idx
  on public.summaries (session_id);

create or replace function public.set_summaries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists summaries_set_updated_at on public.summaries;
create trigger summaries_set_updated_at
  before update on public.summaries
  for each row
  execute function public.set_summaries_updated_at();

alter table public.summaries enable row level security;

drop policy if exists "summaries_select_own" on public.summaries;
create policy "summaries_select_own"
  on public.summaries
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = summaries.session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "summaries_insert_own" on public.summaries;
create policy "summaries_insert_own"
  on public.summaries
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = summaries.session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "summaries_update_own" on public.summaries;
create policy "summaries_update_own"
  on public.summaries
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = summaries.session_id
        and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.sessions s
      where s.id = summaries.session_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "summaries_delete_own" on public.summaries;
create policy "summaries_delete_own"
  on public.summaries
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.sessions s
      where s.id = summaries.session_id
        and s.user_id = auth.uid()
    )
  );

revoke all on table public.summaries from anon;
grant select, insert, update, delete on table public.summaries to authenticated;
