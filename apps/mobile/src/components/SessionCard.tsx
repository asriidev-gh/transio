import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  SESSION_STATUS_LABELS,
  SESSION_TYPE_LABELS,
  type Session,
} from '@sessionai/shared';
import { Icon } from '@/src/components/ui/Icon';
import { IconWell } from '@/src/components/ui/IconWell';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { formatDurationHuman, formatRelativeSessionDate } from '@/src/utils/format';
import { sessionTopicVisual } from '@/src/utils/session-topic';

interface SessionCardProps {
  session: Session;
  onPress: () => void;
  /** Prefer long-press delete so the row stays calm. */
  onDelete?: () => void;
}

function statusTone(
  status: Session['status'],
  colors: { success: string; danger: string; accent: string; cyan: string; inkMuted: string },
): { label: string; color: string; bg: string } {
  if (status === 'completed') {
    return { label: 'Ready', color: colors.success, bg: 'rgba(5, 150, 105, 0.12)' };
  }
  if (status === 'failed') {
    return { label: 'Needs attention', color: colors.danger, bg: 'rgba(239, 68, 68, 0.12)' };
  }
  if (status === 'transcribing' || status === 'summarizing') {
    return { label: SESSION_STATUS_LABELS[status], color: colors.accent, bg: 'rgba(91, 108, 255, 0.12)' };
  }
  if (status === 'transcribed' || status === 'uploaded') {
    return { label: SESSION_STATUS_LABELS[status], color: colors.cyan, bg: 'rgba(56, 189, 248, 0.12)' };
  }
  return {
    label: SESSION_STATUS_LABELS[status],
    color: colors.inkMuted,
    bg: 'rgba(156, 163, 175, 0.14)',
  };
}

export function SessionCard({ session, onPress, onDelete }: SessionCardProps) {
  const { colors, scheme, shadows } = useTheme();
  const statusLabel = SESSION_STATUS_LABELS[session.status];
  const favorited = Boolean(session.favoritedAt);
  const preview = session.description?.trim();
  const topic = sessionTopicVisual(session);
  const wellTint = session.status === 'failed'
    ? colors.actionRecord
    : scheme === 'dark'
      ? topic.dark
      : topic.light;
  const tone = statusTone(session.status, colors);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onDelete}
      delayLongPress={420}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          opacity: pressed ? 0.92 : 1,
          transform: [{ scale: pressed ? 0.992 : 1 }],
        },
        shadows.soft,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${session.title}, ${SESSION_TYPE_LABELS[session.sessionType]}, ${statusLabel}${favorited ? ', favorite' : ''}`}
      accessibilityHint={onDelete ? 'Long press to delete' : undefined}
    >
      <IconWell name={topic.icon} tint={wellTint} color={colors.accentDeep} size={20} wellSize={48} />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: colors.ink }]} numberOfLines={1}>
            {session.title}
          </Text>
          {favorited ? <Icon name="star" size={16} color={colors.warning} variant="line" /> : null}
        </View>

        <Text style={[styles.meta, { color: colors.inkMuted }]} numberOfLines={1}>
          {formatRelativeSessionDate(session.recordedAt)}
          {'  ·  '}
          {formatDurationHuman(session.durationSeconds)}
          {'  ·  '}
          {SESSION_TYPE_LABELS[session.sessionType]}
        </Text>

        <View style={styles.footer}>
          {preview ? (
            <Text style={[styles.snippet, { color: colors.tertiary }]} numberOfLines={1}>
              {preview}
            </Text>
          ) : (
            <View style={[styles.pill, { backgroundColor: tone.bg }]}>
              <View style={[styles.pillDot, { backgroundColor: tone.color }]} />
              <Text style={[styles.pillText, { color: tone.color }]}>{tone.label}</Text>
            </View>
          )}
        </View>
      </View>

      <Icon name="chevron-right" size={18} color={colors.tertiary} variant="line" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.smd,
    borderRadius: radii.card,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: 96,
  },
  body: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  title: {
    fontSize: 16,
    lineHeight: 21,
    fontWeight: '600',
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  meta: {
    ...typography.caption,
    fontWeight: '500',
  },
  footer: {
    marginTop: 2,
  },
  snippet: {
    ...typography.meta,
    fontSize: 13,
  },
  pill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
