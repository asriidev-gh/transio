-- Speeds up the API's stale-job sweep (sessions left transcribing/summarizing after a restart).
create index if not exists sessions_in_progress_updated_idx
  on public.sessions (updated_at)
  where status in ('transcribing', 'summarizing');
