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
import { fetchUploadLimits } from '@/src/services/fetch-upload-limits';
import { getCachedUploadLimits } from '@/src/services/upload-limits';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { Button } from '@/src/components/ui/Button';
import { transcriptionEstimateSentence } from '@/src/utils/transcription-estimate';
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
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [maxAudioMinutes, setMaxAudioMinutes] = useState(
    () => getCachedUploadLimits().maxAudioMinutes,
  );
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);
  const notifiedRef = useRef(false);
  const sawInFlightRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    void fetchUploadLimits().then((limits) => {
      if (!cancelled) setMaxAudioMinutes(limits.maxAudioMinutes);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const notesOnly = isNotesOnlyCaptureMode(captureMode);

  const isPipelineDone = useCallback(
    (next: SessionStatusResponse) =>
      next.status === 'completed' ||
      next.status === 'transcribed' ||
      next.hasSummary ||
      (notesOnly && Boolean(next.hasNotes)),
    [notesOnly],
  );

  const beginPolling = useCallback(
    (sessionId: string) => {
      stopPolling();
      sawInFlightRef.current = true;
      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            const next = await refreshStatus(sessionId);
            if (isPipelineDone(next)) {
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
    [announceComplete, isPipelineDone, refreshStatus, stopPolling],
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
        setDurationSeconds(session.durationSeconds);
      } catch {
        // Title is optional for notifications.
      }

      const next = await refreshStatus(id);

      if (
        next.status === 'completed' ||
        next.status === 'transcribed' ||
        next.hasSummary ||
        next.hasNotes
      ) {
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

      // Auto-start once for uploaded sessions arriving here after Proceed.
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
  const transcriptionWait =
    status?.status === 'summarizing'
      ? null
      : transcriptionEstimateSentence(durationSeconds, maxAudioMinutes);

  const done = Boolean(status && isPipelineDone(status));
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
          ? notesOnly
            ? 'Your notes are ready — review, translate, or share.'
            : 'Your transcript is ready — open the session to review or generate a summary.'
          : failed
            ? 'We couldn’t finish this recording. Your audio is still saved.'
            : inFlight
              ? 'Smart Transcriber is analyzing your audio. Safe to leave — we’ll notify you when it’s done.'
              : notesOnly
                ? 'We’ll listen privately and write structured notes.'
                : 'We’ll transcribe speech so you can review and summarize when you want.'}
      </Text>
      {!done && !failed && transcriptionWait ? (
        <Text style={[styles.subtitle, { color: colors.ink }]}>{transcriptionWait}</Text>
      ) : null}

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
          hasNotes={Boolean(status.hasNotes)}
          notesOnly={notesOnly}
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
          {status.hasSummary ? (
            <Button
              label="View summary"
              variant="secondary"
              onPress={() => router.push(`/session/${id}/summary`)}
            />
          ) : null}
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
    alignItems: 'center',
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
