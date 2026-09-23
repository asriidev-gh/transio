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
3. Enable **Anonymous sign-ins** in Supabase Auth (paywall → app without email). See [docs/auth.md](./auth.md).
4. Deploy the API behind HTTPS; set `CORS_ORIGINS` to your Expo web / site origins (empty deny browsers in production).
5. Point mobile `EXPO_PUBLIC_API_BASE_URL` at the public API URL.
6. Build the app with EAS or `expo export` / store builds; keep splash + icons from `apps/mobile/assets/images/`.
7. Verify `/health` returns `supabaseConfigured: true` and run a short record → process smoke test.

## Subscriptions

Free trial + Pro plan pricing are documented in **[docs/pricing.md](./pricing.md)**.  
Wire App Store / Play Billing (e.g. RevenueCat) before public launch — the current paywall unlock is local/dev only.

## Runtime

```bash
npm run api:build
npm run api:start
```

## Render (web service)

Monorepo from repo root (leave **Root Directory** empty):

| Field | Value |
| --- | --- |
| Build | `npm install && npm run build:shared && npm run api:build` |
| Start | `npm run api:start` |

Keep `NODE_ENV=production` in env vars. TypeScript and `@types/*` live in **dependencies** so production installs can still compile on the host.

Mobile production builds use Expo Application Services or local `eas build` with the production env vars above.
