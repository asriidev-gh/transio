import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  SESSION_STATUS_LABELS,
  SESSION_TYPE_LABELS,
  type Session,
} from '@sessionai/shared';
import { colors, spacing, typography } from '@/src/theme';
import { formatDurationHuman, formatSessionDate } from '@/src/utils/format';

interface SessionCardProps {
  session: Session;
  onPress: () => void;
}

export function SessionCard({ session, onPress }: SessionCardProps) {
  const statusLabel = SESSION_STATUS_LABELS[session.status];
  const completed = session.status === 'completed';
  const failed = session.status === 'failed';

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, failed && styles.cardFailed, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${session.title}, ${SESSION_TYPE_LABELS[session.sessionType]}, ${statusLabel}`}
    >
      <Text style={styles.title}>{session.title}</Text>
      <Text style={styles.meta}>{SESSION_TYPE_LABELS[session.sessionType]}</Text>
      <Text style={styles.meta}>{formatSessionDate(session.recordedAt)}</Text>
      <Text style={styles.meta}>{formatDurationHuman(session.durationSeconds)}</Text>
      <View style={styles.statusRow}>
        <Text
          style={[
            styles.status,
            completed ? styles.statusOk : failed ? styles.statusFailed : styles.statusPending,
          ]}
        >
          {completed ? `✓ ${statusLabel}` : failed ? `⚠ ${statusLabel} — tap to recover` : statusLabel}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 2,
  },
  cardFailed: {
    backgroundColor: '#F8E8E4',
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: 8,
    borderBottomColor: 'transparent',
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    color: colors.ink,
    fontSize: 17,
  },
  meta: {
    ...typography.body,
    fontSize: 14,
    color: colors.inkMuted,
  },
  statusRow: {
    marginTop: spacing.xs,
  },
  status: {
    ...typography.caption,
    fontWeight: '600',
  },
  statusOk: {
    color: colors.success,
  },
  statusPending: {
    color: colors.accent,
  },
  statusFailed: {
    color: colors.danger,
  },
});
