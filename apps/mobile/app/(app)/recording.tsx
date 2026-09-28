import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import {
  AudioQuality,
  RecordingPresets,
  requestNotificationPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { RecordingButton } from '@/src/components/RecordingButton';
import { RecordingTimer } from '@/src/components/RecordingTimer';
import { GlossOrb } from '@/src/components/ui/GlossOrb';
import { Icon } from '@/src/components/ui/Icon';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingState } from '@/src/components/LoadingState';
import { WaveformVisualizer } from '@/src/components/WaveformVisualizer';
import { ApiClientError } from '@/src/services/api';
import {
  createLiveCaptionController,
  isLiveCaptionsSupported,
  LIVE_CAPTION_LANGUAGES,
  saveLiveTranscript,
  type LiveCaptionController,
  type LiveCaptionLanguage,
  type LiveCaptionSnapshot,
} from '@/src/services/live-captions';
import {
  getLiveTranslateTargetPref,
  isSameLiveLanguage,
  LIVE_TRANSLATE_TARGET_OPTIONS,
  liveTranslateTargetLabel,
  setLiveTranslateTargetPref,
  translateLiveChunk,
} from '@/src/services/live-translate';
import {
  getRecordCaptionsModePref,
  isLiveCaptionsModeAvailable,
  modeNeedsLiveStt,
  parseRecordCaptionsMode,
  type RecordCaptionsMode,
} from '@/src/services/record-mode';
import { finalizeSessionNotes } from '@/src/services/live-notes';
import { writeNotesDraft } from '@/src/services/notes-draft';
import { saveLocalAudioUri } from '@/src/services/local-audio';
import { getSession, updateSession, createSession } from '@/src/services/sessions';
import { PaperNotesView } from '@/src/components/PaperNotesView';
import { radii, sizes, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { confirmAction } from '@/src/utils/confirm';
import {
  buildCaptionTurns,
  hasMultipleSpeakers,
} from '@/src/utils/live-caption-lines';
import { bulletsFromCaptionFinals, rawNotesFromFinals, type SessionType, type TranslateLanguage } from '@sessionai/shared';
import { consumeFeature } from '@/src/services/entitlements';
import { ensureDefaultFolder } from '@/src/services/default-folder';
import { getAudioStoragePreference } from '@/src/services/audio-storage-preference';
import { rememberCustomSessionType } from '@/src/services/custom-session-types';

const KEEP_AWAKE_TAG = 'smart-transcriber-recording';

type PermissionState = 'checking' | 'granted' | 'denied' | 'unavailable';

// Speech, not music: mono at 64 kbps halves the file against the stock preset's
// 128 kbps stereo, with no loss that matters to a listener or to Whisper and
// Deepgram, which resample to 16 kHz anyway. Keeps AAC/.m4a — the LOW_QUALITY
// preset switches Android to narrowband AMR in a .3gp the audio bucket rejects.
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  numberOfChannels: 1,
  bitRate: 64_000,
  ios: {
    ...RecordingPresets.HIGH_QUALITY.ios,
    audioQuality: AudioQuality.MEDIUM,
  },
  web: {
    ...RecordingPresets.HIGH_QUALITY.web,
    bitsPerSecond: 64_000,
  },
  directory: 'document' as const,
};

const EMPTY_CAPTIONS: LiveCaptionSnapshot = {
  status: 'idle',
  finals: [],
  finalSpeakers: [],
  interim: '',
  error: null,
  language: 'multi',
};

