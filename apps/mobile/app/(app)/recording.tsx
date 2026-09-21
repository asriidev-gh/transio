import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  Pressable,
  StyleSheet,
  Text,
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
import { saveLocalAudioUri } from '@/src/services/local-audio';
import { getSession, updateSession } from '@/src/services/sessions';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { confirmAction } from '@/src/utils/confirm';

type PermissionState = 'checking' | 'granted' | 'denied' | 'unavailable';

const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'document' as const,
};

export default function RecordingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
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
  const startedRef = useRef(false);
  const activeRef = useRef(false);

  const { colors } = useTheme();
  const elapsedSeconds = Math.max(0, Math.floor((recorderState.durationMillis ?? 0) / 1000));
  const isRecording = recorderState.isRecording;
  const blockingNavigation = (isRecording || isPaused) && !stopping;

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
    } catch {
      setRecordError('We could not start recording. Check microphone access and try again.');
      activeRef.current = false;
    } finally {
      setStarting(false);
    }
  }, [recorder]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      if (!id || typeof id !== 'string') {
        setBootError('Missing session id.');
        return;
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
      if (!cancelled && granted && !startedRef.current) {
        await startRecording();
      }
    }

    void boot();
    return () => {
      cancelled = true;
    };
  }, [id, ensurePermission, startRecording]);

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
        setIsPaused(true);
        return;
      }
      recorder.record();
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
              ? 'SessionAI needs microphone access to record seminars and discussions. Enable it in system settings, then try again.'
              : 'Microphone access is unavailable in this environment.'
          }
          onRetry={() => void ensurePermission().then((ok) => (ok ? startRecording() : undefined))}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
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
          {stopping ? 'Saving…' : isRecording ? 'Listening' : isPaused ? 'Paused' : 'Ready'}
        </Text>
      </View>

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
        style={styles.cancel}
      >
        <Text style={[styles.cancelText, { color: colors.inkMuted }]}>Cancel</Text>
      </Pressable>

      <Text style={[styles.hint, { color: colors.inkMuted }]}>
        Recording continues offline. When you stop, review locally, then proceed to transcribe.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
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
    minHeight: 44,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '500',
  },
  hint: {
    ...typography.caption,
    textAlign: 'center',
    marginTop: spacing.md,
    maxWidth: 320,
  },
});
