import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type {
  FeedbackRating,
  SessionFeedback,
  SummaryRecord,
  Transcript,
  TranslatedSummary,
  TranslatedTranscript,
  TranslateLanguage,
} from '@sessionai/shared';
import { ActionItemsPanel } from '@/src/components/ActionItemsPanel';
import { AskSessionPanel } from '@/src/components/AskSessionPanel';
import { ContentFeedback } from '@/src/components/ContentFeedback';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingState } from '@/src/components/LoadingState';
import { MindMapView } from '@/src/components/MindMapView';
import { SessionTabs, type SessionTabKey } from '@/src/components/SessionTabs';
import { SummarySections } from '@/src/components/SummarySections';
import { TranscriptViewer } from '@/src/components/TranscriptViewer';
import { TranslateBar } from '@/src/components/TranslateBar';
import { ApiClientError } from '@/src/services/api';
import { getSessionFeedback, setSessionFeedback } from '@/src/services/feedback';
import { getSummary } from '@/src/services/summary';
import { translateSessionContent } from '@/src/services/translate';
import { getTranscript, remapTranscriptSpeakers } from '@/src/services/transcription';
import { spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

interface SessionWorkspaceProps {
  sessionId: string;
  sessionTitle: string;
  hasTranscript: boolean;
  hasSummary: boolean;
  notesOnly?: boolean;
  initialTab?: SessionTabKey;
  currentTimeSec?: number;
  onSeekMs?: (startMs: number) => void;
  onContentLoaded?: (content: {
    summary: SummaryRecord | null;
    transcript: Transcript | null;
  }) => void;
}

type SummaryCache = Partial<Record<TranslateLanguage, TranslatedSummary>>;
type TranscriptCache = Partial<Record<TranslateLanguage, TranslatedTranscript>>;

function applyTranslatedSummary(
  original: SummaryRecord,
  translated: TranslatedSummary,
): SummaryRecord {
  return {
    ...original,
    overview: translated.overview,
    keyPoints: translated.keyPoints,
    topics: translated.topics,
    questionsDiscussed: translated.questionsDiscussed,
    actionItems: translated.actionItems,
    importantInsights: translated.importantInsights,
    quotes: translated.quotes ?? [],
  };
}

export function SessionWorkspace({
  sessionId,
  sessionTitle,
  hasTranscript,
  hasSummary,
  notesOnly = false,
  initialTab = 'summary',
  currentTimeSec = 0,
  onSeekMs,
  onContentLoaded,
}: SessionWorkspaceProps) {
  const { colors } = useTheme();
  const [tab, setTab] = useState<SessionTabKey>(
    initialTab === 'summary' && !hasSummary && hasTranscript && !notesOnly
      ? 'transcript'
      : notesOnly
        ? 'summary'
        : initialTab,
  );
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [summary, setSummary] = useState<SummaryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [translateLanguage, setTranslateLanguage] = useState<TranslateLanguage | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [summaryCache, setSummaryCache] = useState<SummaryCache>({});
  const [transcriptCache, setTranscriptCache] = useState<TranscriptCache>({});
  const [feedback, setFeedback] = useState<SessionFeedback>({
    summary: null,
    transcript: null,
  });
  const [feedbackBusy, setFeedbackBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextTranscript, nextSummary, nextFeedback] = await Promise.all([
        hasTranscript ? getTranscript(sessionId).catch(() => null) : Promise.resolve(null),
        hasSummary ? getSummary(sessionId).catch(() => null) : Promise.resolve(null),
        getSessionFeedback(sessionId).catch(() => ({ summary: null, transcript: null })),
      ]);
      setTranscript(nextTranscript);
      setSummary(nextSummary);
      setFeedback(nextFeedback);
      setSummaryCache({});
      setTranscriptCache({});
      setTranslateLanguage(null);
      setTranslateError(null);
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

  useEffect(() => {
    if (!notesOnly) return;
    if (tab === 'transcript' || tab === 'ask') {
      setTab('summary');
    }
  }, [notesOnly, tab]);

  const canTranslate =
    (tab === 'summary' && Boolean(summary)) ||
    (tab === 'actions' && Boolean(summary)) ||
    (tab === 'map' && Boolean(summary)) ||
    (tab === 'transcript' && Boolean(transcript));

  const ensureTranslation = useCallback(
    async (language: TranslateLanguage) => {
      const scope =
        tab === 'transcript' ? 'transcript' : ('summary' as const);

      if (scope === 'summary' && summaryCache[language]) return;
      if (scope === 'transcript' && transcriptCache[language]) return;

      setTranslating(true);
      setTranslateError(null);
      try {
        const result = await translateSessionContent(sessionId, language, scope);
        if (scope === 'summary' && result.summary) {
          setSummaryCache((prev) => ({ ...prev, [language]: result.summary! }));
        }
        if (scope === 'transcript' && result.transcript) {
          setTranscriptCache((prev) => ({ ...prev, [language]: result.transcript! }));
        }
      } catch (err) {
        setTranslateError(
          err instanceof ApiClientError
            ? err.message
            : 'Could not translate. Check that the API has ANTHROPIC_API_KEY set.',
        );
        setTranslateLanguage(null);
      } finally {
        setTranslating(false);
      }
    },
    [sessionId, summaryCache, tab, transcriptCache],
  );

  async function onSelectLanguage(language: TranslateLanguage | null) {
    setTranslateLanguage(language);
    setTranslateError(null);
    if (!language) return;
    await ensureTranslation(language);
  }

  useEffect(() => {
    if (!translateLanguage || !canTranslate) return;
    void ensureTranslation(translateLanguage);
  }, [canTranslate, ensureTranslation, tab, translateLanguage]);

  async function onFeedbackChange(
    target: 'summary' | 'transcript',
    rating: FeedbackRating,
  ) {
    setFeedbackBusy(true);
    try {
      const next = await setSessionFeedback(sessionId, target, rating);
      setFeedback(next);
    } catch (err) {
      setTranslateError(
        err instanceof ApiClientError
          ? err.message
          : 'Could not save feedback. Apply the feedback migration if needed.',
      );
    } finally {
      setFeedbackBusy(false);
    }
  }

  const displaySummary = useMemo(() => {
    if (!summary) return null;
    if (!translateLanguage) return summary;
    const translated = summaryCache[translateLanguage];
    return translated ? applyTranslatedSummary(summary, translated) : summary;
  }, [summary, summaryCache, translateLanguage]);

  const displayTranscript = useMemo(() => {
    if (!transcript) return null;
    if (!translateLanguage) return transcript;
    const translated = transcriptCache[translateLanguage];
    if (!translated) return transcript;
    return {
      ...transcript,
      text: translated.text,
      segments: translated.segments,
    };
  }, [transcript, transcriptCache, translateLanguage]);

  return (
    <View style={styles.wrap}>
      <SessionTabs value={tab} onChange={setTab} notesOnly={notesOnly} />

      {!loading && !error && canTranslate ? (
        <TranslateBar
          activeLanguage={translateLanguage}
          busy={translating}
          busyLabel={translating ? 'Translating…' : undefined}
          onSelect={(language) => void onSelectLanguage(language)}
        />
      ) : null}

      {translateError ? (
        <Text style={[styles.translateError, { color: colors.danger }]} accessibilityRole="alert">
          {translateError}
        </Text>
      ) : null}

      {loading ? <LoadingState message="Loading session content…" /> : null}

      {!loading && error ? (
        <ErrorState title="Couldn’t load content" description={error} onRetry={() => void load()} />
      ) : null}

      {!loading && !error && tab === 'summary' ? (
        displaySummary ? (
          <View>
            <SummarySections summary={displaySummary} />
            <ContentFeedback
              label="Was this summary helpful?"
              value={feedback.summary}
              busy={feedbackBusy}
              onChange={(rating) => void onFeedbackChange('summary', rating)}
            />
          </View>
        ) : (
          <Text style={[styles.empty, { color: colors.inkMuted }]}>
            Summary isn’t ready yet. Open Processing to finish the pipeline.
          </Text>
        )
      ) : null}

      {!loading && !error && tab === 'transcript' && !notesOnly ? (
        displayTranscript ? (
          <View>
            <TranscriptViewer
              text={displayTranscript.text}
              language={displayTranscript.language}
              segments={displayTranscript.segments}
              currentTimeSec={currentTimeSec}
              onSeekMs={onSeekMs}
              onRenameSpeaker={
                translateLanguage
                  ? undefined
                  : async (from, to) => {
                      const updated = await remapTranscriptSpeakers(sessionId, { [from]: to });
                      setTranscript(updated);
                      onContentLoaded?.({ summary, transcript: updated });
                    }
              }
            />
            <ContentFeedback
              label="Was this transcript helpful?"
              value={feedback.transcript}
              busy={feedbackBusy}
              onChange={(rating) => void onFeedbackChange('transcript', rating)}
            />
          </View>
        ) : (
          <Text style={[styles.empty, { color: colors.inkMuted }]}>
            Transcript isn’t ready yet. Open Processing to generate it.
          </Text>
        )
      ) : null}

      {!loading && !error && tab === 'ask' && !notesOnly ? (
        hasTranscript ? (
          <AskSessionPanel sessionId={sessionId} sessionTitle={sessionTitle} />
        ) : (
          <Text style={[styles.empty, { color: colors.inkMuted }]}>Ask needs a transcript first.</Text>
        )
      ) : null}

      {!loading && !error && tab === 'actions' ? (
        displaySummary ? (
          <ActionItemsPanel sessionId={sessionId} actionItems={displaySummary.actionItems} />
        ) : (
          <Text style={[styles.empty, { color: colors.inkMuted }]}>
            Action items appear after the AI summary is ready.
          </Text>
        )
      ) : null}

      {!loading && !error && tab === 'map' ? (
        displaySummary ? (
          <MindMapView summary={displaySummary} sessionTitle={sessionTitle} />
        ) : (
          <Text style={[styles.empty, { color: colors.inkMuted }]}>
            Mind map appears after the AI summary is ready.
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
    paddingVertical: spacing.lg,
  },
  translateError: {
    ...typography.caption,
  },
});
