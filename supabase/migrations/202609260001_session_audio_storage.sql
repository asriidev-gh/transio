-- Device-only audio: the file is uploaded so it can be transcribed, then the
-- cloud copy is removed and the phone keeps the only copy.
--
-- 'cloud'  — audio stays in the session-audio bucket (the default, unchanged).
-- 'device' — the cloud copy was deleted on purpose; audio_path is null but the
--            session still has audio somewhere, which is not the same as a
--            session that never had any.

alter table public.sessions
  add column if not exists audio_storage text not null default 'cloud';

alter table public.sessions
  drop constraint if exists sessions_audio_storage_check;

alter table public.sessions
  add constraint sessions_audio_storage_check
  check (audio_storage in ('cloud', 'device'));

comment on column public.sessions.audio_storage is
  'Where the audio lives once processing finishes: cloud keeps it in storage, device means the cloud copy was deleted and only the recording phone has it.';
