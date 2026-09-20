# AI & transcription

## Phase status

- Phase 6: speech-to-text provider + transcript persistence + transcript UI
- Phase 7: Claude structured summaries
- Phase 8: end-to-end processing pipeline
- Phase 9: reliability (provider retries, recovery UX) ← current

## Pipeline

```text
Record
  → Upload
  → (auto) POST /sessions/:id/process   — or manual from Processing screen
  → status = transcribing
  → TranscriptionProvider.transcribe(...)
  → save transcripts row
  → status = transcribed
  → status = summarizing
  → SummaryProvider.summarize(...)  (Claude + Zod)
  → save summaries row
  → status = completed
```

On failure, audio/transcript are retained and status becomes `failed` with a retry path
via `POST /sessions/:id/process` (resumes at summarize if a transcript already exists).

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
| `POST` | `/sessions/:id/summarize` | Starts async Claude summary only |
| `GET` | `/sessions/:id/summary` | Structured summary record |
| `POST` | `/sessions/:id/process` | Full pipeline (transcribe → summarize) |
| `GET` | `/sessions/:id/status` | `{ status, hasAudio, hasTranscript, hasSummary }` for polling |

## Database

Table `transcripts` (one row per session) with RLS via owning `sessions.user_id`.  
Migration: `supabase/migrations/202609200003_create_transcripts.sql`

Table `summaries` (one row per session) with RLS via owning `sessions.user_id`.  
Migration: `supabase/migrations/202609200004_create_summaries.sql`

## Safety

- Never log full transcripts, audio bytes, or secrets in production (`LOG_SENSITIVE=false`).
- Never expose AI keys through `EXPO_PUBLIC_*` variables.
