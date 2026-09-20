import { useCallback, useRef, useState } from 'react';
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
import { getLocalAudioUri } from '@/src/services/local-audio';
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
  const autoUploadAttempted = useRef<string | null>(null);

  const runUpload = useCallback(async (sessionId: string, uri: string) => {
    setUploadStatus('uploading');
    setUploadProgress(0);
    setUploadMessage(undefined);
    try {
      await uploadSessionAudio(sessionId, uri, (progress) => {
        setUploadProgress(progress.ratio);
      });
      const refreshed = await getSession(sessionId);
      setSession(refreshed);
      setUploadStatus('success');
      setUploadProgress(1);

      try {
        const signed = await getSignedAudioUrl(sessionId);
        setPlaybackUri(signed.url);
      } catch {
        setPlaybackUri(uri);
      }
    } catch (err) {
      setUploadStatus('error');
      setUploadMessage(
        err instanceof ApiClientError
          ? err.message
          : 'Upload failed. Your local recording is still saved.',
      );
    }
  }, []);

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
      setLocalUri(uri);

      if (data.audioPath) {
        setUploadStatus('success');
        setUploadProgress(1);
        autoUploadAttempted.current = id;
        try {
          const signed = await getSignedAudioUrl(id);
          setPlaybackUri(signed.url);
          setShowPlayer(true);
        } catch {
          setPlaybackUri(uri);
          setShowPlayer(Boolean(uri));
        }
      } else if (uri) {
        setPlaybackUri(uri);
        setShowPlayer(true);
        if (autoUploadAttempted.current !== id) {
          autoUploadAttempted.current = id;
          void runUpload(id, uri);
        }
      } else {
        setPlaybackUri(null);
        setShowPlayer(false);
        setUploadStatus('idle');
      }
    } catch (err) {
      setSession(null);
      setLocalUri(null);
      setPlaybackUri(null);
      setError(err instanceof ApiClientError ? err.message : 'Could not load this session.');
    } finally {
      setLoading(false);
    }
  }, [id, runUpload]);

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
        {localUri || session.audioPath ? (
          <UploadProgress
            progress={uploadProgress}
            status={uploadStatus}
            message={uploadMessage}
            onRetry={
              localUri && id
                ? () => {
                    void runUpload(String(id), localUri);
                  }
                : undefined
            }
          />
        ) : null}

        {hasPlayback && showPlayer && playbackUri ? (
          <AudioPlayer uri={playbackUri} title={session.title} />
        ) : null}

        {hasPlayback && !showPlayer ? (
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

        {!hasPlayback ? (
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
          label="📄 Transcript"
          hint={
            session.audioPath
              ? session.status === 'transcribed' || session.status === 'completed'
                ? 'View the full transcript'
                : session.status === 'transcribing'
                  ? 'Transcription in progress'
                  : session.status === 'failed'
                    ? 'Transcription failed — tap to retry'
                    : 'Generate a transcript from the uploaded audio'
              : 'Upload audio before transcription'
          }
          disabled={!session.audioPath}
          onPress={
            session.audioPath
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
                : session.status === 'transcribed' || session.status === 'failed'
                  ? session.status === 'failed'
                    ? 'Summarization failed — tap to retry'
                    : 'Generate a structured summary from the transcript'
                  : 'Available after transcription'
          }
          disabled={
            !(
              session.status === 'transcribed' ||
              session.status === 'summarizing' ||
              session.status === 'completed' ||
              session.status === 'failed'
            )
          }
          onPress={
            session.status === 'transcribed' ||
            session.status === 'summarizing' ||
            session.status === 'completed' ||
            session.status === 'failed'
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
