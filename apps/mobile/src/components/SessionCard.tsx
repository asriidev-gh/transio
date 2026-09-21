import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  SESSION_STATUS_LABELS,
  SESSION_TYPE_LABELS,
  type Session,
} from '@sessionai/shared';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { Icon } from '@/src/components/ui/Icon';
import { formatDurationHuman, formatRelativeSessionDate } from '@/src/utils/format';
import { sessionTopicVisual } from '@/src/utils/session-topic';

interface SessionCardProps {
  session: Session;
  onPress: () => void;
  onDelete?: () => void;
}

export function SessionCard({ session, onPress, onDelete }: SessionCardProps) {
  const { colors, scheme } = useTheme();
  const statusLabel = SESSION_STATUS_LABELS[session.status];
  const completed = session.status === 'completed';
  const failed = session.status === 'failed';
  const favorited = Boolean(session.favoritedAt);
  const preview = session.description?.trim();
  const topic = sessionTopicVisual(session);
  const markColor = failed
    ? colors.actionRecord
    : scheme === 'dark'
      ? topic.dark
      : topic.light;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.main, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`${session.title}, ${SESSION_TYPE_LABELS[session.sessionType]}, ${statusLabel}${favorited ? ', favorite' : ''}`}
      >
        <View style={[styles.mark, { backgroundColor: markColor }]}>
          <Icon name={topic.icon} size={32} />
        </View>
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
              {session.title}
            </Text>
            {favorited ? <Icon name="star" size={18} color={colors.warning} /> : null}
          </View>
          <Text style={[styles.meta, { color: colors.inkMuted }]} numberOfLines={1}>
            {formatRelativeSessionDate(session.recordedAt)} · {formatDurationHuman(session.durationSeconds)}
            {' · '}
            {SESSION_TYPE_LABELS[session.sessionType]}
          </Text>
          {preview ? (
            <Text style={[styles.snippet, { color: colors.tertiary }]} numberOfLines={1}>
              “{preview}”
            </Text>
          ) : (
            <Text
              style={[
                styles.snippet,
                {
                  color: completed ? colors.success : failed ? colors.danger : colors.accent,
                },
              ]}
              numberOfLines={1}
            >
              {completed ? 'Ready to review' : failed ? 'Needs attention' : statusLabel}
            </Text>
          )}
        </View>
      </Pressable>
      {onDelete ? (
        <Pressable
          onPress={onDelete}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={`Delete ${session.title}`}
          style={styles.deleteHit}
        >
          <Icon name="close" size={16} color={colors.inkMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.smd,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.smd,
    paddingVertical: spacing.md,
  },
  pressed: {
    opacity: 0.7,
  },
  mark: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    overflow: 'visible',
  },
  body: {
    flex: 1,
    gap: 2,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'transparent',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    ...typography.body,
    fontWeight: '600',
    flexShrink: 1,
  },
  meta: {
    ...typography.meta,
  },
  snippet: {
    ...typography.meta,
    fontStyle: 'italic',
  },
  deleteHit: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
});
