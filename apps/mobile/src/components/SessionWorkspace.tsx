import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SummaryRecord, Transcript } from '@sessionai/shared';
import { ActionItemsPanel } from '@/src/components/ActionItemsPanel';
import { AskSessionPanel } from '@/src/components/AskSessionPanel';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingState } from '@/src/components/LoadingState';
import { SessionTabs, type SessionTabKey } from '@/src/components/SessionTabs';
import { SummarySections } from '@/src/components/SummarySections';
import { TranscriptViewer } from '@/src/components/TranscriptViewer';
import { ApiClientError } from '@/src/services/api';
import { getSummary } from '@/src/services/summary';
import { getTranscript } from '@/src/services/transcription';
import { colors, spacing, typography } from '@/src/theme';

interface SessionWorkspaceProps {
  sessionId: string;
  sessionTitle: string;
  hasTranscript: boolean;
  hasSummary: boolean;
  initialTab?: SessionTabKey;
  currentTimeSec?: number;
  onSeekMs?: (startMs: number) => void;
  onContentLoaded?: (content: {
    summary: SummaryRecord | null;
    transcript: Transcript | null;
  }) => void;
}

export function SessionWorkspace({
  sessionId,
  sessionTitle,
  hasTranscript,
  hasSummary,
  initialTab = 'summary',
  currentTimeSec = 0,
  onSeekMs,
  onContentLoaded,
}: SessionWorkspaceProps) {
  const [tab, setTab] = useState<SessionTabKey>(
    initialTab === 'summary' && !hasSummary && hasTranscript ? 'transcript' : initialTab,
  );
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [summary, setSummary] = useState<SummaryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextTranscript, nextSummary] = await Promise.all([
        hasTranscript ? getTranscript(sessionId).catch(() => null) : Promise.resolve(null),
        hasSummary ? getSummary(sessionId).catch(() => null) : Promise.resolve(null),
      ]);
      setTranscript(nextTranscript);
      setSummary(nextSummary);
      onContentLoaded?.({ summary: nextSummary, transcript: nextTranscript });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load session content.');
    } finally {
      setLoading(false);
    }
  }, [hasSummary, hasTranscript, onContentLoaded, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <View style={styles.wrap}>
      <SessionTabs value={tab} onChange={setTab} />

      {loading ? <LoadingState message="Loading session content…" /> : null}

      {!loading && error ? (
        <ErrorState title="Couldn’t load content" description={error} onRetry={() => void load()} />
      ) : null}

      {!loading && !error && tab === 'summary' ? (
        summary ? (
          <SummarySections summary={summary} />
        ) : (
          <Text style={styles.empty}>
            Summary isn’t ready yet. Open Processing to finish the pipeline.
          </Text>
        )
      ) : null}

      {!loading && !error && tab === 'transcript' ? (
        transcript ? (
          <TranscriptViewer
            text={transcript.text}
            language={transcript.language}
            segments={transcript.segments}
            currentTimeSec={currentTimeSec}
            onSeekMs={onSeekMs}
          />
        ) : (
          <Text style={styles.empty}>
            Transcript isn’t ready yet. Open Processing to generate it.
          </Text>
        )
      ) : null}

      {!loading && !error && tab === 'ask' ? (
        hasTranscript ? (
          <AskSessionPanel sessionId={sessionId} sessionTitle={sessionTitle} />
        ) : (
          <Text style={styles.empty}>Ask needs a transcript first.</Text>
        )
      ) : null}

      {!loading && !error && tab === 'actions' ? (
        summary ? (
          <ActionItemsPanel sessionId={sessionId} actionItems={summary.actionItems} />
        ) : (
          <Text style={styles.empty}>
            Action items appear after the AI summary is ready.
          </Text>
        )
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
  empty: {
    ...typography.body,
    color: colors.inkMuted,
    paddingVertical: spacing.lg,
  },
});
