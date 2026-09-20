-- Phase 11E: session favorites

alter table public.sessions
  add column if not exists favorited_at timestamptz;

create index if not exists sessions_user_id_favorited_at_idx
  on public.sessions (user_id, favorited_at desc nulls last);

comment on column public.sessions.favorited_at is
  'When set, the session appears in Favorites. Null means not favorited.';
