# CLAUDE.md — Smart Transcriber (voice-to-insight)

Guidance for Claude Code / Claude when working in this repo. Read this first; deeper docs live under `docs/`.

## What this product is

**User-facing name:** Smart Transcriber  
**Repo / packages:** still `sessionai` / `@sessionai/*` (legacy monorepo name)  
**Tagline:** notes, summaries, and Voice translate  

Mobile-first app: record or import audio → notes / transcript → optional AI summary → organize, share, translate. API holds all secrets (Anthropic, Deepgram, Whisper, Supabase service role).

Support email: **andyr@consorttech.com**

## Monorepo layout

```text
apps/mobile/     Expo 57 + Expo Router (React Native) — port 19047
apps/api/        Express + TypeScript REST API — port 3847
packages/shared/ Zod schemas + shared types (@sessionai/shared)
supabase/        SQL migrations
docs/            Architecture, API, auth, pricing, Android, production
```

| Command | Purpose |
| --- | --- |
| `npm run api` | API dev server |
| `npm run mobile` | Expo client |
| `npm run typecheck` / `lint` / `test` | Workspace checks |
| `cd apps/mobile && npm run update:preview` | EAS Update OTA (preview channel) |
| `cd apps/mobile && npx eas-cli build -p android --profile preview` | Installable APK |

Build shared types after clean install: `npm run build --workspace=@sessionai/shared`.

## Product features (shipped)

### Capture modes (`sessions.capture_mode`)

| Mode | Label | Behavior |
| --- | --- | --- |
| `batch` | Record, then transcribe | Upload → Whisper → optional summary |
| `live` | Live captions | Stream PCM → Deepgram via API WS; needs **dev/EAS build** (not Expo Go) |
| `live_notes` | Live Note Taker | Growing paper-style bullets while speaking; audio kept; **no transcript row**; finalize on stop |
| `notes` | Auto Notes | Quiet record → ephemeral STT → notes only; **no transcript** |

Notes-only sessions hide Transcript / Ask tabs; workspace shows Notes (+ Translate / Save).

### Session workspace

- Tabs: Notes | Summary | Transcript | Ask | Map (subset for notes-only)
- Audio player: play, seek, speed, ±15s
- Favorites, share, folders, edit metadata, delete
- Paper notes pad: edit lines (pencil on pad), Cancel / Done → `notes/finalize`
- On-demand translate (notes / summary / transcript)
- Thumbs feedback on summary & transcript
- Meta line shows **date + clock time** via `formatSessionDateTime`

### Import

- File picker or direct file URL (YouTube/Vimeo page links are rejected on purpose)
- Android share sheet: share audio/video (or a link) from Files, Drive, Zoom or Meet into the app (`expo-share-intent`, needs a native build)
- Limits come from `GET /limits` (raw upload `MAX_UPLOAD_MB`, default 100; length about 50 min with Whisper, about 3.5 h with Deepgram); the app warns before uploading

### Voice translate

- Hold-to-talk conversation (`/voice-translate`); device TTS speaks translation (`expo-speech`)
- Separate from session-file translate
- Gated as feature `voiceTranslate`

### Auth & onboarding

- Supabase Auth (email + anonymous guest)
- Onboarding → paywall → guest or signed-in home
- Login screen handles sign-in and Create account (no separate register screen); onboarding → paywall → guest or signed-in home
- Legal: About, Privacy, Terms, Help / Contact (`apps/mobile/src/data/legal.ts`, `help-faq.ts`)

### Entitlements (local until Store billing)

Source: `apps/mobile/src/services/entitlements.ts`, `docs/pricing.md`

- **Free:** 2 lifetime each — sessions, AI Summaries, Voice translate chats → then paywall
- **Pro:** 5 / local calendar day each (alert, not paywall); same Voice chat doesn’t re-consume
- Plans: Weekly $4.99 · Monthly $12.99 · Yearly $79.99
- Paywall **Continue** currently **unlocks Pro locally** (RevenueCat / IAP not wired)

Paywall perk copy should stay aligned with real features (record/import/Live Note Taker, AI Summaries, Voice translate, translate finished notes).

## Mobile UX conventions

