# Product context — Smart Transcriber

Snapshot of what has been developed so far. Prefer this + `CLAUDE.md` over outdated Phase labels in older docs when they conflict. Package names remain `@sessionai/*`.

**Last oriented:** Sep 2026 (Harbor Studio polish, Live Note Taker, Voice translate, local Pro entitlements, EAS preview).

---

## Positioning

Smart Transcriber turns spoken audio into **searchable notes**, with optional **AI Summaries**, **session translate**, and **Voice translate** (hold-to-talk, device speaks back). Target uses: seminars, group discussions, lectures, meetings.

Not a generic “unlimited AI chat” product — usage is intentionally capped (free lifetime, Pro daily fair-use) until Store billing is real.

---

## Architecture (one paragraph)

Expo mobile app talks to a Node/Express API with the user’s Supabase JWT. The API owns Whisper-compatible STT, Claude summaries/ask/notes merge, Deepgram live proxy, translate, and Supabase service-role access to Postgres + private `session-audio` storage. Shared Zod types live in `packages/shared`.

```text
Phone (Expo)
  → REST + WS  →  API (Render / local :3847)
                    → Supabase Auth / Storage / Postgres
                    → Anthropic / Whisper / Deepgram
```

---

## Capture & processing matrix

| User chooses | `captureMode` | While recording | After stop | Persisted |
| --- | --- | --- | --- | --- |
| Record, then transcribe | `batch` | Audio only | Upload → process | Audio + transcript + optional summary |
| Live captions | `live` | Streaming captions (TL/EN) | Upload; Whisper skipped if transcript exists | Audio + transcript + optional summary |
| Live Note Taker | `live_notes` | Paper bullets grow | Finalize notes + upload audio | Audio + notes (summary shape); **no transcript** |
| Auto Notes | `notes` | Quiet / “notes after stop” | Ephemeral STT → notes | Audio + notes; **no transcript** |
| Transcribe file / URL | (batch-like import) | N/A | Fetch/extract → process | Same as batch |
| Live Translator | (no session file) | Hold-to-talk UI | — | Conversation on device; gated separately |

Live captions + Live Note Taker need a **development or EAS build** (`expo-audio-stream-pcm`). Expo Go: use batch / file import.

---

## Mobile surfaces

| Area | Notes |
| --- | --- |
| Home | Brand lockup, record/upload/library tiles, recent sessions, folders, “Ready to review” banner |
| New session | Title, type, capture mode, start |
| Recording | Waveform / live panes depending on mode |
| Session detail | Status, meta (type · date · **time** · duration), toolbar, player, workspace |
| Workspace | Notes pad (editable), Summary, Transcript, Ask, Map |
| Translate tab | Entry to Voice translate |
| Favorites / History | Library |
| Settings | Theme, notifications, Pro, help, legal, account; Connection `__DEV__` only |
| Paywall | Plans + perk list; local Pro unlock stub |
| Onboarding | Short slides → paywall |

---

## Backend capabilities (high level)

- Sessions CRUD, favorites, folders, feedback
- Audio upload + signed playback URLs
- `POST …/process` pipeline + status polling
- Transcripts (segments, speakers), summaries, Ask-over-session
- Translate (full content + live chunk)
- Notes-live merge + notes finalize (notes-only modes)
- Live transcribe WebSocket → Deepgram

See `docs/api.md` for method/path detail.

---

## Monetization (current)

Documented in `docs/pricing.md`.

- Free: **2** sessions, **2** summaries, **2** Voice translate chats (lifetime / device)
- Pro: **5 / day** each; Voice same-conversation turns free
- Plans: $4.99 / wk, $12.99 / mo, $79.99 / yr
- **IAP not shipped** — paywall unlocks Pro in AsyncStorage for testing

---

## Design system pointers

- Theme tokens: `apps/mobile/src/theme`
- Soft shadows on cards/tool buttons; avoid flat “clipped” swipe hosts that kill elevation
- Chrome icons = Lucide; don’t drop 3D star/trash into circular toolbars
- Brand logos + app icon under `apps/mobile/assets/images/`
- Typography: Fraunces + Plus Jakarta (marketing/UI), not default system Inter stack on branded surfaces

---

## Known gaps / next likely work

1. **RevenueCat / Play + App Store IAP** replace local `unlockPremium`
2. Production submit checklist (`docs/production.md`)
3. Keep README/architecture phase text in sync with Smart Transcriber naming
4. Any native-module changes require a **new APK**, not OTA alone

---

## How to continue work quickly

1. Skim `CLAUDE.md`
2. For pricing/gates → `docs/pricing.md` + `entitlements.ts`
3. For a UI bug on session detail → `session/[id]/index.tsx` + `SessionWorkspace.tsx` + `PaperNotesView.tsx`
4. For live STT → `apps/api/src/live/deepgram-proxy.ts` + mobile `live-captions` service
5. Ship JS polish to testers via `apps/mobile` → `npm run update:preview`
