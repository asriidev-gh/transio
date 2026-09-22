import { useCallback, useEffect, useRef, useState } from 'react';
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
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { RecordingButton } from '@/src/components/RecordingButton';
import { RecordingTimer } from '@/src/components/RecordingTimer';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingState } from '@/src/components/LoadingState';
import { WaveformVisualizer } from '@/src/components/WaveformVisualizer';
import { ApiClientError } from '@/src/services/api';
import {
  createLiveCaptionController,
  getLiveCaptionLanguagePref,
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
import { finalizeSessionNotes, mergeLiveNotesChunk } from '@/src/services/live-notes';
import { saveLocalAudioUri } from '@/src/services/local-audio';
import { getSession, updateSession } from '@/src/services/sessions';
import { radii, sizes, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { confirmAction } from '@/src/utils/confirm';
import type { SessionSummary, TranslateLanguage } from '@sessionai/shared';

type PermissionState = 'checking' | 'granted' | 'denied' | 'unavailable';

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'document' as const,
};

const EMPTY_CAPTIONS: LiveCaptionSnapshot = {
  status: 'idle',
  finals: [],
  interim: '',
  error: null,
  language: 'tl',
};

export default function RecordingScreen() {
  const { id, captions: captionsParam } = useLocalSearchParams<{
    id: string;
    captions?: string;
  }>();
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
  const [stopping, setStopping] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [captionsMode, setCaptionsMode] = useState<RecordCaptionsMode | null>(
    parseRecordCaptionsMode(captionsParam),
  );
  const [captions, setCaptions] = useState<LiveCaptionSnapshot>(EMPTY_CAPTIONS);
  const [captionLanguage, setCaptionLanguage] = useState<LiveCaptionLanguage>('tl');
  const [translateTarget, setTranslateTarget] = useState<TranslateLanguage | null>(null);
  const [translatedFinals, setTranslatedFinals] = useState<string[]>([]);
  const [translateBusy, setTranslateBusy] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [notesError, setNotesError] = useState<string | null>(null);
  const startedRef = useRef(false);
  const activeRef = useRef(false);
  const liveRef = useRef<LiveCaptionController | null>(null);
  const captionLanguageRef = useRef<LiveCaptionLanguage>('tl');
  const translateTargetRef = useRef<TranslateLanguage | null>(null);
  const translatedCountRef = useRef(0);
  const translateQueueRef = useRef(Promise.resolve());
  const translateGenRef = useRef(0);
  const notesSentCountRef = useRef(0);
  const notesFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notesInFlightRef = useRef(false);
  const notesFinalsRef = useRef<string[]>([]);
  const notesGenRef = useRef(0);
  const liveNotesRef = useRef<SessionSummary | null>(null);
  const captionsModeRef = useRef<RecordCaptionsMode | null>(
    parseRecordCaptionsMode(captionsParam),
  );

  const { colors, shadows } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const sideBySideCaptions = windowWidth >= 720;
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

  const startLiveCaptions = useCallback(async () => {
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
      await liveRef.current.start({ language: captionLanguageRef.current });
    } catch {
      // Snapshot already has error; recording file path continues.
    }
  }, []);

  const startRecording = useCallback(async () => {
    setStarting(true);
    setRecordError(null);
    try {
      await setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: true,
        allowsBackgroundRecording: true,
        interruptionMode: 'doNotMix',
        shouldPlayInBackground: true,
        shouldRouteThroughEarpiece: false,
      });
      await recorder.prepareToRecordAsync();
      recorder.record();
      startedRef.current = true;
      activeRef.current = true;
      setIsPaused(false);
      if (captionsModeRef.current && modeNeedsLiveStt(captionsModeRef.current)) {
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
    } catch {
      setRecordError('We could not start recording. Check microphone access and try again.');
      activeRef.current = false;
    } finally {
      setStarting(false);
    }
  }, [recorder, startLiveCaptions]);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([getLiveCaptionLanguagePref(), getLiveTranslateTargetPref()]).then(
      ([lang, target]) => {
        if (cancelled) return;
        captionLanguageRef.current = lang;
        setCaptionLanguage(lang);
        translateTargetRef.current = target;
        setTranslateTarget(target);
      },
    );
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!liveEnabled || !id || typeof id !== 'string') return;
    const target = translateTargetRef.current;
    if (!target) return;
    if (isSameLiveLanguage(captionLanguageRef.current, target)) return;

    const source = captionLanguageRef.current;
    const sessionId = id;

    while (translatedCountRef.current < captions.finals.length) {
      const nextIndex = translatedCountRef.current;
      const chunk = captions.finals[nextIndex];
      translatedCountRef.current = nextIndex + 1;
      if (!chunk?.trim()) continue;

      const gen = translateGenRef.current;
      translateQueueRef.current = translateQueueRef.current
        .then(async () => {
          if (gen !== translateGenRef.current) return;
          setTranslateBusy(true);
          setTranslateError(null);
          try {
            const result = await translateLiveChunk(sessionId, chunk, target, source);
            if (gen !== translateGenRef.current) return;
            setTranslatedFinals((prev) => [...prev, result.text]);
          } catch (err) {
            if (gen !== translateGenRef.current) return;
            setTranslateError(
              err instanceof ApiClientError
                ? err.message
                : 'Live translation paused — captions continue.',
            );
          } finally {
            if (gen === translateGenRef.current) {
              setTranslateBusy(false);
            }
          }
        })
        .catch(() => undefined);
    }
  }, [captions.finals, liveEnabled, id, translateTarget]);

  const flushLiveNotesRef = useRef<(sessionId: string, gen: number) => Promise<void>>(
    async () => undefined,
  );
  const armLiveNotesFlushRef = useRef<(sessionId: string) => void>(() => undefined);
  const notesChainRef = useRef(Promise.resolve());

  const armLiveNotesFlush = useCallback((sessionId: string) => {
    if (notesFinalsRef.current.length <= notesSentCountRef.current) return;
    // Never reset a pending timer — continuous Deepgram finals were cancelling debounce forever.
    if (notesFlushTimerRef.current) return;

    const delayMs = liveNotesRef.current ? 900 : 250;
    const gen = notesGenRef.current;
    notesFlushTimerRef.current = setTimeout(() => {
      notesFlushTimerRef.current = null;
      void flushLiveNotesRef.current(sessionId, gen);
    }, delayMs);
  }, []);
  armLiveNotesFlushRef.current = armLiveNotesFlush;

  const flushLiveNotes = useCallback(async (sessionId: string, gen: number) => {
    const run = async () => {
      if (gen !== notesGenRef.current) return;
      const start = notesSentCountRef.current;
      const finals = notesFinalsRef.current;
      const end = finals.length;
      if (end <= start) return;
      const chunk = finals.slice(start, end).join(' ').trim();
      if (!chunk) {
        notesSentCountRef.current = end;
        return;
      }

      notesInFlightRef.current = true;
      setNotesError(null);
      try {
        const result = await mergeLiveNotesChunk(
          sessionId,
          chunk,
          liveNotesRef.current ?? undefined,
        );
        if (gen !== notesGenRef.current) return;
        notesSentCountRef.current = end;
        liveNotesRef.current = result;
      } catch (err) {
        if (gen !== notesGenRef.current) return;
        setNotesError(
          err instanceof ApiClientError
            ? err.message
            : 'Live notes paused — recording continues.',
        );
      } finally {
        notesInFlightRef.current = false;
        if (
          gen === notesGenRef.current &&
          notesFinalsRef.current.length > notesSentCountRef.current
        ) {
          armLiveNotesFlushRef.current(sessionId);
        }
      }
    };

    // Serialize merges so stop can await the full chain (no early-return while in-flight).
    const next = notesChainRef.current.then(run, run);
    notesChainRef.current = next.then(
      () => undefined,
      () => undefined,
    );
    await next;
  }, []);
  flushLiveNotesRef.current = flushLiveNotes;

  // Keep a live ref of finals (including when only interim text changes).
  useEffect(() => {
    notesFinalsRef.current = captions.finals;
  }, [captions.finals]);

  // When finalized phrase count grows, arm a one-shot flush (never reset while pending).
  useEffect(() => {
    if (!liveNotesEnabled || !id || typeof id !== 'string') return;
    if (captions.finals.length <= notesSentCountRef.current) return;
    armLiveNotesFlush(id);
  }, [captions.finals.length, liveNotesEnabled, id, armLiveNotesFlush]);

  // Clear flush timer only on unmount or when leaving live-notes mode.
  useEffect(() => {
    if (liveNotesEnabled) return;
    if (notesFlushTimerRef.current) {
      clearTimeout(notesFlushTimerRef.current);
      notesFlushTimerRef.current = null;
    }
  }, [liveNotesEnabled]);

  useEffect(() => {
    return () => {
      if (notesFlushTimerRef.current) {
        clearTimeout(notesFlushTimerRef.current);
        notesFlushTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!id || typeof id !== 'string') {
        setBootError('Missing session id.');
        return;
      }

      let mode = parseRecordCaptionsMode(captionsParam) ?? captionsModeRef.current;
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

      try {
        const session = await getSession(id);
        if (!cancelled) {
          setTitle(session.title);
        }
      } catch (err) {
        if (!cancelled) {
          setBootError(
            err instanceof ApiClientError
              ? err.message
              : 'Could not load this session for recording.',
          );
        }
        return;
      }

      const granted = await ensurePermission();
      if (cancelled || !granted) return;

      if (!startedRef.current) {
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
  }, [id, captionsParam, ensurePermission, startRecording, startLiveCaptions]);

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
    if (!id || typeof id !== 'string') return;
    setStopping(true);
    setRecordError(null);
    try {
      let liveResult: Awaited<ReturnType<LiveCaptionController['stop']>> | null = null;
      try {
        if (liveSttEnabled && liveRef.current) {
          liveResult = await liveRef.current.stop();
        }
      } catch {
        liveResult = null;
      }

      await recorder.stop();
      activeRef.current = false;
      setIsPaused(false);

      const uri = recorder.uri;
      if (!uri) {
        throw new Error('Recording URI missing');
      }

      const durationSeconds = Math.max(
        1,
        Math.floor((recorder.getStatus().durationMillis ?? elapsedSeconds * 1000) / 1000),
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
        // Merge any speech that hadn't flushed yet, then persist.
        try {
          if (notesFlushTimerRef.current) {
            clearTimeout(notesFlushTimerRef.current);
            notesFlushTimerRef.current = null;
          }
          // Prefer controller snapshot (includes trailing interim promoted on stop);
          // React `captions` state may not have flushed yet.
          const snap = liveRef.current?.getSnapshot();
          notesFinalsRef.current = snap?.finals?.length
            ? snap.finals
            : liveResult?.text
              ? [liveResult.text]
              : captions.finals;
          await flushLiveNotes(id, notesGenRef.current);
          // Drain any merge that was already in flight before this flush.
          await notesChainRef.current;
        } catch {
          // Best-effort final merge.
        }
        const notes = liveNotesRef.current;
        if (notes) {
          try {
            await finalizeSessionNotes(id, notes);
          } catch {
            // Non-fatal — user can still upload; notes may be incomplete.
          }
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
          onRetry={() => void ensurePermission().then((ok) => (ok ? startRecording() : undefined))}
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
                ? 'Listening · live notes'
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
        <View
          style={[
            styles.captionCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
          accessibilityLiveRegion="polite"
        >
          <Text style={[styles.captionLabel, { color: colors.inkMuted }]}>Hearing</Text>
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
                    notesGenRef.current += 1;
                    notesSentCountRef.current = 0;
                    liveNotesRef.current = null;
                    setNotesError(null);
                    captionLanguageRef.current = opt.code;
                    setCaptionLanguage(opt.code);
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
                  accessibilityLabel={`Spoken language ${opt.label}`}
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
          {notesError ? (
            <Text style={[styles.captionText, { color: colors.danger }]}>{notesError}</Text>
          ) : null}
          {captions.finals.length > 0 || Boolean(captions.interim.trim()) ? (
            <Text style={[styles.captionText, { color: colors.ink }]}>
              {captions.finals.join(' ')}
              {captions.interim.trim() ? (
                <Text style={{ color: colors.inkMuted }}>
                  {captions.finals.length > 0 ? ' ' : ''}
                  {captions.interim}
                </Text>
              ) : null}
            </Text>
          ) : (
            <Text style={[styles.captionText, { color: colors.inkMuted }]}>
              {captions.status === 'connecting'
                ? 'Connecting…'
                : captions.error
                  ? captions.error
                  : captions.status === 'error'
                    ? 'Mic text unavailable — recording continues.'
                    : 'Speak to see text…'}
            </Text>
          )}
        </View>
      ) : null}

      {liveEnabled ? (
        <View
          style={[
            styles.captionPanes,
            sideBySideCaptions ? styles.captionPanesRow : styles.captionPanesStack,
          ]}
        >
          <View
            style={[
              styles.captionCard,
              styles.spokenPane,
              sideBySideCaptions && styles.captionCardHalf,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            accessibilityLiveRegion="polite"
          >
            <View style={styles.paneHeader}>
              <View style={[styles.paneDot, { backgroundColor: colors.accent }]} />
              <Text style={[styles.captionLabel, { color: colors.inkMuted }]}>Spoken</Text>
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
                      translateGenRef.current += 1;
                      captionLanguageRef.current = opt.code;
                      setCaptionLanguage(opt.code);
                      translatedCountRef.current = 0;
                      setTranslatedFinals([]);
                      setTranslateError(null);
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
            {captions.finals.length > 0 || Boolean(captions.interim.trim()) ? (
              <Text style={[styles.captionText, { color: colors.ink }]}>
                {captions.finals.join(' ')}
                {captions.interim.trim() ? (
                  <Text style={{ color: colors.inkMuted }}>
                    {captions.finals.length > 0 ? ' ' : ''}
                    {captions.interim}
                  </Text>
                ) : null}
              </Text>
            ) : (
              <Text style={[styles.captionText, { color: colors.inkMuted }]}>
                {captions.status === 'connecting'
                  ? 'Connecting…'
                  : captions.error
                    ? captions.error
                    : captions.status === 'error'
                      ? 'Captions unavailable — recording continues.'
                      : 'Speak to see captions…'}
              </Text>
            )}
          </View>

          <View
            style={[
              styles.captionCard,
              styles.translatePane,
              sideBySideCaptions && styles.captionCardHalf,
              {
                backgroundColor: colors.actionImport,
                borderColor: colors.cyan,
              },
            ]}
            accessibilityLiveRegion="polite"
          >
            <View style={styles.paneHeader}>
              <View style={[styles.paneDot, { backgroundColor: colors.cyan }]} />
              <Text style={[styles.captionLabel, { color: colors.cyan }]}>Live translate</Text>
              {translateBusy ? (
                <Text style={[styles.translateBusy, { color: colors.inkMuted }]}>Updating…</Text>
              ) : null}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.langScroll}
              contentContainerStyle={styles.langRow}
            >
              {LIVE_TRANSLATE_TARGET_OPTIONS.map((opt) => {
                const selected = translateTarget === opt.code;
                const disabled =
                  opt.code != null && isSameLiveLanguage(captionLanguage, opt.code);
                return (
                  <Pressable
                    key={opt.label}
                    disabled={disabled}
                    onPress={() => {
                      translateGenRef.current += 1;
                      translateTargetRef.current = opt.code;
                      setTranslateTarget(opt.code);
                      void setLiveTranslateTargetPref(opt.code);
                      translatedCountRef.current = 0;
                      setTranslatedFinals([]);
                      setTranslateError(null);
                    }}
                    style={[
                      styles.langChip,
                      {
                        borderColor: selected ? colors.cyan : colors.border,
                        backgroundColor: selected ? colors.surface : colors.surface,
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
            {!translateTarget ? (
              <Text style={[styles.translateText, { color: colors.inkMuted }]}>
                Pick a language to mirror captions in real time.
              </Text>
            ) : isSameLiveLanguage(captionLanguage, translateTarget) ? (
              <Text style={[styles.translateText, { color: colors.inkMuted }]}>
                Choose a different language than the spoken captions.
              </Text>
            ) : translatedFinals.length ? (
              <Text style={[styles.translateText, { color: colors.ink }]}>
                {translatedFinals.join(' ')}
                {translateBusy ? (
                  <Text style={{ color: colors.inkMuted }}> …</Text>
                ) : null}
              </Text>
            ) : (
              <Text style={[styles.translateText, { color: colors.inkMuted }]}>
                {translateError
                  ? translateError
                  : translateBusy
                    ? 'Translating…'
                    : 'Translation appears as phrases finalize…'}
              </Text>
            )}
          </View>
        </View>
      ) : captionsMode === 'live' && !liveEnabled ? (
        <Text style={[styles.hint, { color: colors.inkMuted }]}>
          Live captions need a development or EAS build (not Expo Go). Recording continues without
          captions.
        </Text>
      ) : captionsMode === 'live_notes' && !liveNotesEnabled ? (
        <Text style={[styles.hint, { color: colors.inkMuted }]}>
          Live Note Taker needs a development or EAS build (not Expo Go). Use Auto Notes instead, or
          recording continues without live notes.
        </Text>
      ) : captionsMode === 'notes' ? (
        <Text style={[styles.hint, { color: colors.inkMuted }]}>
          Auto Notes: we will write structured notes after you upload — no transcript is saved.
        </Text>
      ) : null}

      {recordError ? (
        <Text style={[styles.error, { color: colors.danger }]} accessibilityRole="alert">
          {recordError}
        </Text>
      ) : null}

      <View style={styles.controls}>
        <Pressable
          onPress={() => void onPauseResume()}
          disabled={stopping || (!isRecording && !isPaused)}
          style={[
            styles.secondaryButton,
            { borderColor: colors.border, backgroundColor: colors.surface },
            (stopping || (!isRecording && !isPaused)) && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={isPaused ? 'Resume' : 'Pause'}
        >
          <Text style={[styles.secondaryText, { color: colors.ink }]}>
            {isPaused ? 'Resume' : 'Pause'}
          </Text>
        </Pressable>

        <RecordingButton
          recording={isRecording || isPaused}
          paused={isPaused}
          disabled={stopping}
          onPress={() => {
            if (isRecording || isPaused) {
              void onStop();
              return;
            }
            void startRecording();
          }}
        />
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
          ? 'Notes update as you speak. When you stop, we save notes and keep the audio — no transcript.'
          : liveEnabled
            ? 'Captions appear as you speak. When you stop, we save audio plus any finals, then you can proceed to summarize.'
            : captionsMode === 'notes'
              ? 'Recording audio only. After upload we generate notes automatically without saving a transcript.'
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
  captionPanes: {
    width: '100%',
    maxWidth: 960,
    gap: spacing.md,
  },
  captionPanesRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  captionPanesStack: {
    flexDirection: 'column',
  },
  captionCard: {
    width: '100%',
    minHeight: 120,
    borderWidth: 1,
    borderRadius: radii.card,
    padding: spacing.md,
    gap: spacing.sm,
  },
  spokenPane: {
    minHeight: 140,
  },
  translatePane: {
    minHeight: 160,
  },
  captionCardHalf: {
    flex: 1,
    width: undefined,
    minWidth: 0,
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
    fontSize: 17,
    lineHeight: 26,
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
    fontSize: 15,
    lineHeight: 22,
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