- Theme: Harbor Studio — cool fog + signal teal/blue; soft card shadows; circular toolbar buttons
- Icons: **Lucide line** for chrome/nav/toolbars (`Icon` `variant="line"` / `CHROME` set). 3D PNGs only for illustrative empty states / feature tiles — never for star/trash in toolbars (looks like a chunky badge)
- Brand assets: `apps/mobile/assets/images/` — launcher/splash from `icon.jpg` / `app-icon.png`; logos light/dark
- Header back + home: `SessionNavHeaderLeft` — large 44×44 hit targets
- Primary buttons: full height on `LinearGradient` fill (`Button.tsx`)
- Loading: centered brand animation (`BootLoading`, `LoadingState`)
- Settings: theme toggle with scheme-aware contrast; Notifications (real Android permission); Connection row **`__DEV__` only**

## API highlights

- Auth: Bearer Supabase JWT
- Sessions CRUD, audio upload, process pipeline, status polling
- Transcript / summary / ask / translate / notes-live / notes-finalize / feedback / folders
- `WS /live/transcribe?token=` — Deepgram proxy (`DEEPGRAM_API_KEY` server-only)
- Batch STT: `TRANSCRIPTION_PROVIDER=whisper` (default) or `deepgram` (speaker diarization, longer files)
- Background jobs run in-process via `lib/job-queue.ts`; a sweeper fails sessions stuck transcribing/summarizing (see docs/production.md)
- Per-user rate limits, upload gate and outbound timeouts protect a small Render instance
- Server-side usage quotas (`services/quota`, migration `202609250002_usage_quotas.sql`): free usage per device via `x-device-id`, Pro per account per UTC day, global spend kill switch. `QUOTA_MODE=log` until billing is live, then `on`
- Providers under `apps/api/src/providers/` (transcription, summary, translate, ask, speakers)

Secrets only in `apps/api/.env`. Mobile uses `EXPO_PUBLIC_*` only.

## Deploy / preview

- API: typically Render (see `docs/production.md`)
- Mobile: EAS project `sessionai` (account `asriidev`)
  - Channel **preview** for internal APKs + OTA
  - Runtime version follows the app `version` in `app.json` (currently `0.2.0`). Bump it whenever a native dependency is added, so an update never reaches a build that lacks the native code
  - JS-only changes → `npm run update:preview`
  - Native changes (icon, splash, `expo-audio-stream-pcm`, permissions) → new EAS build

EAS builds (latest first): https://expo.dev/accounts/asriidev/projects/sessionai/builds

## Working agreements

- Prefer editing existing files; match local patterns; don’t invent parallel abstractions
- Don’t commit unless asked; don’t force-push; don’t amend others’ commits
- Don’t invent Store billing — keep local unlock stub until RevenueCat is intentional work
- After user-facing mobile JS polish, publish **preview OTA** when they’ve been using preview builds
- Keep product names consistent: **Voice translate**, **Live Note Taker**, **AI Summary**, **Smart Transcriber**

## Key files

| Area | Path |
| --- | --- |
| Brand / tagline | `apps/mobile/src/data/brand.ts` |
| Pricing copy | `apps/mobile/src/data/pricing.ts` |
| Entitlements | `apps/mobile/src/services/entitlements.ts` |
| Feature gate helper | `apps/mobile/src/utils/feature-gate.ts` |
| Paywall | `apps/mobile/app/paywall.tsx` |
| Session detail | `apps/mobile/app/(app)/session/[id]/index.tsx` |
| Workspace / notes edit | `apps/mobile/src/components/SessionWorkspace.tsx`, `PaperNotesView.tsx` |
| Icons | `apps/mobile/src/components/ui/Icon.tsx` |
| Nav back/home | `apps/mobile/src/components/SessionNavHeaderLeft.tsx` |
| New session / modes | `apps/mobile/app/(app)/new-session.tsx` |
| Voice translate | `apps/mobile/app/(app)/voice-translate.tsx` |
| EAS | `apps/mobile/eas.json`, `apps/mobile/app.config.js` |

## Deeper docs

- [docs/product-context.md](./docs/product-context.md) — fuller snapshot of what’s built
- [docs/architecture.md](./docs/architecture.md)
- [docs/api.md](./docs/api.md)
- [docs/pricing.md](./docs/pricing.md)
- [docs/android.md](./docs/android.md)
- [docs/production.md](./docs/production.md)
