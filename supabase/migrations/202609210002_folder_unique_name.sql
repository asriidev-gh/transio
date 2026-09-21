-- Enforce unique folder names per user (case-insensitive).
-- Remap sessions from duplicate folders onto the oldest folder, then drop extras.

with survivors as (
  select
    user_id,
    lower(trim(name)) as name_key,
    (array_agg(id order by created_at asc, id asc))[1] as keep_id
  from public.session_folders
  group by user_id, lower(trim(name))
),
dupes as (
  select f.id as dupe_id, s.keep_id
  from public.session_folders f
  join survivors s
    on s.user_id = f.user_id
   and s.name_key = lower(trim(f.name))
  where f.id <> s.keep_id
)
update public.sessions sess
set folder_id = d.keep_id
from dupes d
where sess.folder_id = d.dupe_id;

with survivors as (
  select
    user_id,
    lower(trim(name)) as name_key,
    (array_agg(id order by created_at asc, id asc))[1] as keep_id
  from public.session_folders
  group by user_id, lower(trim(name))
)
delete from public.session_folders f
using survivors s
where f.user_id = s.user_id
  and lower(trim(f.name)) = s.name_key
  and f.id <> s.keep_id;

create unique index if not exists session_folders_user_id_name_unique_idx
  on public.session_folders (user_id, lower(trim(name)));
