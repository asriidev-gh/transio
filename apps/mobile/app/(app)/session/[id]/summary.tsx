import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { SessionStatusResponse, SummaryRecord } from '@sessionai/shared';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingState } from '@/src/components/LoadingState';
import { SummarySections } from '@/src/components/SummarySections';
import { ApiClientError } from '@/src/services/api';
import {
  getSessionStatus,
  getSummary,
  startSummarization,
} from '@/src/services/summary';
import { spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

export default function SummaryScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors } = useTheme();
  const [summary, setSummary] = useState<SummaryRecord | null>(null);
  const [status, setStatus] = useState<SessionStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadSummary = useCallback(async (sessionId: string) => {
    const data = await getSummary(sessionId);
    setSummary(data);
    setError(null);
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
            if (next.hasSummary) {
              stopPolling();
              await loadSummary(sessionId);
              setLoading(false);
              return;
            }
            if (next.status === 'failed') {
              stopPolling();
              setLoading(false);
              setError(
                "We couldn't summarize this session. Your transcript is still saved.",
              );
            }
          } catch {
            // Keep polling through transient network blips.
          }
        })();
      }, 2000);
    },
    [loadSummary, refreshStatus, stopPolling],
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
      if (next.hasSummary) {
        await loadSummary(id);
        setLoading(false);
        return;
      }

      if (next.status === 'summarizing') {
        beginPolling(id);
        return;
      }

      if (!next.hasTranscript && !next.hasNotes) {
        setError('Capture notes or a transcript before creating an AI Summary.');
        setLoading(false);
        return;
      }

      if (next.status === 'failed') {
        setError("We couldn't summarize this session. Your transcript is still saved.");
        setLoading(false);
        return;
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load summary status.');
      setLoading(false);
    }
  }, [beginPolling, id, loadSummary, refreshStatus]);

  useEffect(() => {
    void bootstrap();
    return () => stopPolling();
  }, [bootstrap, stopPolling]);

  async function onStartOrRetry() {
    if (!id || typeof id !== 'string') return;
    setStarting(true);
    setError(null);
    setSummary(null);
    try {
      await startSummarization(id);
      setLoading(true);
      beginPolling(id);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Could not start summarization. Try again.',
      );
      setLoading(false);
    } finally {
      setStarting(false);
    }
  }

  if (loading || starting || status?.status === 'summarizing') {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <LoadingState
          message={
            status?.status === 'summarizing' || starting
              ? 'Generating AI Summary…'
              : 'Loading summary…'
          }
        />
        <Text style={[styles.hint, { color: colors.inkMuted }]}>
          Claude is structuring notes from your transcript.
        </Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ErrorState
          title="Summary unavailable"
          description={error}
          actionLabel="Try Again"
          onRetry={() => void onStartOrRetry()}
        />
      </View>
    );
  }

  if (summary) {
    return (
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
        style={{ backgroundColor: colors.background }}
      >
        <Text style={[styles.title, { color: colors.ink }]}>AI Summary</Text>
        <SummarySections summary={summary} />
      </ScrollView>
    );
  }

  return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>
      <ErrorState
        title="No summary yet"
        description="Generate a structured AI Summary from the transcript."
        actionLabel="Summarize"
        onRetry={() => void onStartOrRetry()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  centered: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    ...typography.title,
  },
  hint: {
    ...typography.caption,
    textAlign: 'center',
  },
});
