# Architecture

## Overview

SessionAI is a monorepo with three primary packages:

| Package | Role |
| --- | --- |
| `@sessionai/mobile` | Expo / React Native client (Expo Router) |
| `@sessionai/api` | Express REST API (TypeScript) |
| `@sessionai/shared` | Shared Zod schemas and types |

## Request flow (target MVP)

```text
Mobile app
  → Authenticated REST calls
  → SessionAI API
      → Supabase Auth (verify JWT)
      → Supabase Storage (private session-audio bucket)
      → TranscriptionProvider.transcribe(...)
      → Claude (structured JSON summary)
      → PostgreSQL (sessions, transcripts, summaries)
```

Phase 1 implements only the outer shell: mobile launch, API launch, health check, env + Supabase client wiring, theme, and navigation placeholders.

## Design principles

1. Secrets stay on the server.
2. Providers (transcription, AI) are behind interfaces so implementations can be swapped.
3. Processing is job-oriented (upload → transcribe → summarize), not one long HTTP request.
4. RLS enforces per-user isolation in Postgres/Storage; the client never bypasses RLS.
5. Shared types/schemas live in `@sessionai/shared` to keep mobile and API aligned.

## Mobile structure

```text
apps/mobile/
  app/                 Expo Router screens
    (auth)/            Login / register (stubs in Phase 1)
    (app)/             Authenticated shell (unprotected until Phase 2)
  src/
    components/        Reusable UI
    lib/               Env, Supabase client
    services/          API client
    theme/             Colors, typography
    utils/             Pure helpers
```

## API structure

```text
apps/api/
  src/
    index.ts           Server entry
    app.ts             Express app factory
    routes/            HTTP routes
    middleware/        Errors (auth arrives Phase 2)
    lib/               Env, logger, Supabase
    providers/         (Phase 6+) transcription / AI
    prompts/           (Phase 7+) session-type prompts
```

## Extensibility (not built yet)

Speaker ID, Q&A, search, chapters, Bible references, knowledge base, and exports should plug into sessions/transcripts without rewriting the core recording pipeline.
