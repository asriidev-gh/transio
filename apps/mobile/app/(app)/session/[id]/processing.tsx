import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { CaptureMode, SessionStatusResponse } from '@sessionai/shared';
import { isNotesOnlyCaptureMode } from '@sessionai/shared';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingState } from '@/src/components/LoadingState';
import { ProcessingSteps } from '@/src/components/ProcessingSteps';
import { ApiClientError } from '@/src/services/api';
import { enqueueCompletionNotice } from '@/src/services/completion-inbox';
import {
  notifyProcessingComplete,
  requestNotificationPermission,
} from '@/src/services/notifications';
import { getSessionStatus, startProcessing } from '@/src/services/processing';
import { getSession } from '@/src/services/sessions';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { Button } from '@/src/components/ui/Button';
import { WaveformVisualizer } from '@/src/components/WaveformVisualizer';

export default function ProcessingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const [status, setStatus] = useState<SessionStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [sessionTitle, setSessionTitle] = useState<string>('Session');
  const [captureMode, setCaptureMode] = useState<CaptureMode>('batch');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);
  const notifiedRef = useRef(false);
  const sawInFlightRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const announceComplete = useCallback(async (sessionId: string) => {
    if (notifiedRef.current) return;
    notifiedRef.current = true;
    try {
      await enqueueCompletionNotice({ sessionId, title: sessionTitle });
      await notifyProcessingComplete({ sessionId, title: sessionTitle });
    } catch {
      // Non-fatal — UI already shows completed state.
    }
  }, [sessionTitle]);

  const refreshStatus = useCallback(async (sessionId: string) => {
    const next = await getSessionStatus(sessionId);
    setStatus(next);
    return next;
  }, []);

  const beginPolling = useCallback(
    (sessionId: string) => {
      stopPolling();
      sawInFlightRef.current = true;
      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            const next = await refreshStatus(sessionId);
            if (next.status === 'completed' || next.hasSummary) {
              stopPolling();
              setLoading(false);
              setError(null);
              if (sawInFlightRef.current) {
                await announceComplete(sessionId);
              }
              return;
            }
            if (next.status === 'failed') {
              stopPolling();
              setLoading(false);
              setError(
                "Processing failed. Your audio is still saved — you can retry.",
              );
            }
          } catch {
            // Keep polling through transient network blips.
          }
        })();
      }, 2000);
    },
    [announceComplete, refreshStatus, stopPolling],
  );

  const kickOff = useCallback(
    async (sessionId: string) => {
      setStarting(true);
      setError(null);
      try {
        void requestNotificationPermission();
        await startProcessing(sessionId);
        setLoading(true);
        beginPolling(sessionId);
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'Could not start processing. Try again.',
        );
        setLoading(false);
      } finally {
        setStarting(false);
      }
    },
    [beginPolling],
  );

  const bootstrap = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setError('Invalid session id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      try {
        const session = await getSession(id);
        setSessionTitle(session.title);
        setCaptureMode(session.captureMode);
      } catch {
        // Title is optional for notifications.
      }

      const next = await refreshStatus(id);

      if (next.status === 'completed' || next.hasSummary) {
        setLoading(false);
        return;
      }

      if (next.status === 'transcribing' || next.status === 'summarizing') {
        beginPolling(id);
        return;
      }

      if (!next.hasAudio) {
        setError('Upload audio before processing this session.');
        setLoading(false);
        return;
      }

      if (next.status === 'failed') {
        setError("Processing failed. Your audio is still saved — you can retry.");
        setLoading(false);
        return;
      }

      // Auto-start once for uploaded / transcribed sessions arriving here after Proceed.
      if (!startedRef.current) {
        startedRef.current = true;
        await kickOff(id);
        return;
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load processing status.');
      setLoading(false);
    }
  }, [beginPolling, id, kickOff, refreshStatus]);

  useEffect(() => {
    void bootstrap();
    return () => stopPolling();
  }, [bootstrap, stopPolling]);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      if (next !== 'active' || !id || typeof id !== 'string') return;
      void (async () => {
        try {
          const latest = await refreshStatus(id);
          if (latest.status === 'transcribing' || latest.status === 'summarizing') {
            beginPolling(id);
          }
        } catch {
          // ignore transient resume errors
        }
      })();
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [beginPolling, id, refreshStatus]);

  const inFlight =
    starting ||
    status?.status === 'transcribing' ||
    status?.status === 'summarizing';

  const done = Boolean(status && (status.status === 'completed' || status.hasSummary));
  const failed = Boolean(status && status.status === 'failed') || Boolean(error);

  if (!status && loading) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <LoadingState message="Checking processing status…" />
      </View>
    );
  }

  if (!status && error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ErrorState
          title="Processing unavailable"
          description={error}
          actionLabel="Retry"
          onRetry={() => void bootstrap()}
        />
      </View>
    );
  }

  if (!status) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ErrorState
          title="Processing unavailable"
          description="Could not load session status."
          onRetry={() => void bootstrap()}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.kicker, { color: colors.inkMuted }]}>
        {done ? 'Ready' : failed ? 'Needs attention' : inFlight ? 'Analyzing' : 'Process'}
      </Text>
      <Text style={[styles.title, { color: colors.ink }]}>{sessionTitle}</Text>
      <Text style={[styles.subtitle, { color: colors.inkMuted }]}>
        {done
          ? 'Your transcript is ready — review, translate, or share.'
          : failed
            ? 'We couldn’t finish this recording. Your audio is still saved.'
            : inFlight
              ? 'Smart Transcriber is analyzing your audio. Safe to leave — we’ll notify you when it’s done.'
              : 'We’ll transcribe speech, then prepare a clear summary.'}
      </Text>

      {inFlight && !done ? (
        <View style={styles.waveWrap}>
          <WaveformVisualizer active accessibilityLabel="Processing visualization" />
        </View>
      ) : null}

      {inFlight && !done ? (
        <View
          style={[
            styles.safeBanner,
            { backgroundColor: colors.accentSoft, borderColor: colors.accent },
          ]}
          accessibilityRole="text"
        >
          <Text style={[styles.safeBannerText, { color: colors.accentDeep }]}>
            Safe to leave. We’ll notify you when processing finishes if notifications are allowed.
          </Text>
        </View>
      ) : null}

      <View style={styles.steps}>
        <ProcessingSteps
          status={status.status}
          hasAudio={status.hasAudio}
          hasTranscript={status.hasTranscript}
          hasSummary={status.hasSummary}
          notesOnly={isNotesOnlyCaptureMode(captureMode)}
        />
      </View>

      {failed && !done ? (
        <Button
          label="Retry processing"
          onPress={() => {
            if (!id || typeof id !== 'string') return;
            startedRef.current = true;
            void kickOff(id);
          }}
        />
      ) : null}

      {done ? (
        <View style={styles.actions}>
          <Button
            label="Open session"
            onPress={() => router.replace(`/session/${id}`)}
          />
          <Button
            label="View summary"
            variant="secondary"
            onPress={() => router.push(`/session/${id}/summary`)}
          />
        </View>
      ) : null}

      {!done && !inFlight && !failed ? (
        <Button
          label="Start processing"
          onPress={() => {
            if (!id || typeof id !== 'string') return;
            void kickOff(id);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.lg,
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
    letterSpacing: 0.8,
  },
  title: {
    ...typography.pageTitle,
  },
  subtitle: {
    ...typography.body,
    marginBottom: spacing.sm,
  },
  waveWrap: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  safeBanner: {
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
  },
  safeBannerText: {
    ...typography.body,
    fontSize: 14,
    fontWeight: '600',
  },
  steps: {
    paddingVertical: spacing.sm,
  },
  actions: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
});
