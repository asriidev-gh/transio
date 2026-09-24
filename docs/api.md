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

New sessions start with `status: "recording"`. Optional `folderId` files the session into a user folder.

### Folders (`/folders`)

One-level folders (not nested). Deleting a folder sets `sessions.folder_id` to null (recordings stay in Unfiled).

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/folders` | List current user's folders (name A–Z) |
| `POST` | `/folders` | Create folder `{ name }` (1–80 chars) |
| `GET` | `/folders/:id` | Get one folder |
| `PATCH` | `/folders/:id` | Rename `{ name }` |
| `DELETE` | `/folders/:id` | Delete folder (sessions become unfiled) |

`PATCH /sessions/:id` accepts `folderId` (uuid or `null`) to move a session.

### Audio upload & signed URLs

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/sessions/:id/audio` | Multipart upload (`file` field, audio or video), sets `audio_path` + `status=uploaded` |
| `POST` | `/sessions/:id/import-url` | Fetch a **direct** media file URL (`{ url }`), then same as upload |
| `GET` | `/sessions/:id/audio-url` | Returns a private signed URL (`expiresIn` seconds) |

`import-url` refuses YouTube/Vimeo/page hosts and private IPs. Use a CDN/object-storage link to an `.mp4` / `.webm` / `.mp3`, or upload a file.

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
| `PUT` | `/sessions/:id/transcript` | Upsert transcript text/segments (live captions) |
| `POST` | `/sessions/:id/summarize` | Start async Claude summary job (`202`) |
| `GET` | `/sessions/:id/summary` | Fetch structured AI summary |
| `POST` | `/sessions/:id/process` | Start end-to-end pipeline (`202`) |
| `GET` | `/sessions/:id/status` | Poll `{ status, hasAudio, hasTranscript, hasSummary }` |
| `POST` | `/sessions/:id/ask` | Q&A over transcript/summary |
| `POST` | `/sessions/:id/translate` | On-demand summary/transcript translation |
| `POST` | `/sessions/:id/translate-live` | Translate a short live-caption chunk `{ text, language }` |
| `POST` | `/translate/voice` | Voice translate: multipart audio → STT → translate `{ sourceText, translatedText, … }` |
| `POST` | `/sessions/:id/notes-live` | Merge live speech into notes `{ text, previousNotes? }` |
| `POST` | `/sessions/:id/notes/finalize` | Persist notes + `completed` (Record Notes / Live Note Taker) |
| `GET` | `/sessions/:id/feedback` | Thumbs feedback for summary/transcript |
| `PUT` | `/sessions/:id/feedback` | Set or clear thumbs (`target`, `rating`) |

Sessions include `captureMode`: `live` | `batch` | `notes` | `live_notes` (default `batch`).
Notes-only modes never persist a transcript row. `live_notes` skips auto-process after
upload when notes were already finalized. Migration: `202609210003_session_capture_mode.sql`.

### Live captions WebSocket

`ws(s)://<api-host>/live/transcribe?language=<code>`

On open, the client must send `{ "type": "auth", "token": "<supabase_access_token>" }`
as the first text frame (do **not** put the JWT in the query string — it leaks into
proxy/access logs). `Authorization: Bearer` on the upgrade request is also accepted
when the runtime can set WebSocket headers.

After auth, clients send binary linear16 PCM @ 16 kHz mono. The API proxies to
Deepgram Listen using server-only `DEEPGRAM_API_KEY` and forwards normalized JSON
events (`ready`, `transcript`, `error`, `closed`). Never put the Deepgram key in
`EXPO_PUBLIC_*`.

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
