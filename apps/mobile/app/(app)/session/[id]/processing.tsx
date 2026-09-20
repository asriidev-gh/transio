import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus, Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { SessionStatusResponse } from '@sessionai/shared';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingState } from '@/src/components/LoadingState';
import { ProcessingSteps } from '@/src/components/ProcessingSteps';
import { ApiClientError } from '@/src/services/api';
import { getSessionStatus, startProcessing } from '@/src/services/processing';
import { colors, radii, spacing, typography } from '@/src/theme';

export default function ProcessingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<SessionStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const refreshStatus = useCallback(async (sessionId: string) => {
    const next = await getSessionStatus(sessionId);
    setStatus(next);
    return next;
  }, []);

  const beginPolling = useCallback(
    (sessionId: string) => {
      stopPolling();
      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            const next = await refreshStatus(sessionId);
            if (next.status === 'completed' || next.hasSummary) {
              stopPolling();
              setLoading(false);
              setError(null);
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
    [refreshStatus, stopPolling],
  );

  const kickOff = useCallback(
    async (sessionId: string) => {
      setStarting(true);
      setError(null);
      try {
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
      <View style={styles.centered}>
        <LoadingState message="Checking processing status…" />
      </View>
    );
  }

  if (!status && error) {
    return (
      <View style={styles.centered}>
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
      <View style={styles.centered}>
        <ErrorState
          title="Processing unavailable"
          description="Could not load session status."
          onRetry={() => void bootstrap()}
        />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Processing</Text>
      <Text style={styles.subtitle}>
        {done
          ? 'Your session is ready.'
          : failed
            ? 'Something went wrong — your audio is still saved.'
            : inFlight
              ? 'Working through transcription and summary…'
              : 'Ready to process this recording.'}
      </Text>

      {inFlight && !done ? (
        <View style={styles.safeBanner} accessibilityRole="text">
          <Text style={styles.safeBannerText}>
            Safe to leave. Come back anytime — this screen keeps syncing with the server.
          </Text>
        </View>
      ) : null}

      <View style={styles.card}>
        <ProcessingSteps
          status={status.status}
          hasAudio={status.hasAudio}
          hasTranscript={status.hasTranscript}
          hasSummary={status.hasSummary}
        />
      </View>

      {failed && !done ? (
        <Pressable
          style={styles.primary}
          onPress={() => {
            if (!id || typeof id !== 'string') return;
            startedRef.current = true;
            void kickOff(id);
          }}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Retry processing</Text>
        </Pressable>
      ) : null}

      {done ? (
        <View style={styles.actions}>
          <Pressable
            style={styles.primary}
            onPress={() => router.replace(`/session/${id}`)}
            accessibilityRole="button"
          >
            <Text style={styles.primaryText}>Open session workspace</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => router.push(`/session/${id}/summary`)}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>View AI Summary</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => router.push(`/session/${id}/transcript`)}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryText}>View Transcript</Text>
          </Pressable>
        </View>
      ) : null}

      {!done && !inFlight && !failed ? (
        <Pressable
          style={styles.primary}
          onPress={() => {
            if (!id || typeof id !== 'string') return;
            void kickOff(id);
          }}
          accessibilityRole="button"
        >
          <Text style={styles.primaryText}>Start processing</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
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
  },
  subtitle: {
    ...typography.body,
    color: colors.inkMuted,
    marginBottom: spacing.sm,
  },
  safeBanner: {
    backgroundColor: colors.accentSoft,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  safeBannerText: {
    ...typography.body,
    fontSize: 14,
    color: colors.brand,
    fontWeight: '600',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  actions: {
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  primary: {
    backgroundColor: colors.brand,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  primaryText: {
    color: colors.onBrand,
    fontWeight: '700',
    fontSize: 16,
  },
  secondary: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  secondaryText: {
    color: colors.ink,
    fontWeight: '600',
    fontSize: 16,
  },
});