export default function RecordingScreen() {
  const {
    id: routeId,
    captions: captionsParam,
    draftTitle,
    sessionType: sessionTypeParam,
    description: descriptionParam,
    folderId: folderIdParam,
    customType: customTypeParam,
  } = useLocalSearchParams<{
    id?: string;
    captions?: string;
    draftTitle?: string;
    sessionType?: string;
    description?: string;
    folderId?: string;
    customType?: string;
  }>();
  const initialId = typeof routeId === 'string' ? routeId : null;
  const [sessionId, setSessionId] = useState<string | null>(initialId);
  const sessionIdRef = useRef<string | null>(initialId);
  const openingSessionRef = useRef<Promise<{ id: string; title: string }> | null>(null);
  const router = useRouter();
  const navigation = useNavigation();

  const recorder = useAudioRecorder(RECORDING_OPTIONS, (status) => {
    if (status.hasError) {
      setRecordError(status.error || 'Recording failed unexpectedly.');
    }
  });
  const recorderState = useAudioRecorderState(recorder, 250);

  const [title, setTitle] = useState('Session');
  const [permission, setPermission] = useState<PermissionState>('checking');
  const [bootError, setBootError] = useState<string | null>(null);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [captionsMode, setCaptionsMode] = useState<RecordCaptionsMode | null>(
    parseRecordCaptionsMode(captionsParam),
  );
  const [captions, setCaptions] = useState<LiveCaptionSnapshot>(EMPTY_CAPTIONS);
  const [captionLanguage, setCaptionLanguage] = useState<LiveCaptionLanguage>('multi');
  const [translateTarget, setTranslateTarget] = useState<TranslateLanguage | null>(null);
  /** Translation per sentence index; null when that sentence failed to translate. */
  const [translations, setTranslations] = useState<Record<number, string | null>>({});
  const [translateInFlight, setTranslateInFlight] = useState(0);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const activeRef = useRef(false);
  const liveRef = useRef<LiveCaptionController | null>(null);
  const captionLanguageRef = useRef<LiveCaptionLanguage>('multi');
  const translateTargetRef = useRef<TranslateLanguage | null>(null);
  /** Last language picked, so turning translate back on restores it. */
  const lastTranslateTargetRef = useRef<TranslateLanguage | null>(null);
  const requestedSentencesRef = useRef(new Set<number>());
  /** Sentences before this index are not translated (limits backfill after a switch). */
  const translateFromRef = useRef(0);
  const translateGenRef = useRef(0);
  const captionScrollRef = useRef<ScrollView>(null);
  const captionStickToEndRef = useRef(true);
  const captionsModeRef = useRef<RecordCaptionsMode | null>(
    parseRecordCaptionsMode(captionsParam),
  );
  /** Keep latest live finals so stop can finalize even if React state is stale. */
  const captionsFinalsRef = useRef<string[]>([]);
  const captionsInterimRef = useRef('');

  useEffect(() => {
    captionsFinalsRef.current = captions.finals;
    captionsInterimRef.current = captions.interim;
  }, [captions.finals, captions.interim]);

  const captionTurns = useMemo(
    () => buildCaptionTurns(captions.finals, captions.finalSpeakers),
    [captions.finals, captions.finalSpeakers],
  );
  const showSpeakers = useMemo(
    () => hasMultipleSpeakers(captions.finalSpeakers),
    [captions.finalSpeakers],
  );
  const sentenceCountRef = useRef(0);
  sentenceCountRef.current = captionTurns.reduce((n, t) => n + t.sentences.length, 0);

  const { colors, shadows } = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  const captionMaxHeight = Math.max(260, Math.round(windowHeight * 0.5));
  const elapsedSeconds = Math.max(0, Math.floor((recorderState.durationMillis ?? 0) / 1000));
  const isRecording = recorderState.isRecording;
  const blockingNavigation = (isRecording || isPaused) && !stopping;
  const liveEnabled =
    captionsMode === 'live' && isLiveCaptionsSupported() && isLiveCaptionsModeAvailable();
  const liveNotesEnabled =
    captionsMode === 'live_notes' &&
    isLiveCaptionsSupported() &&
    isLiveCaptionsModeAvailable();
  const liveSttEnabled = liveEnabled || liveNotesEnabled;

  const ensurePermission = useCallback(async (): Promise<boolean> => {
    try {
      const result = await requestRecordingPermissionsAsync();
      if (!result.granted) {
        setPermission('denied');
        return false;
      }
      setPermission('granted');
      return true;
    } catch {
      setPermission('unavailable');
      return false;
    }
  }, []);

  const startLiveCaptions = useCallback(async (opts?: { capture?: boolean }) => {
    const mode = captionsModeRef.current;
    if (!mode || !modeNeedsLiveStt(mode)) return;
    if (!isLiveCaptionsSupported() || !isLiveCaptionsModeAvailable()) return;
    if (!liveRef.current) {
      const live = createLiveCaptionController();
      if (!live) return;
      liveRef.current = live;
      live.subscribe(setCaptions);
    }
    try {
      const language =
        captionsModeRef.current === 'live_notes' ? 'multi' : captionLanguageRef.current;
      await liveRef.current.start({
        language,
        capture: opts?.capture,
      });
    } catch {
      // Snapshot already has error; recording file path continues.
    }
  }, []);

  const startRecording = useCallback(async () => {
    setStarting(true);
    setRecordError(null);
    try {
      let allowBackground = false;
      if (Platform.OS === 'android') {
        try {
          const notif = await requestNotificationPermissionsAsync();
          allowBackground = notif.granted;
        } catch {
          allowBackground = false;
        }
      }

      const applyAudioMode = async (background: boolean) => {
        await setAudioModeAsync({
          playsInSilentMode: true,
          allowsRecording: true,
          interruptionMode: 'doNotMix',
          shouldRouteThroughEarpiece: false,
          ...(background
            ? { allowsBackgroundRecording: true }
            : {}),
        });
      };

      await applyAudioMode(allowBackground);
      try {
        await recorder.prepareToRecordAsync();
      } catch (prepareErr) {
        const msg =
          prepareErr instanceof Error ? prepareErr.message.toLowerCase() : '';
        // Android 13+: background recording requires POST_NOTIFICATIONS.
        if (allowBackground || msg.includes('post_notifications') || msg.includes('background')) {
          await applyAudioMode(false);
          await recorder.prepareToRecordAsync();
        } else {
          throw prepareErr;
        }
      }

      recorder.record();
      startedRef.current = true;
      setHasStarted(true);
      activeRef.current = true;
      setIsPaused(false);
      if (captionsModeRef.current && modeNeedsLiveStt(captionsModeRef.current)) {
        const alreadyLive = liveRef.current?.getSnapshot().status === 'live';
        if (alreadyLive) {
          // Let the file recorder take the mic, then start captions so they stay up.
          const delay = Platform.OS === 'web' ? 0 : 300;
          setTimeout(() => {
            void liveRef.current?.beginCapture();
          }, delay);
        } else {
          // Native: brief delay so expo-audio can own the session before PCM streaming starts.
          const delay = Platform.OS === 'web' ? 0 : 300;
          if (delay === 0) {
            void startLiveCaptions();
          } else {
            setTimeout(() => {
              void startLiveCaptions();
            }, delay);
          }
        }
      }
    } catch (err) {
      const detail =
        err instanceof Error && err.message.trim()
          ? err.message.trim()
          : 'Check microphone access and try again.';
      const friendly =
        /post_notifications|notification/i.test(detail)
          ? 'Allow notifications if you want recording with the screen locked, or try again to record in the foreground.'
          : detail;
      setRecordError(`We could not start recording. ${friendly}`);
      activeRef.current = false;
      startedRef.current = false;
    } finally {
      setStarting(false);
    }
  }, [recorder, startLiveCaptions]);

  useEffect(() => {
    let cancelled = false;
    // Each recording starts on Auto with translation off; the last translate
    // language is only remembered for when the toggle is turned on.
    void getLiveTranslateTargetPref().then((target) => {
      if (cancelled || !target) return;
      lastTranslateTargetRef.current = target;
    });
    return () => {
      cancelled = true;
    };
  }, []);

  /** Drop translations after the spoken or target language changes. */
  const resetTranslations = useCallback(() => {
    translateGenRef.current += 1;
    requestedSentencesRef.current = new Set();
    // Re-translate only the last few sentences, not the whole session so far.
    translateFromRef.current = Math.max(0, sentenceCountRef.current - 6);
    setTranslations({});
    setTranslateInFlight(0);
    setTranslateError(null);
  }, []);

  const chooseTranslateTarget = useCallback(
    (target: TranslateLanguage | null) => {
      translateTargetRef.current = target;
      if (target) {
        lastTranslateTargetRef.current = target;
        void setLiveTranslateTargetPref(target);
      }
      setTranslateTarget(target);
      resetTranslations();
    },
    [resetTranslations],
  );

  const toggleTranslate = useCallback(() => {
    if (translateTargetRef.current) {
      chooseTranslateTarget(null);
      return;
    }
    const source = captionLanguageRef.current;
    const remembered = lastTranslateTargetRef.current;
    const fallback = LIVE_TRANSLATE_TARGET_OPTIONS.find(
      (opt) => opt.code != null && !isSameLiveLanguage(source, opt.code),
    )?.code;
    const next =
      remembered && !isSameLiveLanguage(source, remembered) ? remembered : (fallback ?? null);
    chooseTranslateTarget(next);
  }, [chooseTranslateTarget]);

  // Translate each sentence once it is complete, keyed by its index so it lines up
  // under the spoken sentence. Requests run side by side to keep up with speech.
  useEffect(() => {
    if (!liveEnabled || !sessionId) return;
    const target = translateTargetRef.current;
    if (!target) return;
    const source = captionLanguageRef.current;
    if (isSameLiveLanguage(source, target)) return;

    const gen = translateGenRef.current;
    for (const turn of captionTurns) {
      for (const sentence of turn.sentences) {
        if (!sentence.complete) continue;
        if (sentence.index < translateFromRef.current) continue;
        if (requestedSentencesRef.current.has(sentence.index)) continue;
        requestedSentencesRef.current.add(sentence.index);

        setTranslateInFlight((n) => n + 1);
        void translateLiveChunk(sessionId, sentence.text, target, source)
          .then((result) => {
            if (gen !== translateGenRef.current) return;
            setTranslations((prev) => ({ ...prev, [sentence.index]: result.text }));
            setTranslateError(null);
          })
          .catch((err: unknown) => {
            if (gen !== translateGenRef.current) return;
            setTranslations((prev) => ({ ...prev, [sentence.index]: null }));
            setTranslateError(
              err instanceof ApiClientError && err.status === 429
                ? err.message
                : 'Some lines could not be translated — captions continue.',
            );
          })
          .finally(() => {
            if (gen !== translateGenRef.current) return;
            setTranslateInFlight((n) => Math.max(0, n - 1));
          });
      }
    }
  }, [captionTurns, liveEnabled, sessionId, translateTarget, captionLanguage]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const one = (value: string | string[] | undefined) =>
        Array.isArray(value) ? value[0] : value;

      let mode = parseRecordCaptionsMode(one(captionsParam)) ?? captionsModeRef.current;
      if (!mode) {
        mode = await getRecordCaptionsModePref();
      }
      if (mode === 'live' && !isLiveCaptionsModeAvailable()) {
        mode = 'batch';
      }
      if (mode === 'live_notes' && !isLiveCaptionsModeAvailable()) {
        mode = 'notes';
      }
      if (!cancelled) {
        captionsModeRef.current = mode;
        setCaptionsMode(mode);
      }

      const permissionPromise = ensurePermission();

      try {
        let activeId = sessionIdRef.current;
        if (!activeId) {
          if (!openingSessionRef.current) {
            const titleDraft = one(draftTitle)?.trim() ?? '';
            const rawType = one(sessionTypeParam);
            const sessionType: SessionType =
              rawType === 'seminar' ||
              rawType === 'group_discussion' ||
              rawType === 'bible_study' ||
              rawType === 'meeting' ||
              rawType === 'lecture' ||
              rawType === 'other'
                ? rawType
                : 'group_discussion';
            const customLabel = one(customTypeParam)?.trim() ?? '';
            const requestedFolder = one(folderIdParam)?.trim() ?? '';
            const description = one(descriptionParam)?.trim() || null;
            const captureMode = mode ?? 'batch';
            openingSessionRef.current = (async () => {
              if (!titleDraft) throw new Error('Missing session id.');
              if (sessionType === 'other' && customLabel) {
                await rememberCustomSessionType(customLabel);
              }
              const folderId = requestedFolder || (await ensureDefaultFolder()).id;
              const created = await createSession({
                title: titleDraft,
                sessionType,
                description,
                folderId,
                captureMode,
                audioStorage: await getAudioStoragePreference(),
              });
              await consumeFeature('session');
              return { id: created.id, title: created.title };
            })();
          }
          const created = await openingSessionRef.current;
          activeId = created.id;
          sessionIdRef.current = activeId;
          if (!cancelled) {
            setSessionId(activeId);
            setTitle(created.title);
          }
        } else {
          const session = await getSession(activeId);
          if (!cancelled) setTitle(session.title);
        }
      } catch (err) {
        if (!cancelled) {
          setBootError(
            err instanceof ApiClientError
              ? err.message
              : 'Could not open this session for recording.',
          );
        }
        return;
      }

      const granted = await permissionPromise;
      if (cancelled || !granted) return;

      if (!startedRef.current) {
        // Connect live captions first. The audio file starts only when the user taps record.
        if (mode && modeNeedsLiveStt(mode)) {
          await startLiveCaptions({ capture: false });
          return;
        }
        await startRecording();
        return;
      }

      // Effect re-ran (e.g. Strict Mode / callback identity) after the file recorder
      // already started — restart live STT if cleanup tore it down.
      if (
        captionsModeRef.current &&
        modeNeedsLiveStt(captionsModeRef.current) &&
        !liveRef.current
      ) {
        void startLiveCaptions();
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [captionsParam, draftTitle, sessionTypeParam, descriptionParam, folderIdParam, customTypeParam, ensurePermission, startRecording, startLiveCaptions]);

  // Keep trying the caption service until it is up. Recording stays off until then.
  useEffect(() => {
    if (!liveSttEnabled || hasStarted) return;
    if (captions.status !== 'error') return;
    const message = captions.error ?? '';
    if (/sign in|not available|development or EAS|Expo Go/i.test(message)) return;
    const timer = setTimeout(() => {
      void startLiveCaptions({ capture: false });
    }, 3000);
    return () => clearTimeout(timer);
  }, [liveSttEnabled, hasStarted, captions.status, captions.error, startLiveCaptions]);

  // Stop live STT only when leaving the recording screen — not when boot deps churn.
  useEffect(() => {
    return () => {
      void liveRef.current?.stop().catch(() => undefined);
      liveRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      // Keep recording across background transitions; do not auto-stop.
      if (next === 'active' && activeRef.current && recordError) {
        // Surface existing error when returning; no-op otherwise.
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [recordError]);

  // Keep the screen on for the whole recording, paused included, so the screen
  // timeout never locks the phone and cuts live captions or the recording.
  const keepScreenOn = isRecording || isPaused;
  useEffect(() => {
    if (!keepScreenOn) return;
    void activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      try {
        deactivateKeepAwake(KEEP_AWAKE_TAG);
      } catch {
        // The tag may already be gone; nothing to release.
      }
    };
  }, [keepScreenOn]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!blockingNavigation) {
        return;
      }
      event.preventDefault();
      void (async () => {
        const ok = await confirmAction(
          'Stop recording?',
          'You have an active recording. Stop and save it before leaving.',
          'Discard and leave',
          { cancelLabel: 'Keep recording', destructive: true },
        );
        if (!ok) return;
        activeRef.current = false;
        void liveRef.current?.stop().catch(() => undefined);
        navigation.dispatch(event.data.action);
      })();
    });
    return unsubscribe;
  }, [navigation, blockingNavigation]);

  async function onPauseResume() {
    setRecordError(null);
    try {
      if (isRecording) {
        recorder.pause();
        liveRef.current?.pause();
        setIsPaused(true);
        return;
      }
      recorder.record();
      liveRef.current?.resume();
      setIsPaused(false);
      activeRef.current = true;
    } catch {
      setRecordError('Could not pause or resume recording.');
    }
  }

  async function onStop() {
    const id = sessionIdRef.current;
    if (!id) return;
    setStopping(true);
    setRecordError(null);
    try {
      // Snapshot notes before tearing down the live stream.
      const pendingFinals = [...captionsFinalsRef.current];
      const pendingInterim = captionsInterimRef.current.trim();

      let liveResult: Awaited<ReturnType<LiveCaptionController['stop']>> | null = null;
      try {
        if (liveSttEnabled && liveRef.current) {
          liveResult = await liveRef.current.stop();
        }
      } catch {
        liveResult = null;
      }

      const elapsedAtStop = Math.max(
        elapsedSeconds,
        Math.floor((recorder.getStatus().durationMillis ?? 0) / 1000),
      );

      await recorder.stop();
      activeRef.current = false;
      setIsPaused(false);

      const uri = recorder.uri;
      if (!uri) {
        throw new Error('Recording URI missing');
      }

      // After stop(), some platforms report durationMillis=0 — don't trust that alone.
      const stoppedMillis = recorder.getStatus().durationMillis ?? 0;
      const durationSeconds = Math.max(
        1,
        Math.floor(
          (stoppedMillis > 0 ? stoppedMillis : elapsedAtStop * 1000) / 1000,
        ),
      );

      // Save locally only — user chooses Proceed or Re-record on the session screen.
      try {
        await saveLocalAudioUri(id, uri);
      } catch {
        // Best-effort; session screen can still use an in-memory/nav flow.
      }

      try {
        await updateSession(id, { durationSeconds });
      } catch {
        // Non-fatal.
      }

      if (liveNotesEnabled) {
        try {
          const snap = liveRef.current?.getSnapshot();
          const fromSnap = snap?.finals?.filter((c) => c.trim()) ?? [];
          const fromLive = liveResult?.text?.trim() ? [liveResult.text.trim()] : [];
          const fromPending = pendingFinals.filter((c) => c.trim());
          const finals =
            fromSnap.length > 0
              ? fromSnap
              : fromPending.length > 0
                ? fromPending
                : fromLive.length > 0
                  ? fromLive
                  : captions.finals.filter((c) => c.trim());
          const interim =
            snap?.interim?.trim() || pendingInterim || captions.interim.trim() || '';
          const chunks = interim ? [...finals, interim] : finals;
          if (chunks.some((c) => c.trim())) {
            const notes = rawNotesFromFinals(chunks);
            await finalizeSessionNotes(id, notes);
            await writeNotesDraft(id, notes);
          }
        } catch (err) {
          setNotesError(
            err instanceof ApiClientError
              ? err.message
              : 'Could not save notes — audio is still saved.',
          );
        }
      } else if (liveResult?.text) {
        try {
          await saveLiveTranscript(
            id,
            liveResult.text,
            liveResult.segments,
            liveResult.language,
          );
        } catch {
          // Non-fatal — batch Whisper still runs after upload if needed.
        }
      }

      router.replace(`/session/${id}`);
    } catch (err) {
      setRecordError(
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'We saved the recording attempt, but finishing failed. Try stopping again.',
      );
    } finally {
      setStopping(false);
    }
  }

  if (bootError) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ErrorState
          title="Cannot record"
          description={bootError}
          onRetry={() => router.replace('/')}
          actionLabel="Go home"
        />
      </View>
    );
  }

  if (!sessionId) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <LoadingState
          message={
            permission === 'checking' ? 'Checking microphone…' : 'Opening your session…'
          }
        />
      </View>
    );
  }

  if (permission === 'checking' || starting) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <LoadingState
          message={
            permission === 'checking' ? 'Checking microphone…' : 'Preparing to record…'
          }
        />
      </View>
    );
  }

  const translateOn = translateTarget != null;
  const translateSameLanguage =
    translateTarget != null && isSameLiveLanguage(captionLanguage, translateTarget);
  const translateTargetLabel = translateTarget ? liveTranslateTargetLabel(translateTarget) : '';
  const interimText = captions.interim.trim();
  const lastSentenceOpen =
    captionTurns[captionTurns.length - 1]?.sentences.at(-1)?.complete === false;

  const waitingForStage =
    permission === 'granted' &&
    liveSttEnabled &&
    !hasStarted &&
    captions.status !== 'live';
  const stageBlocked =
    waitingForStage &&
    /sign in|not available|development or EAS|Expo Go/i.test(captions.error ?? '');

  if (stageBlocked) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ErrorState
          title="Live captions aren’t available"
          description={captions.error ?? 'Could not start live captions.'}
          onRetry={() => router.back()}
          actionLabel="Go back"
        />
      </View>
    );
  }

  if (waitingForStage) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <LoadingState
          message="We are setting up the stage for you"
          detail="Hang on for a second…"
        />
      </View>
    );
  }

  if (permission === 'denied' || permission === 'unavailable') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ErrorState
          title="Microphone permission needed"
          description={
            permission === 'denied'
              ? 'Smart Transcriber needs microphone access to record seminars and discussions. Enable it in system settings, then try again.'
              : 'Microphone access is unavailable in this environment.'
          }
          onRetry={() =>
            void ensurePermission().then((ok) => {
              if (!ok) return;
              if (
                captionsModeRef.current &&
                modeNeedsLiveStt(captionsModeRef.current)
              ) {
                void startLiveCaptions({ capture: false });
                return;
              }
              void startRecording();
            })
          }
        />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.kicker, { color: colors.inkMuted }]}>Recording</Text>
      <Text style={[styles.title, { color: colors.ink }]} accessibilityRole="header">
        {title}
      </Text>

      <RecordingTimer seconds={elapsedSeconds} />

      <WaveformVisualizer active={isRecording && !stopping} />

      <View style={styles.statusRow}>
        <View
          style={[
            styles.dot,
            {
              backgroundColor: isRecording
                ? colors.recording
                : isPaused
                  ? colors.warning
                  : colors.border,
            },
          ]}
        />
        <Text style={[styles.statusText, { color: colors.ink }]}>
          {stopping
            ? liveNotesEnabled
              ? 'Saving notes…'
              : 'Saving…'
            : isRecording
              ? liveNotesEnabled && captions.status === 'live'
                ? 'Listening · Live Note Taker'
                : liveEnabled && captions.status === 'live'
                  ? 'Listening · live captions'
                  : captionsMode === 'notes'
                    ? 'Listening · notes after stop'
                    : 'Listening'
              : isPaused
                ? 'Paused'
                : 'Ready'}
        </Text>
      </View>

      {liveNotesEnabled ? (
        <View style={styles.liveNotesWrap} accessibilityLiveRegion="polite">
          <Text style={[styles.captionLabel, { color: colors.inkMuted }]}>Notes</Text>
          {notesError ? (
            <Text style={[styles.captionText, { color: colors.danger }]}>{notesError}</Text>
          ) : null}
          <PaperNotesView
            bullets={bulletsFromCaptionFinals(captions.finals)}
            interim={captions.interim}
            emptyLabel={
              captions.status === 'connecting'
                ? 'Connecting…'
                : captions.error
                  ? captions.error
                  : captions.status === 'error'
                    ? 'Mic text unavailable — recording continues.'
                    : hasStarted
                      ? 'Speak to write notes…'
                      : 'Tap record, then speak to write notes…'
            }
            compact
          />
        </View>
      ) : null}

      {liveEnabled ? (
        <View
          style={[
            styles.captionCard,
            {
              backgroundColor: colors.surface,
              borderColor: translateOn ? colors.cyan : colors.border,
            },
          ]}
        >
          <View style={styles.paneHeader}>
            <View style={[styles.paneDot, { backgroundColor: colors.accent }]} />
            <Text style={[styles.captionLabel, { color: colors.inkMuted }]}>Spoken</Text>
            {translateInFlight > 0 ? (
              <Text style={[styles.translateBusy, { color: colors.inkMuted }]}>Translating…</Text>
            ) : null}
            <Pressable
              onPress={toggleTranslate}
              hitSlop={6}
              style={({ pressed }) => [
                styles.translateToggle,
                {
                  backgroundColor: translateOn ? colors.cyan : colors.surface,
                  borderColor: translateOn ? colors.cyan : colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
              accessibilityRole="switch"
              accessibilityState={{ checked: translateOn }}
              accessibilityLabel="Live translate"
              accessibilityHint="Shows a translation under each sentence"
            >
              <Icon
                name="translate"
                size={16}
                variant="line"
                color={translateOn ? '#FFFFFF' : colors.inkMuted}
              />
              <Text
                style={[
                  styles.translateToggleText,
                  { color: translateOn ? '#FFFFFF' : colors.inkMuted },
                ]}
              >
                Translation: {translateOn ? 'On' : 'Off'}
              </Text>
            </Pressable>
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.langScroll}
            contentContainerStyle={styles.langRow}
          >
            {LIVE_CAPTION_LANGUAGES.map((opt) => {
              const selected = captionLanguage === opt.code;
              return (
                <Pressable
                  key={opt.code}
                  onPress={() => {
                    captionLanguageRef.current = opt.code;
                    setCaptionLanguage(opt.code);
                    resetTranslations();
                    void liveRef.current?.setLanguage(opt.code);
                  }}
                  style={[
                    styles.langChip,
                    {
                      borderColor: selected ? colors.accent : colors.border,
                      backgroundColor: colors.surface,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`Caption language ${opt.label}`}
                >
                  <Text
                    style={[
                      styles.langChipText,
                      { color: selected ? colors.accent : colors.inkMuted },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          {captionLanguage === 'multi' ? (
            <Text style={[styles.autoHint, { color: colors.inkMuted }]}>
              Auto works for English, Spanish, French, German, Hindi, Russian, Portuguese,
              Japanese, Italian, and Dutch. Use Tagalog or Chinese chips for those languages.
            </Text>
          ) : null}

          {translateOn ? (
            <View style={[styles.translateBar, { borderTopColor: colors.border }]}>
              <Text style={[styles.translateBarLabel, { color: colors.cyan }]}>Translate to</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.langScroll}
                contentContainerStyle={styles.langRow}
              >
                {LIVE_TRANSLATE_TARGET_OPTIONS.map((opt) => {
                  if (opt.code == null) return null;
                  const code = opt.code;
                  const selected = translateTarget === code;
                  const disabled = isSameLiveLanguage(captionLanguage, code);
                  return (
                    <Pressable
                      key={code}
                      disabled={disabled}
                      onPress={() => chooseTranslateTarget(code)}
                      style={[
                        styles.langChip,
                        {
                          borderColor: selected ? colors.cyan : colors.border,
                          backgroundColor: colors.surface,
                          opacity: disabled ? 0.4 : 1,
                        },
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected, disabled }}
                      accessibilityLabel={`Translate to ${opt.label}`}
                    >
                      <Text
                        style={[
                          styles.langChipText,
                          { color: selected ? colors.cyan : colors.inkMuted },
                        ]}
                      >
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {translateSameLanguage ? (
                <Text style={[styles.autoHint, { color: colors.inkMuted }]}>
                  Pick a language different from the spoken one.
                </Text>
              ) : translateError ? (
                <Text style={[styles.autoHint, { color: colors.inkMuted }]}>{translateError}</Text>
              ) : null}
            </View>
          ) : null}

          <ScrollView
            ref={captionScrollRef}
            nestedScrollEnabled
            style={[styles.captionScroll, { maxHeight: captionMaxHeight }]}
            contentContainerStyle={styles.captionScrollContent}
            scrollEventThrottle={64}
            onScroll={(e) => {
              const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
              // Follow new captions unless the listener scrolled up to reread.
              captionStickToEndRef.current =
                contentOffset.y + layoutMeasurement.height >= contentSize.height - 48;
            }}
            onContentSizeChange={() => {
              if (captionStickToEndRef.current) {
                captionScrollRef.current?.scrollToEnd({ animated: true });
              }
            }}
            accessibilityLiveRegion="polite"
          >
            {captionTurns.length > 0 || interimText ? (
              <>
                {captionTurns.map((turn, t) => {
                  const lastTurn = t === captionTurns.length - 1;
                  return (
                    <View key={`turn-${turn.sentences[0]?.index ?? t}`} style={styles.turn}>
                      {showSpeakers && turn.speaker != null ? (
                        <Text style={[styles.speakerLabel, { color: colors.accent }]}>
                          Speaker
                        </Text>
                      ) : null}
                      {turn.sentences.map((sentence, s) => {
                        const isTail = lastTurn && s === turn.sentences.length - 1;
                        const translated = translations[sentence.index];
                        const showTranslation =
                          translateOn &&
                          !translateSameLanguage &&
                          sentence.complete &&
                          sentence.index >= translateFromRef.current &&
                          translated !== null;
                        return (
                          <View key={sentence.index} style={styles.sentence}>
                            <View style={styles.sentenceRow}>
                              <View
                                style={[styles.sentenceDot, { backgroundColor: colors.inkMuted }]}
                              />
                              <Text style={[styles.captionText, { color: colors.ink }]}>
                                {sentence.text}
                                {isTail && !sentence.complete && interimText ? (
                                  <Text style={{ color: colors.inkMuted }}> {interimText}</Text>
                                ) : null}
                              </Text>
                            </View>
                            {showTranslation ? (
                              <View style={[styles.translation, { borderLeftColor: colors.cyan }]}>
                                <Text style={[styles.translationLabel, { color: colors.cyan }]}>
                                  {translateTargetLabel}
                                </Text>
                                <Text
                                  style={[
                                    styles.translateText,
                                    { color: translated ? colors.ink : colors.inkMuted },
                                  ]}
                                >
                                  {translated ?? 'Translating…'}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
                {interimText && !lastSentenceOpen ? (
                  <View style={styles.sentenceRow}>
                    <View style={[styles.sentenceDot, { backgroundColor: colors.border }]} />
                    <Text style={[styles.captionText, { color: colors.inkMuted }]}>
                      {interimText}
                    </Text>
                  </View>
                ) : null}
              </>
            ) : (
              <Text style={[styles.captionText, { color: colors.inkMuted }]}>
                {captions.status === 'connecting'
                  ? 'Connecting…'
                  : captions.error
                    ? captions.error
                    : captions.status === 'error'
                      ? 'Captions unavailable — recording continues.'
                      : hasStarted
                        ? 'Speak to see captions…'
                        : 'Tap record, then speak to see captions…'}
              </Text>
            )}
          </ScrollView>
        </View>
      ) : captionsMode === 'live' && !liveEnabled ? (
        <Text style={[styles.hint, { color: colors.inkMuted }]}>
          Live captions need a development or EAS build (not Expo Go). Recording continues without
          captions.
        </Text>
      ) : captionsMode === 'live_notes' && !liveNotesEnabled ? (
        <Text style={[styles.hint, { color: colors.inkMuted }]}>
          Live Note Taker needs a development or EAS build (not Expo Go). Use Record Audio and
          Transcribe or Transcribe Audio/Video File instead, or recording continues without live
          notes.
        </Text>
      ) : captionsMode === 'notes' ? (
        <Text style={[styles.hint, { color: colors.inkMuted }]}>
          File notes: we will write notes after you upload — no transcript is saved.
        </Text>
      ) : null}

      {recordError ? (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {recordError}
        </Text>
      ) : null}

      <View style={styles.controls}>
        {isRecording || isPaused ? (
          <>
            <Pressable
              onPress={() => void onPauseResume()}
              disabled={stopping}
              style={[
                styles.secondaryButton,
                { borderColor: colors.border, backgroundColor: colors.surface },
                stopping && styles.disabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={isPaused ? 'Resume' : 'Pause'}
            >
              <Text style={[styles.secondaryText, { color: colors.ink }]}>
                {isPaused ? 'Resume' : 'Pause'}
              </Text>
            </Pressable>
            <RecordingButton
              recording
              paused={isPaused}
              disabled={stopping}
              onPress={() => {
                if (isPaused) {
                  void onPauseResume();
                  return;
                }
                // A stray tap (say, while unlocking with a fingerprint) must not end the recording.
                void confirmAction(
                  'Stop recording?',
                  'We will save what you have recorded so far.',
                  'Stop and save',
                  { cancelLabel: 'Keep recording' },
                ).then((ok) => {
                  if (ok) void onStop();
                });
              }}
            />
          </>
        ) : (
          <Pressable
            onPress={() => void startRecording()}
            disabled={stopping}
            accessibilityRole="button"
            accessibilityLabel="Tap to record"
            style={({ pressed }) => [
              styles.startMic,
              pressed && !stopping && styles.startMicPressed,
              stopping && styles.disabled,
            ]}
          >
            <GlossOrb size={sizes.record} halo>
              <Icon name="microphone" size={26} color="#FFFFFF" variant="line" />
            </GlossOrb>
            <Text style={[styles.startMicLabel, { color: colors.inkMuted }]}>Tap to record</Text>
          </Pressable>
        )}
      </View>

      <Pressable
        onPress={() => router.back()}
        disabled={stopping}
        accessibilityRole="button"
        accessibilityLabel="Cancel"
        style={({ pressed }) => [
          styles.cancel,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: stopping ? 0.45 : pressed ? 0.92 : 1,
          },
          shadows.soft,
        ]}
      >
        <Text style={[styles.cancelText, { color: colors.ink }]}>Cancel</Text>
      </Pressable>

      <Text style={[styles.hint, { color: colors.inkMuted }]}>
        {liveNotesEnabled
          ? 'Each spoken phrase becomes a bullet. When you stop, we save those notes and keep the audio — no transcript.'
          : liveEnabled
            ? 'Captions appear as you speak. When you stop, we save audio plus any finals, then you can proceed to summarize.'
            : captionsMode === 'notes'
              ? 'Recording audio only. After upload we turn speech into sentence notes without saving a transcript.'
              : 'Recording audio only. When you stop, review locally, then proceed to upload and transcribe.'}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  centered: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  kicker: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  title: {
    ...typography.title,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...typography.body,
    fontWeight: '600',
  },
  liveNotesWrap: {
    width: '100%',
    maxWidth: 960,
    gap: spacing.sm,
  },
  captionCard: {
    width: '100%',
    maxWidth: 960,
    minHeight: 140,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  translateToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: spacing.sm + 2,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  translateToggleText: {
    fontSize: 12,
    fontWeight: '700',
  },
  translateBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    gap: 6,
  },
  translateBarLabel: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  captionScroll: {
    alignSelf: 'stretch',
    flexGrow: 0,
  },
  captionScrollContent: {
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  turn: {
    gap: spacing.sm,
  },
  speakerLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  sentence: {
    gap: 6,
  },
  sentenceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  sentenceDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 9,
  },
  translation: {
    marginLeft: 13,
    borderLeftWidth: 2,
    paddingLeft: spacing.sm,
    gap: 2,
  },
  translationLabel: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  paneHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  paneDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  captionLabel: {
    ...typography.caption,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontWeight: '700',
    flex: 1,
  },
  translateBusy: {
    ...typography.caption,
    fontSize: 11,
  },
  translateText: {
    ...typography.body,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '500',
  },
  langScroll: {
    alignSelf: 'stretch',
    width: '100%',
    flexGrow: 0,
  },
  langRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 2,
    paddingRight: spacing.sm,
  },
  langChip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    minHeight: 30,
    marginRight: spacing.sm,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
    flexGrow: 0,
  },
  langChipText: {
    fontSize: 12,
    fontWeight: '600',
  },
  autoHint: {
    ...typography.caption,
    fontSize: 11,
    lineHeight: 15,
  },
  captionText: {
    ...typography.body,
    fontSize: 16,
    lineHeight: 23,
    flexShrink: 1,
  },
  error: {
    textAlign: 'center',
    ...typography.body,
    fontSize: 14,
    paddingHorizontal: spacing.md,
  },
  controls: {
    marginTop: spacing.lg,
    alignItems: 'center',
    gap: spacing.lg,
  },
  startMic: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  startMicPressed: {
    opacity: 0.88,
  },
  startMicLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    minWidth: 140,
    minHeight: 44,
    alignItems: 'center',
  },
  secondaryText: {
    fontWeight: '600',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.45,
  },
  cancel: {
    alignSelf: 'stretch',
    maxWidth: 420,
    minHeight: sizes.button,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.md,
    maxWidth: 320,
  },
});
