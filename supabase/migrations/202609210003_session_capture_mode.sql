-- Capture mode: how the session was recorded / processed for speech.
-- notes / live_notes persist summary only (no transcript row).

alter table public.sessions
  add column if not exists capture_mode text not null default 'batch';

alter table public.sessions
  drop constraint if exists sessions_capture_mode_check;

alter table public.sessions
  add constraint sessions_capture_mode_check check (
    capture_mode in ('live', 'batch', 'notes', 'live_notes')
  );

comment on column public.sessions.capture_mode is
  'How speech was captured: live captions, batch STT, auto notes (no transcript), or live note taker (no transcript).';
