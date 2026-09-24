import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  SESSION_STATUS_LABELS,
  SESSION_TYPE_LABELS,
  isNotesOnlyCaptureMode,
  type Session,
  type SessionFolder,
} from '@sessionai/shared';
import { AudioPlayer } from '@/src/components/AudioPlayer';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingState } from '@/src/components/LoadingState';
import { SessionWorkspace } from '@/src/components/SessionWorkspace';
import { FolderPicker } from '@/src/components/FolderPicker';
import { useFloatingTabBarContentInset } from '@/src/components/FloatingTabBar';
import { UploadProgress } from '@/src/components/UploadProgress';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { ApiClientError } from '@/src/services/api';
import { getSignedAudioUrl, uploadSessionAudio } from '@/src/services/audio-upload';
import { fetchUploadLimits } from '@/src/services/fetch-upload-limits';
import { durationLimitError } from '@/src/services/upload-limits';
import {
  clearLocalAudioUri,
  getLocalAudioUri,
  isLocalAudioReadable,
  saveLocalAudioUri,
} from '@/src/services/local-audio';
import { pickAudioFile } from '@/src/services/pick-audio';
import { getRecordCaptionsModePref } from '@/src/services/record-mode';
import { listFolders } from '@/src/services/folders';
import { deleteSession, getSession, updateSession } from '@/src/services/sessions';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { confirmAction, confirmDestructive } from '@/src/utils/confirm';
import { formatDurationHuman, formatSessionDateTime } from '@/src/utils/format';
import { shareSessionContent } from '@/src/utils/share-session';
import type { SummaryRecord, Transcript } from '@sessionai/shared';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function SessionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, shadows } = useTheme();
  const tabBarInset = useFloatingTabBarContentInset();
  const [session, setSession] = useState<Session | null>(null);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [playbackUri, setPlaybackUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadMessage, setUploadMessage] = useState<string | undefined>(undefined);
  const [proceeding, setProceeding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [playbackTimeSec, setPlaybackTimeSec] = useState(0);
  const [seekRequest, setSeekRequest] = useState<{ id: number; sec: number } | null>(null);
  const [favoriting, setFavoriting] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [folders, setFolders] = useState<SessionFolder[]>([]);
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [movingFolder, setMovingFolder] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [savingTitle, setSavingTitle] = useState(false);
  const [shareSummary, setShareSummary] = useState<SummaryRecord | null>(null);
  const [shareTranscript, setShareTranscript] = useState<Transcript | null>(null);
  const [workspaceHasSummary, setWorkspaceHasSummary] = useState(false);
  const [workspaceHasNotes, setWorkspaceHasNotes] = useState(false);
  const seekIdRef = useRef(0);
  const localDurationRef = useRef<number | null>(null);
  const [localDurationSec, setLocalDurationSec] = useState<number | null>(null);
  const handleDuration = useCallback((sec: number) => {
    localDurationRef.current = sec;
    setLocalDurationSec(sec);
  }, []);
  const liveNotesUploadRef = useRef(false);

  const runUploadAndProcess = useCallback(
    async (sessionId: string, uri: string, options?: { skipProcessing?: boolean }): Promise<boolean> => {
      setProceeding(true);
      setUploadStatus('uploading');
      setUploadProgress(0);
      setUploadMessage(undefined);
      try {
        await fetchUploadLimits();
        const tooLong = durationLimitError(localDurationRef.current);
        if (tooLong) {
          setUploadStatus('error');
          setUploadMessage(tooLong);
          return false;
        }

        const readable = await isLocalAudioReadable(uri);
        if (!readable) {
          await clearLocalAudioUri(sessionId);
          setLocalUri(null);
          setPlaybackUri(null);
          setShowPlayer(false);
          setUploadStatus('error');
          setUploadMessage(
            'Local recording is no longer available in this browser. Please record again.',
          );
          return false;
        }

        await uploadSessionAudio(sessionId, uri, (progress) => {
          setUploadProgress(progress.ratio);
        });
        await clearLocalAudioUri(sessionId);
        const refreshed = await getSession(sessionId);
        setSession(refreshed);
        setLocalUri(null);
        setUploadStatus('success');
        setUploadProgress(1);

        try {
          const signed = await getSignedAudioUrl(sessionId);
          setPlaybackUri(signed.url);
          setShowPlayer(true);
        } catch {
          setPlaybackUri(uri);
          setShowPlayer(true);
        }

        if (!options?.skipProcessing) {
          router.push(`/session/${sessionId}/processing`);
        }
        return true;
      } catch (err) {
        setUploadStatus('error');
        setUploadMessage(
          err instanceof ApiClientError
            ? err.message
            : 'Upload failed. Your local recording is still saved.',
        );
        return false;
      } finally {
        setProceeding(false);
      }
    },
    [router],
  );

  const onReRecord = useCallback(() => {
    if (!id || typeof id !== 'string') return;
    void (async () => {
      const ok = await confirmAction(
        'Re-record this session?',
        'The current local take will be discarded. Cloud audio (if already uploaded) is kept until you upload a new recording.',
        'Re-record',
        { destructive: true },
      );
      if (!ok) return;
      await clearLocalAudioUri(id);
      setLocalUri(null);
      setPlaybackUri(null);
      setShowPlayer(false);
      setUploadStatus('idle');
      setUploadMessage(undefined);
      const captions = await getRecordCaptionsModePref();
      router.push(`/recording?id=${id}&captions=${captions}`);
    })();
  }, [id, router]);

  const onImportAudio = useCallback(async () => {
    if (!id || typeof id !== 'string' || !session || session.audioPath) return;
    setImporting(true);
    setError(null);
    try {
      const picked = await pickAudioFile();
      if (!picked) return;
      const stored = await saveLocalAudioUri(id, picked.uri);
      setLocalUri(stored);
      setPlaybackUri(stored);
      setShowPlayer(true);
      setUploadStatus('idle');
      setUploadMessage(undefined);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not import media. Try another file or record instead.',
      );
    } finally {
      setImporting(false);
    }
  }, [id, session]);

  const onDelete = useCallback(() => {
    if (!id || typeof id !== 'string' || !session) return;
    void (async () => {
      const ok = await confirmDestructive(
        'Delete session?',
        `“${session.title}” and its transcript/summary will be permanently removed.`,
      );
      if (!ok) return;
      setDeleting(true);
      try {
        await deleteSession(id);
        await clearLocalAudioUri(id);
        router.replace('/');
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'Could not delete this session.',
        );
      } finally {
        setDeleting(false);
      }
    })();
  }, [id, router, session]);

  const onMoveToFolder = useCallback(
    (nextFolderId: string | null) => {
      if (!id || typeof id !== 'string') return;
      setFolderPickerOpen(false);
      if ((session?.folderId ?? null) === nextFolderId) return;
      void (async () => {
        setMovingFolder(true);
        try {
          const updated = await updateSession(id, { folderId: nextFolderId });
          setSession(updated);
        } catch (err) {
          setError(
            err instanceof ApiClientError ? err.message : 'Could not move this session.',
          );
        } finally {
          setMovingFolder(false);
        }
      })();
    },
    [id, session],
  );

  const onStartTitleEdit = useCallback(() => {
    if (!session || savingTitle) return;
    setTitleDraft(session.title);
    setEditingTitle(true);
    setError(null);
  }, [savingTitle, session]);

  const onCancelTitleEdit = useCallback(() => {
    if (savingTitle) return;
    setEditingTitle(false);
    setTitleDraft('');
  }, [savingTitle]);

  const onSaveTitle = useCallback(() => {
    if (!id || typeof id !== 'string' || !session) return;
    const trimmed = titleDraft.trim();
    if (!trimmed) {
      setError('Title is required.');
      return;
    }
    if (trimmed === session.title) {
      setEditingTitle(false);
      return;
    }
    void (async () => {
      setSavingTitle(true);
      setError(null);
      try {
        const updated = await updateSession(id, { title: trimmed });
        setSession(updated);
        setEditingTitle(false);
      } catch (err) {
        setError(
          err instanceof ApiClientError ? err.message : 'Could not rename this session.',
        );
      } finally {
        setSavingTitle(false);
      }
    })();
  }, [id, session, titleDraft]);

  const onToggleFavorite = useCallback(() => {
    if (!id || typeof id !== 'string' || !session) return;
    void (async () => {
      setFavoriting(true);
      try {
        const next = await updateSession(id, {
          favoritedAt: session.favoritedAt ? null : new Date().toISOString(),
        });
        setSession(next);
      } catch (err) {
        setError(
          err instanceof ApiClientError
            ? err.message
            : 'Could not update favorite. Apply the favorites migration if needed.',
        );
      } finally {
        setFavoriting(false);
      }
    })();
  }, [id, session]);

  const onShare = useCallback(() => {
    if (!session) return;
    void (async () => {
      setSharing(true);
      try {
        await shareSessionContent({
          session,
          summary: shareSummary,
          transcript: shareTranscript,
        });
      } catch {
        setError('Could not open the share sheet.');
      } finally {
        setSharing(false);
      }
    })();
  }, [session, shareSummary, shareTranscript]);

  const onWorkspaceContent = useCallback(
    (content: {
      summary: SummaryRecord | null;
      transcript: Transcript | null;
      notes?: SummaryRecord | null;
    }) => {
      setWorkspaceHasSummary(Boolean(content.summary));
      setWorkspaceHasNotes(Boolean(content.notes));
      setShareSummary(content.summary ?? content.notes ?? null);
      setShareTranscript(content.transcript);
    },
    [],
  );

  const load = useCallback(async () => {
    if (!id || typeof id !== 'string') {
      setError('Invalid session id.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [data, uri, folderRows] = await Promise.all([
        getSession(id),
        getLocalAudioUri(id),
        listFolders().catch(() => [] as SessionFolder[]),
      ]);
      setSession(data);
      setFolders(folderRows);

      let usableUri = uri;
      if (uri && !(await isLocalAudioReadable(uri))) {
        await clearLocalAudioUri(id);
        usableUri = null;
      }
      setLocalUri(usableUri);

      if (data.audioPath) {
        setUploadStatus('success');
        setUploadProgress(1);
        try {
          const signed = await getSignedAudioUrl(id);
          setPlaybackUri(signed.url);
          setShowPlayer(true);
        } catch {
          setPlaybackUri(usableUri);
          setShowPlayer(Boolean(usableUri));
        }
      } else if (usableUri) {
        // Local draft only — wait for the user to Proceed or Re-record.
        setPlaybackUri(usableUri);
        setShowPlayer(true);
        setUploadStatus('idle');
        setUploadMessage(undefined);
      } else {
        setPlaybackUri(null);
        setShowPlayer(false);
        setUploadStatus(uri ? 'error' : 'idle');
        if (uri) {
          setUploadMessage(
            'Local recording is no longer available in this browser. Please record again.',
          );
        }
      }
    } catch (err) {
      setSession(null);
      setLocalUri(null);
      setPlaybackUri(null);
      setError(err instanceof ApiClientError ? err.message : 'Could not load this session.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Live Note Taker: notes are saved on stop — quietly upload audio (no process screen).
  useEffect(() => {
    if (!session || !id || typeof id !== 'string') return;
    if (session.captureMode !== 'live_notes') return;
    if (!localUri || session.audioPath) return;
    if (proceeding || uploadStatus === 'uploading') return;
    if (liveNotesUploadRef.current) return;
    liveNotesUploadRef.current = true;
    void (async () => {
      const ok = await runUploadAndProcess(id, localUri, { skipProcessing: true });
      if (!ok) liveNotesUploadRef.current = false;
    })();
  }, [session, id, localUri, proceeding, uploadStatus, runUploadAndProcess]);

  // Warn as soon as the local recording's length is known, before any upload.
  useEffect(() => {
    if (!localUri || localDurationSec == null) return;
    let cancelled = false;
    void fetchUploadLimits().then((limits) => {
      if (cancelled) return;
      const tooLong = durationLimitError(localDurationSec, limits);
      if (tooLong) {
        setUploadStatus('error');
        setUploadMessage(tooLong);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [localUri, localDurationSec]);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  }

  if (loading && !refreshing) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <LoadingState message="Loading session…" />
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={[styles.centered, { backgroundColor: colors.background }]}>
        <ErrorState
          title="Session unavailable"
          description={error ?? 'Session not found.'}
          onRetry={() => void load()}
        />
      </View>
    );
  }

  const completed = session.status === 'completed';
  const failed = session.status === 'failed';
  const canRecord = !completed && !localUri && !session.audioPath;
  const canImport = !completed && !session.audioPath;
  const hasLocalDraft = Boolean(localUri) && !session.audioPath;
  const isLiveNotes = session.captureMode === 'live_notes';
  /** Live notes already finalized on stop — no Upload & process review card. */
  const showProcessReview = hasLocalDraft && !isLiveNotes;
  const hasPlayback = Boolean(playbackUri);
  const notesOnly = isNotesOnlyCaptureMode(session.captureMode);
  const showWorkspace =
    session.status === 'completed' ||
    session.status === 'transcribed' ||
    session.status === 'summarizing' ||
    session.status === 'transcribing' ||
    (isLiveNotes && (workspaceHasNotes || completed));
  const hasTranscript =
    !notesOnly &&
    (session.status === 'transcribed' ||
      session.status === 'summarizing' ||
      session.status === 'completed');
  const hasSummary = workspaceHasSummary;
  const hasNotes = workspaceHasNotes || (notesOnly && completed);
  const currentFolder = folders.find((folder) => folder.id === session.folderId) ?? null;
  const statusColor = completed ? colors.success : failed ? colors.danger : colors.accent;
  const statusLabel = SESSION_STATUS_LABELS[session.status];

  return (
    <>
      <Stack.Screen options={{ title: session.title }} />
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { backgroundColor: colors.background, paddingBottom: tabBarInset },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void onRefresh()}
            tintColor={colors.accent}
          />
        }
      >
        <View style={styles.hero}>
          <View style={[styles.statusPill, { backgroundColor: colors.accentSoft }]}>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
          {editingTitle ? (
            <View style={styles.titleEdit}>
              <TextInput
                value={titleDraft}
                onChangeText={setTitleDraft}
                multiline
                autoFocus
                maxLength={200}
                editable={!savingTitle}
                placeholder="Session title"
                placeholderTextColor={colors.inkMuted}
                style={[
                  styles.title,
                  styles.titleInput,
                  {
                    color: colors.ink,
                    borderColor: colors.border,
                    backgroundColor: colors.surface,
                  },
                ]}
                accessibilityLabel="Session title"
              />
              <View style={styles.titleActions}>
                <Pressable
                  onPress={onCancelTitleEdit}
                  disabled={savingTitle}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Cancel rename"
                  style={({ pressed }) => [
                    styles.titleChip,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                      opacity: pressed || savingTitle ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.titleChipText, { color: colors.ink }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={onSaveTitle}
                  disabled={savingTitle || !titleDraft.trim()}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Save title"
                  style={({ pressed }) => [
                    styles.titleChip,
                    {
                      backgroundColor: colors.accentSoft,
                      borderColor: colors.accent,
                      opacity: pressed || savingTitle || !titleDraft.trim() ? 0.7 : 1,
                    },
                  ]}
                >
                  <Text style={[styles.titleChipText, { color: colors.accent }]}>
                    {savingTitle ? 'Saving…' : 'Done'}
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              onPress={onStartTitleEdit}
              accessibilityRole="button"
              accessibilityLabel={`Edit title, ${session.title}`}
              style={styles.titleHit}
            >
              <Text style={[styles.title, styles.titleText, { color: colors.ink }]}>
                {session.title}
              </Text>
              <View
                style={[
                  styles.titlePencil,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Icon name="edit" size={16} color={colors.ink} variant="line" />
              </View>
            </Pressable>
          )}
          <Text style={[styles.metaLine, { color: colors.inkMuted }]}>
            {SESSION_TYPE_LABELS[session.sessionType]}
            {' · '}
            {formatSessionDateTime(session.recordedAt)}
            {' · '}
            {formatDurationHuman(session.durationSeconds)}
          </Text>
          {session.description ? (
            <Text style={[styles.description, { color: colors.inkMuted }]} numberOfLines={3}>
              {session.description}
            </Text>
          ) : null}
        </View>

        <View style={styles.toolbar}>
          <Pressable
            style={[
              styles.toolBtn,
              {
                backgroundColor: session.favoritedAt ? colors.accentSoft : colors.surface,
                borderColor: session.favoritedAt ? colors.accent : colors.border,
              },
              shadows.soft,
            ]}
            onPress={onToggleFavorite}
            disabled={favoriting}
            accessibilityRole="button"
            accessibilityLabel={session.favoritedAt ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Icon
              name={session.favoritedAt ? 'star' : 'star-outline'}
              size={22}
              color={session.favoritedAt ? colors.accent : colors.ink}
              variant="line"
            />
          </Pressable>
          <Pressable
            style={[
              styles.toolBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              shadows.soft,
            ]}
            onPress={onShare}
            disabled={sharing}
            accessibilityRole="button"
            accessibilityLabel="Share session"
          >
            <Icon name="share-variant-outline" size={22} color={colors.ink} variant="line" />
          </Pressable>
          <Pressable
            style={[
              styles.folderChip,
              { backgroundColor: colors.surface, borderColor: colors.border },
              shadows.soft,
            ]}
            onPress={() => setFolderPickerOpen(true)}
            disabled={movingFolder}
            accessibilityRole="button"
            accessibilityLabel="Move to folder"
          >
            <Icon name="folder" size={20} color={colors.ink} variant="line" />
            <Text style={[styles.folderChipText, { color: colors.ink }]} numberOfLines={1}>
              {movingFolder ? 'Moving…' : currentFolder ? currentFolder.name : 'Default'}
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.toolBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              shadows.soft,
            ]}
            onPress={() => router.push(`/session/${session.id}/edit`)}
            accessibilityRole="button"
            accessibilityLabel="Edit session"
          >
            <Icon name="edit" size={20} color={colors.ink} variant="line" />
          </Pressable>
          <Pressable
            style={[
              styles.toolBtn,
              { backgroundColor: colors.surface, borderColor: colors.border },
              shadows.soft,
            ]}
            onPress={onDelete}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Delete session"
          >
            <Icon name="trash-can-outline" size={20} color={colors.danger} variant="line" />
          </Pressable>
        </View>

        <View style={styles.body}>
          {showProcessReview ? (
            <View
              style={[
                styles.reviewCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
                shadows.soft,
              ]}
            >
              <Text style={[styles.reviewTitle, { color: colors.ink }]}>Ready to process</Text>
              <Text style={[styles.reviewHint, { color: colors.inkMuted }]}>
                Preview your take, then upload to transcribe and summarize.
              </Text>

              {hasPlayback && showPlayer && playbackUri ? (
                <AudioPlayer
                  uri={playbackUri}
                  title={session.title}
                  variant="dock"
                  onProgress={setPlaybackTimeSec}
                  onDuration={handleDuration}
                  seekRequest={seekRequest}
                />
              ) : null}

              {uploadStatus === 'uploading' || uploadStatus === 'error' ? (
                <UploadProgress
                  progress={uploadProgress}
                  status={uploadStatus}
                  message={uploadMessage}
                  onRetry={
                    localUri && id
                      ? () => {
                          void runUploadAndProcess(String(id), localUri);
                        }
                      : undefined
                  }
                />
              ) : null}

              {uploadStatus !== 'uploading' ? (
                <>
                  <Button
                    label="Upload & process"
                    onPress={() => {
                      if (!localUri || !id) return;
                      void runUploadAndProcess(String(id), localUri);
                    }}
                    disabled={proceeding}
                  />
                  <Button
                    label="Re-record"
                    variant="secondary"
                    onPress={onReRecord}
                    disabled={proceeding}
                  />
                  {canImport ? (
                    <Pressable
                      onPress={() => void onImportAudio()}
                      disabled={importing || proceeding}
                      accessibilityRole="button"
                      accessibilityLabel="Import a different file"
                      style={styles.linkBtn}
                    >
                      <Text style={[styles.linkText, { color: colors.accent }]}>
                        {importing ? 'Importing…' : 'Or import a different file'}
                      </Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}

          {isLiveNotes && hasLocalDraft && (uploadStatus === 'uploading' || uploadStatus === 'error') ? (
            <UploadProgress
              progress={uploadProgress}
              status={uploadStatus}
              message={uploadMessage ?? (uploadStatus === 'uploading' ? 'Saving audio…' : undefined)}
              onRetry={
                localUri && id && uploadStatus === 'error'
                  ? () => {
                      liveNotesUploadRef.current = false;
                      void runUploadAndProcess(String(id), localUri, { skipProcessing: true });
                    }
                  : undefined
              }
            />
          ) : null}

          {!showProcessReview && hasPlayback && showPlayer && playbackUri ? (
            <AudioPlayer
              uri={playbackUri}
              title={session.title}
              variant="dock"
              onProgress={setPlaybackTimeSec}
              onDuration={handleDuration}
              seekRequest={seekRequest}
            />
          ) : null}

          {!showProcessReview && hasPlayback && !showPlayer ? (
            <Button label="Play recording" onPress={() => setShowPlayer(true)} variant="secondary" />
          ) : null}

          {!showProcessReview && !hasPlayback && !canRecord && !completed && !isLiveNotes ? (
            <Text style={[styles.hint, { color: colors.inkMuted }]}>No recording available yet.</Text>
          ) : null}

          {canRecord ? (
            <View style={styles.captureRow}>
              <View style={styles.captureHalf}>
                <Button
                  label="Record"
                  onPress={() => {
                    void getRecordCaptionsModePref().then((captions) => {
                      router.push(`/recording?id=${session.id}&captions=${captions}`);
                    });
                  }}
                />
              </View>
              {canImport ? (
                <View style={styles.captureHalf}>
                  <Button
                    label={importing ? 'Importing…' : 'Import'}
                    variant="secondary"
                    onPress={() => void onImportAudio()}
                    disabled={importing}
                    loading={importing}
                  />
                </View>
              ) : null}
            </View>
          ) : null}

          {!hasLocalDraft && !canRecord && canImport ? (
            <Button
              label={importing ? 'Importing…' : 'Import audio or video'}
              variant="secondary"
              onPress={() => void onImportAudio()}
              disabled={importing}
              loading={importing}
            />
          ) : null}

          {session.audioPath && !isLiveNotes && !completed ? (
            <View style={styles.pipelineBlock}>
              <Pressable
                onPress={() => router.push(`/session/${session.id}/processing`)}
                style={[
                  styles.pipelineCard,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
                accessibilityRole="button"
                accessibilityLabel="View processing"
              >
                <View style={[styles.pipelineMark, { backgroundColor: colors.actionSettings }]}>
                  <Icon name="sine-wave" size={24} />
                </View>
                <View style={styles.pipelineBody}>
                  <Text style={[styles.pipelineTitle, { color: colors.ink }]}>Processing</Text>
                  <Text style={[styles.pipelineHint, { color: colors.inkMuted }]}>
                    {session.status === 'transcribing' || session.status === 'summarizing'
                      ? 'In progress'
                      : failed
                        ? 'Failed — tap to retry'
                        : session.status === 'transcribed'
                          ? 'Transcript ready'
                          : 'Transcribe audio'}
                  </Text>
                </View>
                <Icon name="chevron-right" size={16} color={colors.inkMuted} />
              </Pressable>
              {failed ? (
                <Button
                  label={deleting ? 'Deleting…' : 'Delete recording'}
                  variant="danger"
                  onPress={onDelete}
                  disabled={deleting}
                  loading={deleting}
                />
              ) : null}
            </View>
          ) : null}

          {showWorkspace ? (
            <SessionWorkspace
              sessionId={session.id}
              sessionTitle={session.title}
              hasTranscript={hasTranscript}
              hasSummary={hasSummary}
              hasNotes={hasNotes}
              notesOnly={notesOnly}
              initialTab="notes"
              currentTimeSec={playbackTimeSec}
              onContentLoaded={onWorkspaceContent}
              onSeekMs={(startMs) => {
                seekIdRef.current += 1;
                setSeekRequest({ id: seekIdRef.current, sec: startMs / 1000 });
                setShowPlayer(true);
              }}
            />
          ) : null}
        </View>
      </ScrollView>

      <FolderPicker
        visible={folderPickerOpen}
        folders={folders}
        selectedId={currentFolder ? currentFolder.id : null}
        onSelect={onMoveToFolder}
        onClose={() => setFolderPickerOpen(false)}
        allowCreate
        onFoldersChange={setFolders}
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    padding: spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.sm,
  },
  statusPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.smd,
    paddingVertical: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...typography.caption,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  title: {
    ...typography.pageTitle,
  },
  titleHit: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  titleText: {
    flex: 1,
  },
  titlePencil: {
    width: 32,
    height: 32,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  titleEdit: {
    gap: spacing.sm,
  },
  titleInput: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    minHeight: 72,
  },
  titleActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
  },
  titleChip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleChipText: {
    ...typography.caption,
    fontWeight: '700',
  },
  metaLine: {
    ...typography.meta,
  },
  description: {
    ...typography.body,
    marginTop: spacing.xs,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  toolBtn: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  folderChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 44,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
  folderChipText: {
    ...typography.caption,
    fontWeight: '700',
    flex: 1,
  },
  body: {
    gap: spacing.md,
  },
  reviewCard: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.md,
  },
  reviewTitle: {
    ...typography.section,
  },
  reviewHint: {
    ...typography.meta,
  },
  linkBtn: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  linkText: {
    ...typography.caption,
    fontWeight: '700',
  },
  captureRow: {
    flexDirection: 'row',
    gap: spacing.smd,
  },
  captureHalf: {
    flex: 1,
  },
  hint: {
    ...typography.meta,
  },
  pipelineBlock: {
    gap: spacing.sm,
  },
  pipelineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smd,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.md,
  },
  pipelineMark: {
    width: 44,
    height: 44,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pipelineBody: {
    flex: 1,
    gap: 2,
  },
  pipelineTitle: {
    ...typography.body,
    fontWeight: '600',
  },
  pipelineHint: {
    ...typography.caption,
  },
});
