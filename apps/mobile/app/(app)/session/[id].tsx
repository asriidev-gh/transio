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
import { ApiClientError } from '@/src/services/api';
import { getLocalAudioUri } from '@/src/services/local-audio';
import { getSession } from '@/src/services/sessions';
import { colors, spacing, typography } from '@/src/theme';
import { formatDurationHuman, formatSessionDate } from '@/src/utils/format';

export default function SessionDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [session, setSession] = useState<Session | null>(null);
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPlayer, setShowPlayer] = useState(false);

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
      setShowPlayer(Boolean(uri));
    } catch (err) {
      setSession(null);
      setLocalUri(null);
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
  const canRecord = !localUri;

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
        {localUri && showPlayer ? <AudioPlayer uri={localUri} title={session.title} /> : null}

        {localUri && !showPlayer ? (
          <ActionRow
            label="▶ Play Recording"
            hint="Play the local recording saved on this device"
            onPress={() => setShowPlayer(true)}
          />
        ) : null}

        {!localUri ? (
          <ActionRow
            label="▶ Play Recording"
            hint="No local recording yet"
            disabled
          />
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
          hint="Available after transcription (Phase 6)"
          disabled
        />
        <ActionRow
          label="✨ AI Summary"
          hint="Available after summarization (Phase 7)"
          disabled
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
