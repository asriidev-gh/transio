import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  SESSION_STATUS_LABELS,
  SESSION_TYPE_LABELS,
  type Session,
} from '@sessionai/shared';
import { colors, radii, spacing, typography } from '@/src/theme';
import { formatDurationHuman, formatSessionDate } from '@/src/utils/format';

interface SessionCardProps {
  session: Session;
  onPress: () => void;
}

export function SessionCard({ session, onPress }: SessionCardProps) {
  const statusLabel = SESSION_STATUS_LABELS[session.status];
  const completed = session.status === 'completed';
  const failed = session.status === 'failed';
  const favorited = Boolean(session.favoritedAt);
  const initials = session.title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, failed && styles.cardFailed, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${session.title}, ${SESSION_TYPE_LABELS[session.sessionType]}, ${statusLabel}${favorited ? ', favorite' : ''}`}
    >
      <View style={[styles.avatar, failed && styles.avatarFailed, favorited && styles.avatarFav]}>
        <Text style={[styles.avatarText, failed && styles.avatarTextFailed]}>
          {initials || 'S'}
        </Text>
      </View>
      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {session.title}
          </Text>
          {favorited ? <Text style={styles.heart}>★</Text> : null}
        </View>
        <Text style={styles.meta}>
          {SESSION_TYPE_LABELS[session.sessionType]} · {formatSessionDate(session.recordedAt)} ·{' '}
          {formatDurationHuman(session.durationSeconds)}
        </Text>
        <Text
          style={[
            styles.status,
            completed ? styles.statusOk : failed ? styles.statusFailed : styles.statusPending,
          ]}
        >
          {completed ? `✓ ${statusLabel}` : failed ? `⚠ ${statusLabel} — tap to recover` : statusLabel}
        </Text>
      </View>
      {completed ? <View style={styles.dot} accessibilityLabel="Completed" /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardFailed: {
    backgroundColor: '#F8D5DA',
    marginHorizontal: -spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    borderBottomColor: 'transparent',
  },
  pressed: {
    opacity: 0.7,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: radii.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFav: {
    borderWidth: 2,
    borderColor: colors.accent,
  },
  avatarFailed: {
    backgroundColor: '#F4B4BC',
  },
  avatarText: {
    color: colors.brand,
    fontWeight: '700',
    fontSize: 13,
  },
  avatarTextFailed: {
    color: colors.danger,
  },
  body: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    color: colors.ink,
    fontSize: 17,
    flexShrink: 1,
  },
  heart: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  meta: {
    ...typography.body,
    fontSize: 13,
    color: colors.inkMuted,
  },
  status: {
    ...typography.caption,
    fontWeight: '600',
    marginTop: 2,
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
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
});
