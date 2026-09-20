# Audio recording & playback

Phase 4 adds on-device recording with `expo-audio` and local playback before cloud upload.

## Flow

```text
New Session
  → create session (API)
  → Recording screen
      → request microphone permission
      → prepare + record
      → pause / resume
      → stop
      → save local URI (AsyncStorage)
      → PATCH duration_seconds
  → Session Details
      → AudioPlayer (local URI)
```

Recording does **not** require internet. Upload to Supabase Storage is Phase 5.

## APIs used

| Concern | API |
| --- | --- |
| Permission | `requestRecordingPermissionsAsync()` |
| Recorder | `useAudioRecorder`, `useAudioRecorderState` |
| Mode | `setAudioModeAsync({ allowsRecording: true, … })` |
| Playback | `useAudioPlayer`, `useAudioPlayerStatus` |
| Local URI map | AsyncStorage key `sessionai:local-audio:<sessionId>` |

Recordings use `RecordingPresets.HIGH_QUALITY` with `directory: 'document'` so files are less likely to be purged than cache.

## UI pieces

- `RecordingTimer` — `HH:MM:SS`
- `RecordingButton` — large stop / start control
- `AudioPlayer` — play, pause, ±10s seek, progress, loading/error

## Navigation safety

While a recording is active or paused, leaving the screen prompts a confirmation dialog.

## Permissions

Configured in `apps/mobile/app.json`:

- iOS: `NSMicrophoneUsageDescription`
- Android: `RECORD_AUDIO`
- `expo-audio` config plugin

## Limitations (by design for Phase 4)

- No cloud upload yet (audio stays on device)
- No signed URL playback
- Web recording depends on browser microphone permission and MediaRecorder support
