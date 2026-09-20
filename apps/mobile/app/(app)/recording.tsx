import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
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
import { colors, radii, spacing, typography } from '@/src/theme';

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
      Alert.alert(
        'Stop recording?',
        'You have an active recording. Stop and save it before leaving.',
        [
          { text: 'Keep recording', style: 'cancel' },
          {
            text: 'Discard and leave',
            style: 'destructive',
            onPress: () => {
              activeRef.current = false;
              navigation.dispatch(event.data.action);
            },
          },
        ],
      );
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
      <View style={styles.centered}>
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
      <View style={styles.centered}>
        <LoadingState message={permission === 'checking' ? 'Checking microphone…' : 'Starting…'} />
      </View>
    );
  }

  if (permission === 'denied' || permission === 'unavailable') {
    return (
      <View style={styles.centered}>
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
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {title}
      </Text>

      <RecordingTimer seconds={elapsedSeconds} />

      <WaveformVisualizer active={isRecording && !stopping} />

      <View style={styles.statusRow}>
        <View
          style={[styles.dot, isRecording ? styles.dotLive : isPaused ? styles.dotPaused : styles.dotIdle]}
        />
        <Text style={styles.statusText}>
          {stopping ? 'Saving…' : isRecording ? 'Recording' : isPaused ? 'Paused' : 'Ready'}
        </Text>
      </View>

      {recordError ? (
        <Text style={styles.error} accessibilityRole="alert">
          {recordError}
        </Text>
      ) : null}

      <View style={styles.controls}>
        <Pressable
          onPress={() => void onPauseResume()}
          disabled={stopping || (!isRecording && !isPaused)}
          style={[
            styles.secondaryButton,
            (stopping || (!isRecording && !isPaused)) && styles.disabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel={isPaused ? 'Resume' : 'Pause'}
        >
          <Text style={styles.secondaryText}>{isPaused ? 'Resume' : 'Pause'}</Text>
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

      <Text style={styles.hint}>
        Recording continues offline. When you stop, review locally, then Proceed to upload and
        process.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  title: {
    ...typography.title,
    color: colors.ink,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotLive: {
    backgroundColor: colors.recording,
  },
  dotPaused: {
    backgroundColor: colors.accent,
  },
  dotIdle: {
    backgroundColor: colors.border,
  },
  statusText: {
    ...typography.body,
    fontWeight: '600',
    color: colors.ink,
  },
  error: {
    color: colors.danger,
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
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    minWidth: 140,
    alignItems: 'center',
  },
  secondaryText: {
    color: colors.ink,
    fontWeight: '600',
    fontSize: 16,
  },
  disabled: {
    opacity: 0.45,
  },
  hint: {
    ...typography.caption,
    color: colors.inkMuted,
    textAlign: 'center',
    marginTop: spacing.xl,
    maxWidth: 320,
  },
});
