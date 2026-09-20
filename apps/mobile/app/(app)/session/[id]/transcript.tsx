import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import type { SessionStatusResponse, Transcript } from '@sessionai/shared';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingState } from '@/src/components/LoadingState';
import { TranscriptViewer } from '@/src/components/TranscriptViewer';
import { ApiClientError } from '@/src/services/api';
import {
  getSessionStatus,
  getTranscript,
  startTranscription,
} from '@/src/services/transcription';
import { colors, spacing, typography } from '@/src/theme';

export default function TranscriptScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transcript, setTranscript] = useState<Transcript | null>(null);
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

  const loadTranscript = useCallback(async (sessionId: string) => {
    const data = await getTranscript(sessionId);
    setTranscript(data);
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
            if (next.status === 'transcribed' || next.hasTranscript) {
              stopPolling();
              await loadTranscript(sessionId);
              setLoading(false);
              return;
            }
            if (next.status === 'failed') {
              stopPolling();
              setLoading(false);
              setError(
                "We couldn't transcribe this recording. Your audio is still saved.",
              );
            }
          } catch {
            // Keep polling through transient network blips.
          }
        })();
      }, 2000);
    },
    [loadTranscript, refreshStatus, stopPolling],
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
      if (next.hasTranscript || next.status === 'transcribed') {
        await loadTranscript(id);
        setLoading(false);
        return;
      }

      if (next.status === 'transcribing') {
        beginPolling(id);
        return;
      }

      if (!next.hasAudio) {
        setError('Upload audio before generating a transcript.');
        setLoading(false);
        return;
      }

      if (next.status === 'failed') {
        setError("We couldn't transcribe this recording. Your audio is still saved.");
        setLoading(false);
        return;
      }

      setLoading(false);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load transcript status.');
      setLoading(false);
    }
  }, [beginPolling, id, loadTranscript, refreshStatus]);

  useEffect(() => {
    void bootstrap();
    return () => stopPolling();
  }, [bootstrap, stopPolling]);

  async function onStartOrRetry() {
    if (!id || typeof id !== 'string') return;
    setStarting(true);
    setError(null);
    setTranscript(null);
    try {
      await startTranscription(id);
      setLoading(true);
      beginPolling(id);
    } catch (err) {
      setError(
        err instanceof ApiClientError
          ? err.message
          : 'Could not start transcription. Try again.',
      );
      setLoading(false);
    } finally {
      setStarting(false);
    }
  }

  if (loading || starting || status?.status === 'transcribing') {
    return (
      <View style={styles.centered}>
        <LoadingState
          message={
            status?.status === 'transcribing' || starting
              ? 'Transcribing your recording…'
              : 'Loading transcript…'
          }
        />
        <Text style={styles.hint}>This can take a moment for longer sessions.</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <ErrorState
          title="Transcript unavailable"
          description={error}
          actionLabel="Try Again"
          onRetry={() => void onStartOrRetry()}
        />
      </View>
    );
  }

  if (transcript) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Transcript</Text>
        <TranscriptViewer
          text={transcript.text}
          language={transcript.language}
          segments={transcript.segments}
        />
      </View>
    );
  }

  return (
    <View style={styles.centered}>
      <ErrorState
        title="No transcript yet"
        description="Generate a transcript from the uploaded recording."
        actionLabel="Transcribe"
        onRetry={() => void onStartOrRetry()}
      />
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
    gap: spacing.md,
  },
  title: {
    ...typography.title,
    color: colors.ink,
  },
  hint: {
    ...typography.caption,
    color: colors.inkMuted,
    textAlign: 'center',
  },
});
