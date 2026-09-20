# AI & transcription

## Phase status

Not implemented in Phase 1. This document describes the intended design so later phases stay consistent.

## Pipeline

```text
Upload audio
  → status = uploaded
  → TranscriptionProvider.transcribe(...)
  → status = transcribed / save transcripts row
  → Claude structured summary (session-type prompt)
  → Zod-validate SessionSummary
  → status = completed / save summaries row
```

On failure, audio is retained and status becomes `failed` with a retry path.

## Transcription provider

```ts
interface TranscriptionProvider {
  transcribe(input: TranscriptionInput): Promise<TranscriptionResult>;
}
```

The concrete provider is configurable via env (`TRANSCRIPTION_API_KEY` and related settings). The rest of the API depends only on the interface.

## Claude summarization

- Runs **only** on the API with `ANTHROPIC_API_KEY`.
- Returns structured JSON matching `SessionSummary` in `@sessionai/shared`.
- Validated with Zod before persistence.
- Prompts vary by `session_type` (seminar, group discussion, Bible study, etc.).
- Bible Study prompts must not invent theology beyond the transcript.

## Safety

- Never log full transcripts, audio bytes, or secrets in production (`LOG_SENSITIVE=false`).
- Never expose AI keys through `EXPO_PUBLIC_*` variables.
