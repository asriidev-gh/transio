# API

Base URL (local): `http://127.0.0.1:3847`

All responses use a consistent envelope:

```json
{ "success": true, "data": {} }
```

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "…" }
}
```

## Implemented endpoints

### `GET /health`

Unauthenticated liveness + config probe.

**Response `data`:**

| Field | Type | Description |
| --- | --- | --- |
| `status` | `"ok"` | Always ok when the process is healthy |
| `service` | `"sessionai-api"` | Service name |
| `version` | string | API version |
| `timestamp` | ISO string | Server time |
| `supabaseConfigured` | boolean | `SUPABASE_URL` + `SUPABASE_ANON_KEY` present |

### `GET /me`

Requires `Authorization: Bearer <supabase_access_token>`.

Returns the authenticated user `{ id, email }` derived from the JWT (never from a client-supplied id).

| Status | Code | When |
| --- | --- | --- |
| 200 | — | Valid token |
| 401 | `UNAUTHORIZED` | Missing/invalid token |
| 503 | `SERVICE_UNAVAILABLE` | Supabase not configured on API |

### Sessions (`/sessions`)

All session routes require a valid Bearer token. Ownership is enforced via RLS + `user_id` filters.

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/sessions` | List current user's sessions (newest first) |
| `POST` | `/sessions` | Create session (`title`, `sessionType`, optional `description`) |
| `GET` | `/sessions/:id` | Get one session (404 if missing or not owned) |
| `PATCH` | `/sessions/:id` | Update fields (title, type, description, status, …) |
| `DELETE` | `/sessions/:id` | Delete session |

Create body example:

```json
{
  "title": "GLC Session 3",
  "sessionType": "group_discussion",
  "description": "Weekly discussion"
}
```

New sessions start with `status: "recording"`.

### Audio upload & signed URLs

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/sessions/:id/audio` | Multipart upload (`file` field), sets `audio_path` + `status=uploaded` |
| `GET` | `/sessions/:id/audio-url` | Returns a private signed URL (`expiresIn` seconds) |

Upload response:

```json
{
  "success": true,
  "data": {
    "sessionId": "…",
    "audioPath": "userId/sessionId/audio.m4a",
    "status": "uploaded"
  }
}
```

### Transcription, summary & processing

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/sessions/:id/transcribe` | Start async transcription job (`202`) |
| `GET` | `/sessions/:id/transcript` | Fetch saved transcript |
| `POST` | `/sessions/:id/summarize` | Start async Claude summary job (`202`) |
| `GET` | `/sessions/:id/summary` | Fetch structured AI summary |
| `POST` | `/sessions/:id/process` | Start end-to-end pipeline (`202`) |
| `GET` | `/sessions/:id/status` | Poll `{ status, hasAudio, hasTranscript, hasSummary }` |

Requires uploaded audio for processing. Summarization-only requires a saved transcript.
Successful uploads best-effort auto-start `/process` when STT + Claude keys are configured.
On failure, session status becomes `failed` and audio/transcript are retained.

## Planned endpoints (later phases)

Phase 9 adds provider retries for transient STT/Claude failures and clearer
rate-limit / network error messages. No new pipeline endpoints.
Session CRUD, audio, transcription, summarization, and end-to-end processing are
implemented (Phases 3–8).

Authenticated endpoints require a Supabase JWT (`Authorization: Bearer …`) and verify ownership server-side.

## Running

```bash
npm run api
```

## Testing

```bash
npm run test --workspace=@sessionai/api
```
