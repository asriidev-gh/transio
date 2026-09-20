# AI & transcription

## Phase status

- Phase 6: speech-to-text provider + transcript persistence + transcript UI
- Phase 7: Claude structured summaries (not yet)

## Pipeline

```text
Upload audio
  → status = uploaded
  → POST /sessions/:id/transcribe
  → status = transcribing
  → TranscriptionProvider.transcribe(...)
  → save transcripts row
  → status = transcribed
  → (Phase 7) Claude summary → completed
```

On failure, audio is retained and status becomes `failed` with a retry path.

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

## API

| Method | Path | Notes |
| --- | --- | --- |
| `POST` | `/sessions/:id/transcribe` | Starts async job; returns `202` + `status: transcribing` |
| `GET` | `/sessions/:id/transcript` | Full transcript text |
| `GET` | `/sessions/:id/status` | `{ status, hasAudio, hasTranscript }` for polling |

## Database

Table `transcripts` (one row per session) with RLS via owning `sessions.user_id`.

Migration: `supabase/migrations/202609200003_create_transcripts.sql`

## Claude summarization (Phase 7)

- Runs **only** on the API with `ANTHROPIC_API_KEY`.
- Returns structured JSON matching `SessionSummary` in `@sessionai/shared`.
- Validated with Zod before persistence.
- Prompts vary by `session_type`.

## Safety

- Never log full transcripts, audio bytes, or secrets in production (`LOG_SENSITIVE=false`).
- Never expose AI keys through `EXPO_PUBLIC_*` variables.
