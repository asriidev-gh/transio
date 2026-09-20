-- Phase 11C: timed transcript segments (Whisper verbose_json + optional speaker labels)

alter table public.transcripts
  add column if not exists segments jsonb not null default '[]'::jsonb;

comment on column public.transcripts.segments is
  'Array of { startMs, endMs, text, speaker? } from transcription.';
