import { useCallback, useRef, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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
import { FLOATING_TAB_BAR_CONTENT_INSET } from '@/src/components/FloatingTabBar';
import { UploadProgress } from '@/src/components/UploadProgress';
import { Button } from '@/src/components/ui/Button';
import { Icon } from '@/src/components/ui/Icon';
import { ApiClientError } from '@/src/services/api';
import { getSignedAudioUrl, uploadSessionAudio } from '@/src/services/audio-upload';
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
import { formatDurationHuman, formatSessionDate } from '@/src/utils/format';
import { shareSessionContent } from '@/src/utils/share-session';
import type { SummaryRecord, Transcript } from '@sessionai/shared';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function SessionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors, shadows } = useTheme();
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
  const [shareSummary, setShareSummary] = useState<SummaryRecord | null>(null);
  const [shareTranscript, setShareTranscript] = useState<Transcript | null>(null);
  const seekIdRef = useRef(0);

  const runUploadAndProcess = useCallback(
    async (sessionId: string, uri: string) => {
      setProceeding(true);
      setUploadStatus('uploading');
      setUploadProgress(0);
      setUploadMessage(undefined);
      try {
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
          return;
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
        } catch {
          setPlaybackUri(uri);
        }

        router.push(`/session/${sessionId}/processing`);
      } catch (err) {
        setUploadStatus('error');
        setUploadMessage(
          err instanceof ApiClientError
            ? err.message
            : 'Upload failed. Your local recording is still saved.',
        );
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
    (content: { summary: SummaryRecord | null; transcript: Transcript | null }) => {
      setShareSummary(content.summary);
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
  const canRecord = !localUri && !session.audioPath;
  const canImport = !session.audioPath;
  const hasLocalDraft = Boolean(localUri) && !session.audioPath;
  const hasPlayback = Boolean(playbackUri);
  const notesOnly = isNotesOnlyCaptureMode(session.captureMode);
  const showWorkspace =
    session.status === 'completed' ||
    session.status === 'transcribed' ||
    session.status === 'summarizing' ||
    session.status === 'transcribing';
  const hasTranscript =
    !notesOnly &&
    (session.status === 'transcribed' ||
      session.status === 'summarizing' ||
      session.status === 'completed');
  const hasSummary = session.status === 'completed';
  const currentFolder = folders.find((folder) => folder.id === session.folderId) ?? null;
  const statusColor = completed ? colors.success : failed ? colors.danger : colors.accent;
  const statusLabel = SESSION_STATUS_LABELS[session.status];

  return (
    <>
      <Stack.Screen options={{ title: session.title }} />
      <ScrollView
        contentContainerStyle={[styles.container, { backgroundColor: colors.background }]}
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
          <Text style={[styles.title, { color: colors.ink }]} accessibilityRole="header">
            {session.title}
          </Text>
          <Text style={[styles.metaLine, { color: colors.inkMuted }]}>
            {SESSION_TYPE_LABELS[session.sessionType]}
            {' · '}
            {formatSessionDate(session.recordedAt)}
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
              color={session.favoritedAt ? colors.warning : colors.ink}
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
            <Icon name="share-variant-outline" size={22} />
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
            <Icon name="folder" size={20} />
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
            <Icon name="pencil" size={20} />
          </Pressable>
          <Pressable
            style={[
              styles.toolBtn,
              {
                backgroundColor: colors.actionRecord,
                borderColor: colors.danger,
              },
              shadows.soft,
            ]}
            onPress={onDelete}
            disabled={deleting}
            accessibilityRole="button"
            accessibilityLabel="Delete session"
          >
            <Icon name="close" size={20} color={colors.danger} />
          </Pressable>
        </View>

        <View style={styles.body}>
          {hasLocalDraft ? (
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

              <Button
                label={proceeding ? 'Uploading…' : 'Upload & process'}
                onPress={() => {
                  if (!localUri || !id) return;
                  void runUploadAndProcess(String(id), localUri);
                }}
                loading={proceeding}
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
            </View>
          ) : null}

          {!hasLocalDraft && session.audioPath && uploadStatus === 'error' ? (
            <UploadProgress
              progress={uploadProgress}
              status={uploadStatus}
              message={uploadMessage}
            />
          ) : null}

          {!hasLocalDraft && hasPlayback && showPlayer && playbackUri ? (
            <AudioPlayer
              uri={playbackUri}
              title={session.title}
              variant="dock"
              onProgress={setPlaybackTimeSec}
              seekRequest={seekRequest}
            />
          ) : null}

          {!hasLocalDraft && hasPlayback && !showPlayer ? (
            <Button label="Play recording" onPress={() => setShowPlayer(true)} variant="secondary" />
          ) : null}

          {!hasLocalDraft && !hasPlayback && !canRecord ? (
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

          {session.audioPath ? (
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
                    {completed
                      ? 'Finished — view pipeline'
                      : session.status === 'transcribing' || session.status === 'summarizing'
                        ? 'In progress'
                        : failed
                          ? 'Failed — tap to retry'
                          : 'Transcribe and summarize'}
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
              notesOnly={notesOnly}
              initialTab={hasSummary || notesOnly ? 'summary' : 'transcript'}
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
  },
  container: {
    padding: spacing.lg,
    gap: spacing.lg,
    paddingBottom: FLOATING_TAB_BAR_CONTENT_INSET,
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
