-- User-owned folders to group sessions. Sessions.folder_id is optional (null = unfiled).

create table if not exists public.session_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint session_folders_name_not_empty check (char_length(trim(name)) > 0)
);

create index if not exists session_folders_user_id_name_idx
  on public.session_folders (user_id, name);

create or replace function public.set_session_folders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists session_folders_set_updated_at on public.session_folders;
create trigger session_folders_set_updated_at
  before update on public.session_folders
  for each row
  execute function public.set_session_folders_updated_at();

alter table public.session_folders enable row level security;

drop policy if exists "session_folders_select_own" on public.session_folders;
create policy "session_folders_select_own"
  on public.session_folders
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "session_folders_insert_own" on public.session_folders;
create policy "session_folders_insert_own"
  on public.session_folders
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "session_folders_update_own" on public.session_folders;
create policy "session_folders_update_own"
  on public.session_folders
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "session_folders_delete_own" on public.session_folders;
create policy "session_folders_delete_own"
  on public.session_folders
  for delete
  to authenticated
  using (auth.uid() = user_id);

revoke all on table public.session_folders from anon;
grant select, insert, update, delete on table public.session_folders to authenticated;

alter table public.sessions
  add column if not exists folder_id uuid references public.session_folders (id) on delete set null;

create index if not exists sessions_user_id_folder_id_idx
  on public.sessions (user_id, folder_id);

create or replace function public.assert_session_folder_owner()
returns trigger
language plpgsql
as $$
begin
  if new.folder_id is null then
    return new;
  end if;
  if not exists (
    select 1
    from public.session_folders f
    where f.id = new.folder_id
      and f.user_id = new.user_id
  ) then
    raise exception 'folder does not belong to this user';
  end if;
  return new;
end;
$$;

drop trigger if exists sessions_assert_folder_owner on public.sessions;
create trigger sessions_assert_folder_owner
  before insert or update of folder_id, user_id
  on public.sessions
  for each row
  execute function public.assert_session_folder_owner();

comment on table public.session_folders is
  'Per-user folders for grouping sessions on Home.';
comment on column public.sessions.folder_id is
  'Optional folder. Null means the session is unfiled. ON DELETE SET NULL.';
