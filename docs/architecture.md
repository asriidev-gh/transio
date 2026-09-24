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

Phase 6 adds a replaceable `TranscriptionProvider`, async transcription jobs, `transcripts` table with RLS, transcript/status API endpoints, and a mobile transcript screen with polling + retry.

Phase 7 adds Claude structured summaries: `SummaryProvider`, session-type prompts, Zod-validated `SessionSummary`, `summaries` table with RLS, summarize/summary API endpoints, and a mobile summary screen with polling + retry.

Phase 8 connects the full pipeline (upload → transcribe → summarize → completed) via
`POST /sessions/:id/process`, auto-start after upload when providers are configured,
and a Processing screen that mirrors backend status.

Phase 9 hardens reliability and recovery UX: provider retries (429/502/503), clearer
API/network errors, connectivity banner, empty/error CTAs, failed-session styling,
client request retries, processing resume on app foreground, and audio playback load errors.

Phase 10 polishes the MVP: edit/delete sessions with confirmations, branded icon/splash,
SpaceMono typography, settings details, pull-to-refresh on session details, accessibility
labels, and production configuration docs.

Phase 11 introduces the Harbor Studio visual theme (cool fog + signal teal), recording
waveform, processing “safe to leave” UX, a tabbed session workspace (Summary | Transcript | Ask),
docked audio playback with speed/seek, `POST /sessions/:id/ask` for Q&A over a session,
and timed transcript segments with Claude context speaker labels (plus rename) and playback sync.

Processing completion adds an optional browser notification plus a home “Ready to review”
banner so users can leave during the pipeline and return to the finished session.
Audio import lets users attach an existing audio or video file, or paste a direct
media-file URL (not YouTube/Vimeo pages). On-demand Translate
covers summary and transcript via a language select (English, Filipino, Cebuano, Spanish,
Chinese, Japanese, Korean, and other common targets).

Web and native live captions stream mic PCM through an authenticated API WebSocket
(`/live/transcribe`) that proxies to Deepgram Listen (`DEEPGRAM_API_KEY` server-only).
Web uses AudioContext; iOS/Android use `expo-audio-stream-pcm` (requires a development or
EAS build — not Expo Go). Default language is Tagalog (`language=tl`); the recording UI
can switch to English. Finals are upserted with `PUT /sessions/:id/transcript`; batch
Whisper still runs after upload only when no transcript text exists yet.

First-launch onboarding (AsyncStorage-gated slider) introduces capture → process → review.
Home uses a calm greeting (“Ready to capture your thoughts?”), one-level folders plus an Unfiled remainder (search flattens across folders), list-level delete, and a floating pill tab bar (Home · Favorites · mic Record · Import · Settings).
Settings includes grouped Account / Appearance / Notifications. Light and dark palettes live in
design tokens; appearance defaults to the Transio dark slate canvas (mint accent). Soft claymorphism
shadows and pill radii shape buttons, tab bar, and search. Login/onboarding use the Transio logo.

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
    onboarding.tsx     First-launch slider (pre-auth)
    (auth)/            Login (Create account → onboarding → paywall)
    (app)/             Protected app shell
  src/
    components/        Reusable UI
    contexts/          AuthProvider
    hooks/             useAuth
    lib/               Env, Supabase client
    services/          API + auth + onboarding
    theme/             Colors, typography
    utils/             Pure helpers
```

## API structure

```text
apps/api/
  src/
    index.ts           Server entry
    app.ts             Express app factory
    routes/            HTTP routes (/health, /me, …)
    middleware/        Auth + errors
    lib/               Env, logger, Supabase
    providers/         (Phase 6+) transcription / AI
    prompts/           (Phase 7+) session-type prompts
```

## Extensibility (not built yet)

Speaker ID, Q&A, search, chapters, Bible references, knowledge base, and exports should plug into sessions/transcripts without rewriting the core recording pipeline.
