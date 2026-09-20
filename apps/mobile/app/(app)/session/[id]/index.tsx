import { useCallback, useRef, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  SESSION_STATUS_LABELS,
  SESSION_TYPE_LABELS,
  type Session,
} from '@sessionai/shared';
import { AudioPlayer } from '@/src/components/AudioPlayer';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingState } from '@/src/components/LoadingState';
import { SessionWorkspace } from '@/src/components/SessionWorkspace';
import { UploadProgress } from '@/src/components/UploadProgress';
import { ApiClientError } from '@/src/services/api';
import { getSignedAudioUrl, uploadSessionAudio } from '@/src/services/audio-upload';
import {
  clearLocalAudioUri,
  getLocalAudioUri,
  isLocalAudioReadable,
} from '@/src/services/local-audio';
import { deleteSession, getSession, updateSession } from '@/src/services/sessions';
import { colors, radii, spacing, typography } from '@/src/theme';
import { formatDurationHuman, formatSessionDate } from '@/src/utils/format';
import { shareSessionContent } from '@/src/utils/share-session';
import type { SummaryRecord, Transcript } from '@sessionai/shared';

type UploadStatus = 'idle' | 'uploading' | 'success' | 'error';

export default function SessionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
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
    Alert.alert(
      'Re-record this session?',
      'The current local take will be discarded. Cloud audio (if already uploaded) is kept until you upload a new recording.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Re-record',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              await clearLocalAudioUri(id);
              setLocalUri(null);
              setPlaybackUri(null);
              setShowPlayer(false);
              setUploadStatus('idle');
              setUploadMessage(undefined);
              router.push(`/recording?id=${id}`);
            })();
          },
        },
      ],
    );
  }, [id, router]);

  const onDelete = useCallback(() => {
    if (!id || typeof id !== 'string' || !session) return;
    Alert.alert(
      'Delete session?',
      `“${session.title}” and its transcript/summary will be permanently removed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
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
          },
        },
      ],
    );
  }, [id, router, session]);

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
      const [data, uri] = await Promise.all([getSession(id), getLocalAudioUri(id)]);
      setSession(data);

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
      <View style={styles.centered}>
        <LoadingState message="Loading session…" />
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={styles.centered}>
        <ErrorState
          title="Session unavailable"
          description={error ?? 'Session not found.'}
          onRetry={() => void load()}
        />
      </View>
    );
  }

  const completed = session.status === 'completed';
  const canRecord = !localUri && !session.audioPath;
  const hasLocalDraft = Boolean(localUri) && !session.audioPath;
  const hasPlayback = Boolean(playbackUri);
  const showWorkspace =
    session.status === 'completed' ||
    session.status === 'transcribed' ||
    session.status === 'summarizing' ||
    session.status === 'transcribing';
  const hasTranscript =
    session.status === 'transcribed' ||
    session.status === 'summarizing' ||
    session.status === 'completed';
  const hasSummary = session.status === 'completed';

  return (
    <ScrollView
      contentContainerStyle={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} />}
    >
      <Text style={styles.title} accessibilityRole="header">
        {session.title}
      </Text>
      <Text style={styles.meta}>{SESSION_TYPE_LABELS[session.sessionType]}</Text>
      <Text style={styles.meta}>{formatSessionDate(session.recordedAt)}</Text>
      <Text style={styles.meta}>{formatDurationHuman(session.durationSeconds)}</Text>
      <Text
        style={[
          styles.status,
          completed ? styles.statusOk : session.status === 'failed' ? styles.statusFailed : styles.statusPending,
        ]}
      >
        {completed
          ? `✓ ${SESSION_STATUS_LABELS[session.status]}`
          : session.status === 'failed'
            ? `⚠ ${SESSION_STATUS_LABELS[session.status]}`
            : SESSION_STATUS_LABELS[session.status]}
      </Text>

      {session.description ? <Text style={styles.description}>{session.description}</Text> : null}

      <View style={styles.manageRow}>
        <Pressable
          style={[styles.manageButton, session.favoritedAt ? styles.favoriteOn : null]}
          onPress={onToggleFavorite}
          disabled={favoriting}
          accessibilityRole="button"
          accessibilityLabel={session.favoritedAt ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Text
            style={[
              styles.manageButtonText,
              session.favoritedAt ? styles.favoriteOnText : null,
            ]}
          >
            {favoriting ? '…' : session.favoritedAt ? '★ Favorited' : '☆ Favorite'}
          </Text>
        </Pressable>
        <Pressable
          style={styles.manageButton}
          onPress={onShare}
          disabled={sharing}
          accessibilityRole="button"
          accessibilityLabel="Share session"
        >
          <Text style={styles.manageButtonText}>{sharing ? 'Sharing…' : 'Share'}</Text>
        </Pressable>
        <Pressable
          style={styles.manageButton}
          onPress={() => router.push(`/session/${session.id}/edit`)}
          accessibilityRole="button"
          accessibilityLabel="Edit session"
        >
          <Text style={styles.manageButtonText}>Edit</Text>
        </Pressable>
        <Pressable
          style={[styles.manageButton, styles.dangerButton]}
          onPress={onDelete}
          disabled={deleting}
          accessibilityRole="button"
          accessibilityLabel="Delete session"
        >
          <Text style={[styles.manageButtonText, styles.dangerButtonText]}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.actions}>
        {hasLocalDraft ? (
          <View style={styles.reviewBox}>
            <Text style={styles.reviewTitle}>Recording ready</Text>
            <Text style={styles.reviewHint}>
              Listen to your take, then upload & process it — or discard and record again.
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

            <Pressable
              style={[styles.primaryButton, proceeding && styles.buttonDisabled]}
              disabled={proceeding}
              onPress={() => {
                if (!localUri || !id) return;
                void runUploadAndProcess(String(id), localUri);
              }}
              accessibilityRole="button"
              accessibilityLabel="Proceed — upload and process"
            >
              <Text style={styles.primaryButtonText}>
                {proceeding ? 'Uploading…' : 'Proceed — upload & process'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.secondaryButton, proceeding && styles.buttonDisabled]}
              disabled={proceeding}
              onPress={onReRecord}
              accessibilityRole="button"
              accessibilityLabel="Re-record session"
            >
              <Text style={styles.secondaryButtonText}>Re-record</Text>
            </Pressable>
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
          <ActionRow
            label="▶ Play Recording"
            hint={
              session.audioPath
                ? 'Play via secure signed URL'
                : 'Play the local recording saved on this device'
            }
            onPress={() => setShowPlayer(true)}
          />
        ) : null}

        {!hasLocalDraft && !hasPlayback ? (
          <ActionRow label="▶ Play Recording" hint="No recording available yet" disabled />
        ) : null}

        {canRecord ? (
          <ActionRow
            label="● Record audio"
            hint="Capture microphone audio for this session"
            onPress={() => router.push(`/recording?id=${session.id}`)}
          />
        ) : null}

        <ActionRow
          label="⚙️ Processing"
          hint={
            !session.audioPath
              ? 'Available after you proceed with a recording'
              : session.status === 'completed'
                ? 'Pipeline finished — view progress'
                : session.status === 'transcribing' || session.status === 'summarizing'
                  ? 'Pipeline in progress'
                  : session.status === 'failed'
                    ? 'Processing failed — tap to retry'
                    : 'Transcribe and summarize in one flow'
          }
          disabled={!session.audioPath}
          onPress={
            session.audioPath
              ? () => router.push(`/session/${session.id}/processing`)
              : undefined
          }
        />

        {showWorkspace ? (
          <SessionWorkspace
            sessionId={session.id}
            sessionTitle={session.title}
            hasTranscript={hasTranscript}
            hasSummary={hasSummary}
            initialTab={hasSummary ? 'summary' : 'transcript'}
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

      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Back to sessions">
        <Text style={styles.backText}>Back to sessions</Text>
      </Pressable>
    </ScrollView>
  );
}

function ActionRow({
  label,
  hint,
  disabled,
  onPress,
}: {
  label: string;
  hint?: string;
  disabled?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.action, disabled && styles.actionDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled) }}
    >
      <Text style={styles.actionLabel}>{label}</Text>
      {hint ? <Text style={styles.actionHint}>{hint}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    backgroundColor: colors.background,
    padding: spacing.lg,
    justifyContent: 'center',
  },
  container: {
    padding: spacing.lg,
    gap: spacing.sm,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.title,
    fontSize: 28,
    color: colors.ink,
    marginBottom: spacing.xs,
  },
  meta: {
    ...typography.body,
    color: colors.inkMuted,
  },
  status: {
    ...typography.body,
    fontWeight: '600',
    marginTop: spacing.sm,
  },
  statusOk: { color: colors.success },
  statusPending: { color: colors.accent },
  statusFailed: { color: colors.danger },
  description: {
    ...typography.body,
    color: colors.ink,
    marginTop: spacing.md,
  },
  manageRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  manageButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  manageButtonText: {
    ...typography.caption,
    color: colors.ink,
    fontWeight: '700',
  },
  favoriteOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  favoriteOnText: {
    color: colors.brand,
  },
  dangerButton: {
    borderColor: colors.danger,
    backgroundColor: '#F8D5DA',
  },
  dangerButtonText: {
    color: colors.danger,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  reviewBox: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.md,
  },
  reviewTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.ink,
  },
  reviewHint: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  primaryButton: {
    backgroundColor: colors.brand,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: colors.onBrand,
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: colors.ink,
    fontWeight: '600',
    fontSize: 16,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  action: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: 4,
  },
  actionDisabled: {
    opacity: 0.65,
  },
  actionLabel: {
    ...typography.body,
    fontWeight: '600',
    color: colors.ink,
  },
  actionHint: {
    ...typography.caption,
    color: colors.inkMuted,
  },
  back: {
    marginTop: spacing.xl,
    alignSelf: 'flex-start',
  },
  backText: {
    color: colors.brandSoft,
    fontWeight: '600',
  },
});
