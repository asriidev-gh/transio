# SessionAI

AI-powered seminar and group discussion recorder. Record audio, transcribe speech, and generate structured summaries — with a mobile-first Expo client and a Node.js API.

> **Phase status:** Phase 5 (Cloud Audio Storage) is complete. Transcription and AI summary are intentionally not implemented yet.

## Architecture

```text
apps/
  mobile/     Expo (React Native) + Expo Router client
  api/        Node.js + Express + TypeScript REST API
packages/
  shared/     Shared Zod schemas and TypeScript types
supabase/
  migrations/ SQL migrations (Phase 3+)
docs/         Architecture and setup docs
```

```text
Mobile  →  API  →  (Speech-to-text → Claude → PostgreSQL)   [later phases]
         ↘ Supabase Auth / Storage / Postgres               [Phase 2+]
```

Secrets (service role, Anthropic, transcription) live **only** on the API. The mobile app uses the Supabase anon key and public API URL.

## Prerequisites

- Node.js 20+
- npm 10+
- Expo Go (optional, for device testing) or a simulator/emulator
- A Supabase project (required for sign-in / registration)

## Installation

```bash
git clone <repo-url>
cd sessionai   # or your local path, e.g. C:\Code\Claude\projects\sessionai
npm install
cp .env.example apps/api/.env
cp apps/mobile/.env.example apps/mobile/.env
# Edit both .env files with your values
```

Build shared types (required before API typecheck in some setups):

```bash
npm run build --workspace=@sessionai/shared
```

## Environment variables

See [`.env.example`](./.env.example) for the full list.

| Variable | Where | Notes |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Mobile | Public |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Mobile | Public anon key only |
| `EXPO_PUBLIC_API_BASE_URL` | Mobile | Default `http://127.0.0.1:3847` |
| `SUPABASE_URL` | API | Same project URL |
| `SUPABASE_ANON_KEY` | API | Anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | API | **Server only** |
| `ANTHROPIC_API_KEY` | API | **Server only** (Phase 7) |
| `TRANSCRIPTION_API_KEY` | API | **Server only** (Phase 6) |
| `PORT` | API | Default `3847` |

Never set `EXPO_PUBLIC_` prefixes on service-role or AI keys.

## Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Enable **Email** auth (Authentication → Providers).
3. For local MVP testing, optionally disable **Confirm email** so sign-up returns a session immediately.
4. Copy Project URL and anon key into mobile + API env files.
5. Copy the service role key into **API only**.
6. Restart `npm run api` and `npm run mobile` after changing env files.

See [docs/auth.md](./docs/auth.md) for the auth flow. Database migrations start in Phase 3 (`supabase/migrations`).

## Database migrations

```bash
# Apply SQL migrations to your Supabase project:
npx supabase db push

# Or paste supabase/migrations/*.sql into the Supabase SQL editor.
```

Phase 3 migration: `202609200001_create_sessions.sql`  
Phase 5 migration: `202609200002_session_audio_bucket.sql` (private `session-audio` bucket + storage RLS)

## Running the API

```bash
npm run api
```

Health check:

```bash
curl http://127.0.0.1:3847/health
```

Expected shape:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "service": "sessionai-api",
    "version": "0.1.0",
    "timestamp": "...",
    "supabaseConfigured": false
  }
}
```

## Running the mobile app

```bash
npm run mobile
# or web preview:
npm run mobile:web
```

Expo starts on port **19047**. Open in Expo Go, a simulator, or the web bundler.

The home screen shows foundation status (API reachability + Supabase config).

## Testing

```bash
npm run typecheck
npm run lint
npm test
```

## AI provider configuration

Documented for later phases. Claude runs **only** on the API using `ANTHROPIC_API_KEY`. See [docs/ai.md](./docs/ai.md).

## Troubleshooting

| Issue | Fix |
| --- | --- |
| API health fails from phone | Use your LAN IP in `EXPO_PUBLIC_API_BASE_URL`, not `127.0.0.1` |
| `supabaseConfigured: false` | Set `SUPABASE_URL` + `SUPABASE_ANON_KEY` in `apps/api/.env` |
| Mobile “Supabase not configured” | Set `EXPO_PUBLIC_SUPABASE_*` in `apps/mobile/.env` and restart Expo |
| Sign-in disabled / config warning on login | Same as above — auth requires a real Supabase project |
| Stuck after register | Confirm email in inbox, or disable Confirm email in Supabase Auth settings |
| `GET /me` returns 401 | Send `Authorization: Bearer <access_token>` from a signed-in session |
| Workspace type errors | Run `npm install` at repo root, then `npm run build --workspace=@sessionai/shared` |

## Documentation

- [Architecture](./docs/architecture.md)
- [Authentication](./docs/auth.md)
- [Database](./docs/database.md)
- [API](./docs/api.md)
- [Audio](./docs/audio.md)
- [AI](./docs/ai.md)

## Phase roadmap

1. Foundation
2. Authentication
3. Database & sessions
4. Audio recording
5. **Cloud audio storage** ← current
6. Speech-to-text
7. Claude AI summary
8. End-to-end processing
9. Reliability & UX
10. MVP polish
