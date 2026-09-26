-- Audio retention.
--
-- Text is cheap to keep forever; a recorded hour is tens of megabytes, so audio
-- is what the storage bill is made of. Sessions therefore carry an expiry:
--
--   Free / lapsed  — 30 days, then the object is deleted and audio_path nulled.
--   Pro, active    — null expiry, kept for as long as the subscription runs.
--
-- Notes, transcripts and summaries are never touched by any of this. Losing the
-- recording is a cost saving; losing what someone wrote is losing their work.

alter table public.sessions
  add column if not exists audio_expires_at timestamptz;

comment on column public.sessions.audio_expires_at is
  'When the stored audio may be deleted. Null means keep it (an active subscription). Notes, transcripts and summaries are unaffected.';

-- The sweep asks for rows that still have audio and are past their expiry, so
-- index exactly that and skip the rows it can never match.
create index if not exists sessions_audio_expiry_idx
  on public.sessions (audio_expires_at)
  where audio_path is not null and audio_expires_at is not null;

/**
 * Re-dates a user's stored audio after their subscription changes.
 *
 * Subscribing lifts the expiry from everything they already have, so paying
 * rescues recordings that were counting down. Lapsing starts a fresh window
 * from now rather than from upload, which is what gives someone their 30 days
 * to download before anything is removed.
 *
 * Only ever touches rows that still hold audio.
 */
create or replace function public.reschedule_audio_retention(
  p_user_id uuid,
  p_is_pro boolean,
  p_retention_days integer default 30
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  update public.sessions
  set audio_expires_at = case
        when p_is_pro then null
        else timezone('utc', now()) + make_interval(days => p_retention_days)
      end
  where user_id = p_user_id
    and audio_path is not null;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

revoke all on function public.reschedule_audio_retention(uuid, boolean, integer) from public;
