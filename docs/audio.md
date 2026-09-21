# Audio recording, upload & playback

## Phase status

- Phase 4: on-device recording + local playback
- Phase 5: private cloud upload + signed URL playback
- Phase 9: playback load errors + retry; upload recovery unchanged

## Flow

```text
Stop recording  OR  Import audio/video file  OR  Paste a direct media URL
  → save local URI (files) or fetch on the API (URLs)
  → Session Details / Processing
      → upload multipart to POST /sessions/:id/audio (files)
        OR POST /sessions/:id/import-url (direct https file links)
      → status = uploaded, audio_path set
      → GET /sessions/:id/audio-url → signed URL
      → AudioPlayer uses signed URL (falls back to local URI)
```

If upload fails, the local recording/import is kept and the user can tap **Try Again**.

Import supports common audio and video types (`mp3`, `m4a`, `wav`, `mp4`, `mov`, `webm`, `ogg`) via the browser file picker (web) or `expo-document-picker` (native).

Direct **file** URLs (for example `https://cdn.example.com/lecture.mp4`) are fetched by the API. YouTube, Vimeo, and similar **page** links are rejected — download those videos yourself, then upload the file. When `ffmpeg` is on the API host, video is converted to compact speech audio before Whisper.

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
| `POST` | `/sessions/:id/audio` | Multipart field `file` (audio or video) |
| `POST` | `/sessions/:id/import-url` | JSON `{ url }` — direct https media file |
| `GET` | `/sessions/:id/audio-url` | Temporary signed playback URL |

Ownership is verified before upload or signing. Paths must start with the caller's `user_id`.

## Mobile pieces

- `pickAudioFile` — import an existing audio or video file (web input / document picker)
- `importSessionMediaFromUrl` — ask the API to fetch a direct media URL
- `uploadSessionAudio` — XHR upload with progress
- `UploadProgress` — progress / success / error + retry
- `AudioPlayer` — plays local URI or signed URL; surfaces load timeouts/errors with retry

## Setup checklist

1. Apply both SQL migrations (sessions + storage bucket).
2. Confirm bucket `session-audio` exists and is **not** public.
3. Ensure API + mobile Supabase env vars are set.
