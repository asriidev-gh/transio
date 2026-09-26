import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type {
  FeedbackRating,
  SessionFeedback,
  SessionSummary,
  SummaryRecord,
  Transcript,
  TranslatedSummary,
  TranslatedTranscript,
  TranslateLanguage,
} from '@sessionai/shared';
import { bulletsFromNotes, splitIntoSentences } from '@sessionai/shared';
import { AskSessionPanel } from '@/src/components/AskSessionPanel';
import { ContentFeedback } from '@/src/components/ContentFeedback';
import { ErrorState } from '@/src/components/ErrorState';
import { MindMapView } from '@/src/components/MindMapView';
import { PaperNotesView } from '@/src/components/PaperNotesView';
import { SessionContentSkeleton } from '@/src/components/Skeleton';
import { SessionTabs, type SessionTabKey } from '@/src/components/SessionTabs';
import { CompletionBanner } from '@/src/components/CompletionBanner';
import { SummaryGeneratingBanner } from '@/src/components/SummaryGeneratingBanner';
import { SummarySections } from '@/src/components/SummarySections';
import { TranscriptViewer } from '@/src/components/TranscriptViewer';
import { TranslateOnDemand } from '@/src/components/TranslateOnDemand';
import { TranslateLanguageSheet } from '@/src/components/TranslateLanguageSheet';
import { NotesLanguageToggle } from '@/src/components/NotesLanguageToggle';
import { Button } from '@/src/components/ui/Button';
import { ApiClientError } from '@/src/services/api';
import { consumeFeature } from '@/src/services/entitlements';
import { ensureFeatureAccess } from '@/src/utils/feature-gate';
import { getSessionFeedback, setSessionFeedback } from '@/src/services/feedback';
import { finalizeSessionNotes } from '@/src/services/live-notes';
import { clearNotesDraft, readNotesDraft, writeNotesDraft } from '@/src/services/notes-draft';
import {
  getSessionNotes,
  getSessionStatus,
  getSummary,
  startSummarization,
} from '@/src/services/summary';
import { translateSessionContent } from '@/src/services/translate';
import { getTranscript, remapTranscriptSpeakers } from '@/src/services/transcription';
import { spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';

function draftAsRecord(sessionId: string, draft: SessionSummary): SummaryRecord {
  const now = new Date().toISOString();
  return {
    id: '00000000-0000-4000-8000-000000000000',
    sessionId,
    overview: draft.overview,
    keyPoints: draft.keyPoints,
    topics: draft.topics,
    questionsDiscussed: draft.questionsDiscussed,
    actionItems: draft.actionItems,
    importantInsights: draft.importantInsights,
    quotes: draft.quotes ?? [],
    createdAt: now,
    updatedAt: now,
  };
}

function recordToSummary(notes: SummaryRecord): SessionSummary {
  return {
    overview: notes.overview ?? '',
    keyPoints: notes.keyPoints,
    topics: notes.topics,
    questionsDiscussed: notes.questionsDiscussed,
    actionItems: notes.actionItems,
    importantInsights: notes.importantInsights,
    quotes: notes.quotes,
  };
}

interface SessionWorkspaceProps {
  sessionId: string;
  sessionTitle: string;
  hasTranscript: boolean;
  /** True when an opt-in AI summary already exists. */
  hasSummary: boolean;
  /** True when capture notes exist (notes modes / notes pipeline). */
  hasNotes?: boolean;
  notesOnly?: boolean;
  initialTab?: SessionTabKey;
  currentTimeSec?: number;
  onSeekMs?: (startMs: number) => void;
  onContentLoaded?: (content: {
    summary: SummaryRecord | null;
    transcript: Transcript | null;
    notes?: SummaryRecord | null;
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
  hasNotes = false,
  notesOnly = false,
  initialTab = 'notes',
  currentTimeSec = 0,
  onSeekMs,
  onContentLoaded,
}: SessionWorkspaceProps) {
  const { colors } = useTheme();
  const router = useRouter();
  const [tab, setTab] = useState<SessionTabKey>(initialTab);
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [notes, setNotes] = useState<SummaryRecord | null>(null);
  const [summary, setSummary] = useState<SummaryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [translateLanguage, setTranslateLanguage] = useState<TranslateLanguage | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [summaryCache, setSummaryCache] = useState<SummaryCache>({});
  const [notesCache, setNotesCache] = useState<SummaryCache>({});
  const [transcriptCache, setTranscriptCache] = useState<TranscriptCache>({});
  const [feedback, setFeedback] = useState<SessionFeedback>({
    summary: null,
    transcript: null,
  });
  const [feedbackBusy, setFeedbackBusy] = useState(false);
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [summaryReady, setSummaryReady] = useState(false);
  const [translateSheetOpen, setTranslateSheetOpen] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  /** False when notes are local-draft only (finalize never landed on the server). */
  const [notesPersisted, setNotesPersisted] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [draftBullets, setDraftBullets] = useState<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nextTranscript, remoteNotes, nextSummary, nextFeedback] = await Promise.all([
        hasTranscript ? getTranscript(sessionId).catch(() => null) : Promise.resolve(null),
        getSessionNotes(sessionId).catch(() => null),
        getSummary(sessionId).catch(() => null),
        getSessionFeedback(sessionId).catch(() => ({ summary: null, transcript: null })),
      ]);

      let nextNotes = remoteNotes;
      let persisted = Boolean(remoteNotes);
      if (!nextNotes) {
        const draft = await readNotesDraft(sessionId);
        if (draft && (draft.keyPoints.length > 0 || draft.overview?.trim())) {
          nextNotes = draftAsRecord(sessionId, draft);
          persisted = false;
        }
      } else if (nextNotes) {
        void clearNotesDraft(sessionId);
        persisted = true;
      }

      setTranscript(nextTranscript);
      setNotes(nextNotes);
      setNotesPersisted(persisted);
      setSummary(nextSummary);
      setFeedback(nextFeedback);
      setSummaryCache({});
      setNotesCache({});
      setTranscriptCache({});
      setTranslateLanguage(null);
      setTranslateError(null);
      onContentLoaded?.({
        summary: nextSummary,
        transcript: nextTranscript,
        notes: nextNotes,
      });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Could not load session content.');
    } finally {
      setLoading(false);
    }
  }, [hasTranscript, notesOnly, onContentLoaded, sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Live notes: retry GET briefly if the first paint raced finalize / cold API.
  useEffect(() => {
    if (!notesOnly || loading || notesPersisted) return;
    let cancelled = false;
    let attempts = 0;
    const timer = setInterval(() => {
      attempts += 1;
      void (async () => {
        const remote = await getSessionNotes(sessionId).catch(() => null);
        if (cancelled || !remote) {
          if (attempts >= 8) clearInterval(timer);
          return;
        }
        setNotes(remote);
        setNotesPersisted(true);
        void clearNotesDraft(sessionId);
        onContentLoaded?.({
          summary: null,
          transcript: null,
          notes: remote,
        });
        clearInterval(timer);
      })();
    }, 1500);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [loading, notesOnly, notesPersisted, onContentLoaded, sessionId]);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  useEffect(() => {
    if (
      notesOnly &&
      (tab === 'transcript' || tab === 'ask' || tab === 'actions' || tab === 'summary' || tab === 'map')
    ) {
      setTab('notes');
    }
  }, [notesOnly, tab]);

  useEffect(() => {
    if (tab === 'actions') setTab('notes');
  }, [tab]);

  useEffect(() => {
    if (tab === 'summary' && !summary) {
      setTab('notes');
    }
  }, [summary, tab]);

  const canTranslate =
    (tab === 'summary' && Boolean(summary)) ||
    (tab === 'notes' && (Boolean(notes) || Boolean(transcript))) ||
    (tab === 'map' && Boolean(summary)) ||
    (tab === 'transcript' && Boolean(transcript));

  /** Saved or drafted notes win over raw transcript bullets on every capture mode. */
  const notesTabUsesSavedNotes = notesOnly || Boolean(notes);

  const ensureTranslation = useCallback(
    async (language: TranslateLanguage): Promise<boolean> => {
      const usingTranscript =
        tab === 'transcript' ||
        (tab === 'notes' && Boolean(transcript) && !notesTabUsesSavedNotes);
      const scope = usingTranscript ? ('transcript' as const) : ('summary' as const);
      const summaryKind =
        scope === 'summary'
          ? tab === 'notes'
            ? ('notes' as const)
            : ('ai_summary' as const)
          : undefined;

      if (scope === 'summary' && summaryKind === 'notes' && notesCache[language]) return true;
      if (scope === 'summary' && summaryKind === 'ai_summary' && summaryCache[language]) return true;
      if (scope === 'transcript' && transcriptCache[language]) return true;

      setTranslating(true);
      setTranslateError(null);
      try {
        const result = await translateSessionContent(sessionId, language, scope, summaryKind);
        if (scope === 'summary' && result.summary) {
          if (summaryKind === 'notes') {
            setNotesCache((prev) => ({ ...prev, [language]: result.summary! }));
          } else {
            setSummaryCache((prev) => ({ ...prev, [language]: result.summary! }));
          }
        }
        if (scope === 'transcript' && result.transcript) {
          setTranscriptCache((prev) => ({ ...prev, [language]: result.transcript! }));
        }
        return true;
      } catch (err) {
        setTranslateError(
          err instanceof ApiClientError
            ? err.message
            : 'Could not translate. Check that the API has ANTHROPIC_API_KEY set.',
        );
        setTranslateLanguage(null);
        return false;
      } finally {
        setTranslating(false);
      }
    },
    [notesCache, notesTabUsesSavedNotes, sessionId, summaryCache, tab, transcript, transcriptCache],
  );

  async function onSelectLanguage(language: TranslateLanguage | null) {
    setTranslateLanguage(language);
    setTranslateError(null);
  }

  async function onDemandTranslate(language: TranslateLanguage) {
    setTranslateError(null);
    setTranslateLanguage(language);
    await ensureTranslation(language);
  }

  async function onProceedTranslateNotes(language: TranslateLanguage | null) {
    setTranslateError(null);
    if (!language) {
      setTranslateLanguage(null);
      setTranslateSheetOpen(false);
      return;
    }
    setTranslateLanguage(language);
    const ok = await ensureTranslation(language);
    if (ok) setTranslateSheetOpen(false);
  }

  async function onSaveNotes() {
    if (!notes) return;
    setSavingNotes(true);
    setTranslateError(null);
    try {
      const payload = recordToSummary(notes);
      await finalizeSessionNotes(sessionId, payload);
      await writeNotesDraft(sessionId, payload);
      setNotesCache({});
      const remote = await getSessionNotes(sessionId).catch(() => null);
      if (remote) {
        setNotes(remote);
        setNotesPersisted(true);
        void clearNotesDraft(sessionId);
        onContentLoaded?.({ summary, transcript: null, notes: remote });
      } else {
        // Finalize succeeded but GET raced — treat as saved so Save can hide.
        setNotesPersisted(true);
        onContentLoaded?.({
          summary,
          transcript: null,
          notes: draftAsRecord(sessionId, payload),
        });
      }
    } catch (err) {
      setTranslateError(
        err instanceof ApiClientError ? err.message : 'Could not save notes. Try again.',
      );
    } finally {
      setSavingNotes(false);
    }
  }

  function onStartEditNotes() {
    const source = noteBullets.length > 0 ? noteBullets : [''];
    setDraftBullets(source);
    setEditingNotes(true);
    setTranslateError(null);
  }

  function onCancelEditNotes() {
    setEditingNotes(false);
    setDraftBullets([]);
  }

  async function onDoneEditNotes() {
    const cleaned = draftBullets.map((line) => line.trim()).filter(Boolean);
    if (cleaned.length === 0) {
      setTranslateError('Add at least one note line before saving.');
      return;
    }

    setSavingNotes(true);
    setTranslateError(null);
    try {
      const base = notes
        ? recordToSummary(notes)
        : {
            overview: '',
            keyPoints: [] as string[],
            topics: [] as SessionSummary['topics'],
            questionsDiscussed: [] as string[],
            actionItems: [] as SessionSummary['actionItems'],
            importantInsights: [] as string[],
            quotes: [] as string[],
          };
      const payload: SessionSummary = {
        ...base,
        keyPoints: cleaned,
        overview: cleaned.join(' '),
      };
      await finalizeSessionNotes(sessionId, payload);
      await writeNotesDraft(sessionId, payload);
      setNotesCache({});
      const remote = await getSessionNotes(sessionId).catch(() => null);
      const next = remote ?? draftAsRecord(sessionId, payload);
      setNotes(next);
      setNotesPersisted(true);
      if (remote) void clearNotesDraft(sessionId);
      setEditingNotes(false);
      setDraftBullets([]);
      onContentLoaded?.({
        summary,
        transcript: notesOnly ? null : transcript,
        notes: next,
      });
    } catch (err) {
      setTranslateError(
        err instanceof ApiClientError ? err.message : 'Could not save notes. Try again.',
      );
    } finally {
      setSavingNotes(false);
    }
  }

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

  async function onGenerateSummary() {
    if (!(await ensureFeatureAccess('summary', router))) return;
    setGeneratingSummary(true);
    setSummaryReady(false);
    setTranslateError(null);
    try {
      await startSummarization(sessionId);
      await consumeFeature('summary');
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            const status = await getSessionStatus(sessionId);
            if (status.hasSummary) {
              if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
              }
              const next = await getSummary(sessionId);
              setSummary(next);
              setGeneratingSummary(false);
              setSummaryReady(true);
              onContentLoaded?.({ summary: next, transcript, notes });
            } else if (status.status === 'failed') {
              if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
              }
              setGeneratingSummary(false);
              setTranslateError('Summary generation failed. Try again.');
            }
          } catch {
            // Keep polling briefly through transient errors.
          }
        })();
      }, 2000);
    } catch (err) {
      setGeneratingSummary(false);
      setTranslateError(
        err instanceof ApiClientError ? err.message : 'Could not start summary generation.',
      );
    }
  }

  const displayNotes = useMemo(() => {
    if (!notes) return null;
    if (!translateLanguage || tab !== 'notes' || !notesTabUsesSavedNotes) return notes;
    const translated = notesCache[translateLanguage];
    return translated ? applyTranslatedSummary(notes, translated) : notes;
  }, [notes, notesCache, notesTabUsesSavedNotes, tab, translateLanguage]);

  const displaySummary = useMemo(() => {
    if (!summary) return null;
    if (!translateLanguage || tab === 'notes') return summary;
    const translated = summaryCache[translateLanguage];
    return translated ? applyTranslatedSummary(summary, translated) : summary;
  }, [summary, summaryCache, tab, translateLanguage]);

  const displayTranscript = useMemo(() => {
    if (!transcript) return null;
    if (!translateLanguage) return transcript;
    // Notes tab (non-notes modes) and Transcript tab both show translated transcript text.
    if (tab !== 'notes' && tab !== 'transcript') return transcript;
    const translated = transcriptCache[translateLanguage];
    if (!translated) return transcript;
    return {
      ...transcript,
      text: translated.text,
      segments: translated.segments,
    };
  }, [tab, transcript, transcriptCache, translateLanguage]);

  const noteBullets = useMemo(() => {
    if (notesTabUsesSavedNotes && displayNotes) {
      return bulletsFromNotes(displayNotes);
    }
    const text = !notesOnly ? displayTranscript?.text?.trim() : '';
    if (text) return splitIntoSentences(text);
    return displayNotes ? bulletsFromNotes(displayNotes) : [];
  }, [displayNotes, displayTranscript, notesOnly, notesTabUsesSavedNotes]);

  const structureForActions = displaySummary ?? (notesOnly ? displayNotes : null);
  const showGenerate =
    !notesOnly &&
    !summary &&
    !generatingSummary &&
    (Boolean(notes) || Boolean(transcript) || hasNotes || hasTranscript);

  const notesTranslatedLanguages = useMemo(() => {
    const usingTranscript = Boolean(transcript) && !notesTabUsesSavedNotes;
    const cache = usingTranscript ? transcriptCache : notesCache;
    return (Object.keys(cache) as TranslateLanguage[]).filter((code) => Boolean(cache[code]));
  }, [notesCache, notesTabUsesSavedNotes, transcript, transcriptCache]);

  const transcriptTranslatedLanguages = useMemo(
    () =>
      (Object.keys(transcriptCache) as TranslateLanguage[]).filter((code) =>
        Boolean(transcriptCache[code]),
      ),
    [transcriptCache],
  );

  const summaryTranslatedLanguages = useMemo(
    () =>
      (Object.keys(summaryCache) as TranslateLanguage[]).filter((code) =>
        Boolean(summaryCache[code]),
      ),
    [summaryCache],
  );

  return (
    <View style={styles.wrap}>
      <SessionTabs
        value={tab}
        onChange={setTab}
        notesOnly={notesOnly}
        hasAiSummary={notesOnly ? false : Boolean(summary) || hasSummary}
        onTranslatePress={
          notesOnly && !loading && !error
            ? () => setTranslateSheetOpen(true)
            : undefined
        }
        translateBusy={translating}
        translateDisabled={translating || !notes || noteBullets.length === 0}
      />

      {!loading && !error && canTranslate && tab === 'transcript' ? (
        <TranslateOnDemand
          activeLanguage={translateLanguage}
          availableLanguages={transcriptTranslatedLanguages}
          busy={translating}
          onSelectCached={(language) => void onSelectLanguage(language)}
          onTranslate={(language) => void onDemandTranslate(language)}
        />
      ) : null}

      {!loading && !error && canTranslate && (tab === 'summary' || tab === 'map') ? (
        <TranslateOnDemand
          activeLanguage={translateLanguage}
          availableLanguages={summaryTranslatedLanguages}
          busy={translating}
          onSelectCached={(language) => void onSelectLanguage(language)}
          onTranslate={(language) => void onDemandTranslate(language)}
        />
      ) : null}

      {translateError ? (
        <Text style={[styles.translateError, { color: colors.danger }]} accessibilityRole="alert">
          {translateError}
        </Text>
      ) : null}

      {generatingSummary ? <SummaryGeneratingBanner /> : null}

      {summaryReady ? (
        <CompletionBanner
          heading="Summary ready"
          body="Your AI Summary finished writing."
          primaryLabel="View summary"
          onOpen={() => {
            setSummaryReady(false);
            setTab('summary');
          }}
          onDismiss={() => setSummaryReady(false)}
        />
      ) : null}

      {loading ? <SessionContentSkeleton /> : null}

      {!loading && error ? (
        <ErrorState title="Couldn’t load content" description={error} onRetry={() => void load()} />
      ) : null}

      {!loading && !error && tab === 'notes' ? (
        <View style={styles.stack}>
          {noteBullets.length > 0 || editingNotes ? (
            <>
              <NotesLanguageToggle
                activeLanguage={translateLanguage}
                availableLanguages={notesTranslatedLanguages}
                onSelect={(language) => {
                  setTranslateLanguage(language);
                  setTranslateError(null);
                }}
              />
              <PaperNotesView
                bullets={editingNotes ? draftBullets : noteBullets}
                emptyLabel="No notes yet."
                editable={!translateLanguage}
                editing={editingNotes}
                saving={savingNotes}
                onEditPress={onStartEditNotes}
                onChangeBullets={setDraftBullets}
                onDoneEditing={() => void onDoneEditNotes()}
                onCancelEditing={onCancelEditNotes}
              />
              {notesOnly && !notesPersisted && !editingNotes ? (
                <Button
                  label={savingNotes ? 'Saving…' : 'Save'}
                  onPress={() => void onSaveNotes()}
                  loading={savingNotes}
                  disabled={savingNotes || !notes}
                />
              ) : null}
              {!notesOnly && !editingNotes ? (
                <Button
                  label={translating ? 'Translating…' : 'Translate'}
                  onPress={() => setTranslateSheetOpen(true)}
                  variant="secondary"
                  loading={translating}
                  disabled={translating}
                />
              ) : null}
              {showGenerate && !editingNotes ? (
                <Button
                  label="Generate summary"
                  onPress={() => void onGenerateSummary()}
                  variant="secondary"
                />
              ) : null}
            </>
          ) : (
            <>
              <Text style={[styles.empty, { color: colors.inkMuted }]}>
                {notesOnly
                  ? 'Notes aren’t ready yet. Finish recording, or tap the pencil to write them.'
                  : 'No notes yet. Tap the pencil to write them, or open Processing to transcribe.'}
              </Text>
              <PaperNotesView
                bullets={[]}
                emptyLabel="No notes yet — tap the pencil to add some."
                editable={!translateLanguage}
                editing={false}
                onEditPress={onStartEditNotes}
              />
              {notesOnly && notes && !notesPersisted ? (
                <Button
                  label={savingNotes ? 'Saving…' : 'Save'}
                  onPress={() => void onSaveNotes()}
                  loading={savingNotes}
                  disabled={savingNotes}
                />
              ) : null}
              {showGenerate ? (
                <Button
                  label="Generate summary"
                  onPress={() => void onGenerateSummary()}
                />
              ) : null}
            </>
          )}
        </View>
      ) : null}

      <TranslateLanguageSheet
        visible={translateSheetOpen}
        activeLanguage={translateLanguage}
        busy={translating}
        onClose={() => {
          if (!translating) setTranslateSheetOpen(false);
        }}
        onProceed={(language) => void onProceedTranslateNotes(language)}
      />

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
            Summary isn’t ready yet. Tap Generate summary from the Notes tab.
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
                      onContentLoaded?.({ summary, transcript: updated, notes });
                    }
              }
            />
            <ContentFeedback
              label="Was this transcript helpful?"
              value={feedback.transcript}
              busy={feedbackBusy}
              onChange={(rating) => void onFeedbackChange('transcript', rating)}
            />
            {showGenerate ? (
              <View style={styles.generatePad}>
                <Button
                  label="Generate summary"
                  onPress={() => void onGenerateSummary()}
                  variant="secondary"
                />
              </View>
            ) : null}
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

      {!loading && !error && tab === 'map' ? (
        structureForActions ? (
          <MindMapView summary={structureForActions} sessionTitle={sessionTitle} />
        ) : (
          <Text style={[styles.empty, { color: colors.inkMuted }]}>
            Mind map appears after notes are ready.
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
  stack: {
    gap: spacing.md,
  },
  generatePad: {
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
