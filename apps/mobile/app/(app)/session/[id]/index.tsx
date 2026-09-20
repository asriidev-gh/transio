import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import {
  SESSION_STATUS_LABELS,
  SESSION_TYPE_LABELS,
  type Session,
} from '@sessionai/shared';
import { AudioPlayer } from '@/src/components/AudioPlayer';
import { ErrorState } from '@/src/components/ErrorState';
import { LoadingState } from '@/src/components/LoadingState';
import { UploadProgress } from '@/src/components/UploadProgress';
import { ApiClientError } from '@/src/services/api';
import { getSignedAudioUrl, uploadSessionAudio } from '@/src/services/audio-upload';
import {
  clearLocalAudioUri,
  getLocalAudioUri,
  isLocalAudioReadable,
} from '@/src/services/local-audio';
import { getSession } from '@/src/services/sessions';
import { colors, spacing, typography } from '@/src/theme';
import { formatDurationHuman, formatSessionDate } from '@/src/utils/format';

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

  const onReRecord = useCallback(async () => {
    if (!id || typeof id !== 'string') return;
    await clearLocalAudioUri(id);
    setLocalUri(null);
    setPlaybackUri(null);
    setShowPlayer(false);
    setUploadStatus('idle');
    setUploadMessage(undefined);
    router.push(`/recording?id=${id}`);
  }, [id, router]);

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

  if (loading) {
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

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title} accessibilityRole="header">
        {session.title}
      </Text>
      <Text style={styles.meta}>{SESSION_TYPE_LABELS[session.sessionType]}</Text>
      <Text style={styles.meta}>{formatSessionDate(session.recordedAt)}</Text>
      <Text style={styles.meta}>{formatDurationHuman(session.durationSeconds)}</Text>
      <Text style={[styles.status, completed ? styles.statusOk : styles.statusPending]}>
        {completed
          ? `✓ ${SESSION_STATUS_LABELS[session.status]}`
          : SESSION_STATUS_LABELS[session.status]}
      </Text>

      {session.description ? <Text style={styles.description}>{session.description}</Text> : null}

      <View style={styles.actions}>
        {hasLocalDraft ? (
          <View style={styles.reviewBox}>
            <Text style={styles.reviewTitle}>Recording ready</Text>
            <Text style={styles.reviewHint}>
              Listen to your take, then upload & process it — or discard and record again.
            </Text>

            {hasPlayback && showPlayer && playbackUri ? (
              <AudioPlayer uri={playbackUri} title={session.title} />
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
            >
              <Text style={styles.primaryButtonText}>
                {proceeding ? 'Uploading…' : 'Proceed — upload & process'}
              </Text>
            </Pressable>

            <Pressable
              style={[styles.secondaryButton, proceeding && styles.buttonDisabled]}
              disabled={proceeding}
              onPress={() => void onReRecord()}
              accessibilityRole="button"
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
          <AudioPlayer uri={playbackUri} title={session.title} />
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

        <ActionRow
          label="📄 Transcript"
          hint={
            session.audioPath
              ? session.status === 'transcribed' || session.status === 'completed'
                ? 'View the full transcript'
                : session.status === 'transcribing'
                  ? 'Transcription in progress'
                  : session.status === 'failed'
                    ? 'Open processing to retry'
                    : 'Available after transcription'
              : 'Available after you proceed with a recording'
          }
          disabled={
            !(
              session.status === 'transcribed' ||
              session.status === 'summarizing' ||
              session.status === 'completed' ||
              session.status === 'transcribing'
            )
          }
          onPress={
            session.status === 'transcribed' ||
            session.status === 'summarizing' ||
            session.status === 'completed' ||
            session.status === 'transcribing'
              ? () => router.push(`/session/${session.id}/transcript`)
              : undefined
          }
        />
        <ActionRow
          label="✨ AI Summary"
          hint={
            session.status === 'completed'
              ? 'View the structured AI summary'
              : session.status === 'summarizing'
                ? 'Summary in progress'
                : 'Available after processing completes'
          }
          disabled={!(session.status === 'completed' || session.status === 'summarizing')}
          onPress={
            session.status === 'completed' || session.status === 'summarizing'
              ? () => router.push(`/session/${session.id}/summary`)
              : undefined
          }
        />
      </View>

      <Pressable onPress={() => router.back()} style={styles.back} accessibilityRole="button">
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
  description: {
    ...typography.body,
    color: colors.ink,
    marginTop: spacing.md,
  },
  actions: {
    marginTop: spacing.xl,
    gap: spacing.md,
  },
  reviewBox: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 12,
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
    borderRadius: 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    borderRadius: 12,
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
    borderRadius: 12,
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
