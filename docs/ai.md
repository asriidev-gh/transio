# AI & transcription

## Phase status

- Phase 6: speech-to-text provider + transcript persistence + transcript UI
- Phase 7: Claude structured summaries
- Phase 8: end-to-end processing pipeline
- Phase 9: reliability (provider retries, recovery UX)
- Phase 10: MVP polish (edit/delete, confirmations, production config)
- Phase 11: Harbor Studio UI + `POST /sessions/:id/ask` Q&A over transcript/summary

## Pipeline

```text
Record
  → Upload
  → (auto) POST /sessions/:id/process   — or manual from Processing screen
  → status = transcribing
  → TranscriptionProvider.transcribe(...)
  → save transcripts row
  → status = transcribed   ← pipeline stops here for normal recordings

Opt-in AI summary (Notes / Transcript → Generate summary):
  → POST /sessions/:id/summarize
  → status = summarizing
  → SummaryProvider.summarize(...)  (Claude + Zod)
  → save summaries row with kind = ai_summary
  → status = completed

Notes-only capture (Record Notes / Live Note Taker):
  → process transcribes ephemerally (no transcript row)
  → save summaries row with kind = notes
  → status = completed
  → optional later: Generate summary → kind = ai_summary
```

On failure, audio/transcript are retained and status becomes `failed` with a retry path
via `POST /sessions/:id/process` (transcript sessions stay at `transcribed`; summary is
started separately with `POST /sessions/:id/summarize`).

## Transcription provider

```ts
interface TranscriptionProvider {
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}
```

Initial implementation: `HttpTranscriptionProvider` (OpenAI Whisper-compatible
`POST /audio/transcriptions`).

| Env | Purpose |
| --- | --- |
| `TRANSCRIPTION_API_KEY` | Server-only API key |
| `TRANSCRIPTION_BASE_URL` | Optional; default `https://api.openai.com/v1` |

Swap providers by implementing `TranscriptionProvider` and wiring it in
`createTranscriptionProvider()` / app deps. Tests use `FakeTranscriptionProvider`.

## Summary provider (Claude)

```ts
interface SummaryProvider {
  summarize(input: SummaryInput): Promise<SessionSummary>;
}
```

Implementation: `ClaudeSummaryProvider` calls Anthropic Messages API with a
`tool_use` schema matching `SessionSummary`, then validates with Zod before
persistence.

Session-type prompts live in `apps/api/src/prompts/summary.ts`
(seminar, group_discussion, bible_study, meeting, lecture, other).

| Env | Purpose |
| --- | --- |
| `ANTHROPIC_API_KEY` | Server-only Claude API key |

Tests use `FakeSummaryProvider`.

## End-to-end processing

`runProcessingPipeline` chains transcription → summarization in one async job.
`POST /sessions/:id/process` starts it; successful audio uploads also best-effort
auto-start when both providers are configured.

The mobile **Processing** screen polls `GET /sessions/:id/status` and renders
pipeline stages from backend status (`hasAudio`, `hasTranscript`, `hasSummary`).

## API

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/sessions/:id/transcribe` | Starts async transcription only |
| `GET` | `/sessions/:id/transcript` | Full transcript text |
| `PUT` | `/sessions/:id/transcript` | Upsert client transcript (live captions finals) |
| `POST` | `/sessions/:id/summarize` | Starts async Claude summary only |
| `GET` | `/sessions/:id/summary` | Structured summary record |
| `POST` | `/sessions/:id/process` | Transcribe (notes modes also write notes); summary is opt-in |
| `GET` | `/sessions/:id/status` | `{ status, hasAudio, hasTranscript, hasSummary }` for polling |
| `POST` | `/sessions/:id/notes-live` | Merge live speech into structured notes (Live Note Taker) |
| `POST` | `/sessions/:id/notes/finalize` | Persist notes + mark completed (notes-only modes) |
| `WS` | `/live/transcribe` + auth frame | Deepgram live caption proxy (server holds `DEEPGRAM_API_KEY`) |

## Live captions

Recording streams microphone PCM to `ws://…/live/transcribe?language=…`, then authenticates
with `{ "type": "auth", "token": "<jwt>" }` (never put the JWT in the query string). The API proxies
binary audio to Deepgram Listen and returns normalized `{ type: "transcript", text, isFinal }`
events. On stop, finals are saved with `PUT /sessions/:id/transcript`. The processing
pipeline skips Whisper when a transcript already exists.

- **Web:** AudioContext → linear16 PCM  
- **iOS / Android:** `expo-audio-stream-pcm` → linear16 PCM (needs a **development or EAS build**; not Expo Go)
- **Live Note Taker:** `POST /sessions/:id/notes-live` uses Haiku (`ANTHROPIC_TRANSLATE_MODEL`)
  for faster merges while recording; full post-session summaries still use Sonnet.
- **Spoken language Auto:** Deepgram `language=multi` (EN/ES/FR/DE/HI/RU/PT/JA/IT/NL). Tagalog and
  Chinese still need an explicit language chip.

## Capture modes (notes)

Sessions store `captureMode`: `live` | `batch` | `notes` | `live_notes`.

| Mode | While recording | After stop |
| --- | --- | --- |
| `live` | Live captions (+ optional translate) | Audio + transcript; AI summary opt-in |
| `batch` | Audio only | Upload → transcribe; AI summary opt-in |
| `notes` (Record Notes) | Audio only | Upload → ephemeral STT → **raw sentence notes**; AI summary opt-in |
| `live_notes` (Live Note Taker) | Paper notes (one bullet per sentence) | Finalize raw notes + upload audio; AI summary opt-in |

Apply migrations `202609210003_session_capture_mode.sql` and `202609220001_summary_kinds.sql` in Supabase.

| Env | Purpose |
| --- | --- |
| `DEEPGRAM_API_KEY` | Server-only Deepgram key for the live WS proxy |
| `ANTHROPIC_API_KEY` | Required for live translate (and post-session Translate) |

## Ask (session Q&A)

`POST /sessions/:id/ask` with `{ "question": "..." }` returns
`{ answer, suggestedFollowUps }` using Claude grounded in the session transcript
(and summary when available). Requires `ANTHROPIC_API_KEY` on the API.

## Translate

`POST /sessions/:id/translate` with `{ "language": "<code>", "scope": "summary"|"transcript" }`
returns an on-demand Claude translation (not persisted). Uses a fast Haiku model by
default (`ANTHROPIC_TRANSLATE_MODEL`, separate from Sonnet used for summaries). Language is
chosen from a curated select list. Transcript segments use compact parallel batches.
Requires `ANTHROPIC_API_KEY` on the API.

## Transcript segments

Whisper `verbose_json` segments are stored on `transcripts.segments` as
`{ startMs, endMs, text, speaker? }`. After transcription, Claude (when
`ANTHROPIC_API_KEY` is set) relabels speakers from dialogue context; pause-heuristic
A/B labels remain as fallback. Users can rename speakers via
`PATCH /sessions/:id/transcript/speakers`.
Migration: `supabase/migrations/202609200005_transcript_segments.sql`

## Database

Table `transcripts` (one row per session) with RLS via owning `sessions.user_id`.  
Migration: `supabase/migrations/202609200003_create_transcripts.sql`

Table `summaries` (one row per session) with RLS via owning `sessions.user_id`.  
Migration: `supabase/migrations/202609200004_create_summaries.sql`

## Safety

- Never log full transcripts, audio bytes, or secrets in production (`LOG_SENSITIVE=false`).
- Never expose AI keys through `EXPO_PUBLIC_*` variables.
