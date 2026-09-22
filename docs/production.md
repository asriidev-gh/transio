# Production configuration

SessionAI MVP can run in production with the same monorepo layout. Keep secrets on the API only.

## Required environment

### API (`apps/api/.env`)

| Variable | Notes |
| --- | --- |
| `NODE_ENV` | Set to `production` |
| `PORT` | HTTPS reverse-proxy target (default `3847`) |
| `SUPABASE_URL` | Project URL (`https://….supabase.co`), not the Postgres URI |
| `SUPABASE_ANON_KEY` | Used only if needed for user-scoped clients |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only; storage download / privileged ops |
| `ANTHROPIC_API_KEY` | Claude summaries |
| `ANTHROPIC_MODEL` | Optional; default `claude-sonnet-4-5` |
| `TRANSCRIPTION_API_KEY` | Whisper-compatible STT |
| `TRANSCRIPTION_BASE_URL` | Optional; default OpenAI |
| `LOG_SENSITIVE` | Keep `false` in production |
| `CORS_ORIGINS` | Comma-separated browser origins (required for Expo web in production) |
| `DEEPGRAM_API_KEY` | Live captions WS proxy (optional) |

### Mobile (`apps/mobile/.env` / EAS secrets)

| Variable | Notes |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Same project URL as API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anon key only |
| `EXPO_PUBLIC_API_BASE_URL` | Public HTTPS origin of the API (no trailing slash) |

Never put `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, or `TRANSCRIPTION_API_KEY` in mobile env or client bundles.

## Checklist

1. Apply all SQL migrations under `supabase/migrations/` (sessions, storage, transcripts, summaries).
2. Confirm `session-audio` bucket exists and is **private**.
3. Deploy the API behind HTTPS; set `CORS_ORIGINS` to your Expo web / site origins (empty deny browsers in production).
4. Point mobile `EXPO_PUBLIC_API_BASE_URL` at the public API URL.
5. Build the app with EAS or `expo export` / store builds; keep splash + icons from `apps/mobile/assets/images/`.
6. Verify `/health` returns `supabaseConfigured: true` and run a short record → process smoke test.

## Runtime

```bash
npm run api:build
npm run api:start
```

Mobile production builds use Expo Application Services or local `eas build` with the production env vars above.
