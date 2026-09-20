-- Phase 5: private session-audio storage bucket + RLS policies
-- Audio files are never publicly accessible; use signed URLs for playback.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'session-audio',
  'session-audio',
  false,
  104857600, -- 100 MB
  array[
    'audio/mp4',
    'audio/m4a',
    'audio/x-m4a',
    'audio/mpeg',
    'audio/wav',
    'audio/webm',
    'audio/ogg',
    'video/webm',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Object path convention: {user_id}/{session_id}/audio.{ext}
-- First folder must match auth.uid().

drop policy if exists "session_audio_select_own" on storage.objects;
create policy "session_audio_select_own"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'session-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "session_audio_insert_own" on storage.objects;
create policy "session_audio_insert_own"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'session-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "session_audio_update_own" on storage.objects;
create policy "session_audio_update_own"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'session-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'session-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "session_audio_delete_own" on storage.objects;
create policy "session_audio_delete_own"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'session-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
