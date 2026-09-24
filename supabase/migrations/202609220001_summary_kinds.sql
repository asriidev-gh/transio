-- Separate capture notes from opt-in AI summaries (same session may have both).
alter table public.summaries
  add column if not exists kind text not null default 'notes';

alter table public.summaries
  drop constraint if exists summaries_session_id_unique;

update public.summaries su
set kind = case
  when s.capture_mode in ('notes', 'live_notes') then 'notes'
  else 'ai_summary'
end
from public.sessions s
where s.id = su.session_id;

alter table public.summaries
  drop constraint if exists summaries_kind_check;

alter table public.summaries
  add constraint summaries_kind_check check (kind in ('notes', 'ai_summary'));

alter table public.summaries
  drop constraint if exists summaries_session_kind_unique;

alter table public.summaries
  add constraint summaries_session_kind_unique unique (session_id, kind);
