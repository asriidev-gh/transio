# Audio recording, upload & playback

## Phase status

- Phase 4: on-device recording + local playback
- Phase 5: private cloud upload + signed URL playback
- Phase 9: playback load errors + retry; upload recovery unchanged

## Flow

```text
Stop recording
  → save local URI
  → Session Details
      → upload multipart to POST /sessions/:id/audio (with progress)
      → status = uploaded, audio_path set
      → GET /sessions/:id/audio-url → signed URL
      → AudioPlayer uses signed URL (falls back to local URI)
```

If upload fails, the local recording is kept and the user can tap **Try Again**.

## Storage

| Item | Value |
| --- | --- |
| Bucket | `session-audio` (private) |
| Path | `{user_id}/{session_id}/audio.{ext}` |
| Access | RLS on `storage.objects`; no public URLs |
| Playback | Signed URLs (1 hour TTL) |

Migration: `supabase/migrations/202609200002_session_audio_bucket.sql`

## API

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/sessions/:id/audio` | Multipart field `file` |
| `GET` | `/sessions/:id/audio-url` | Temporary signed playback URL |

Ownership is verified before upload or signing. Paths must start with the caller's `user_id`.

## Mobile pieces

- `uploadSessionAudio` — XHR upload with progress
- `UploadProgress` — progress / success / error + retry
- `AudioPlayer` — plays local URI or signed URL; surfaces load timeouts/errors with retry

## Setup checklist

1. Apply both SQL migrations (sessions + storage bucket).
2. Confirm bucket `session-audio` exists and is **not** public.
3. Ensure API + mobile Supabase env vars are set.
