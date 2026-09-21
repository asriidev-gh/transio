import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  SESSION_STATUS_LABELS,
  SESSION_TYPE_LABELS,
  type Session,
} from '@sessionai/shared';
import { Icon, type AppIconName } from '@/src/components/ui/Icon';
import { radii, spacing, typography } from '@/src/theme';
import { useTheme } from '@/src/theme/ThemeContext';
import { formatDurationHuman, formatRelativeSessionDate } from '@/src/utils/format';
import { sessionTopicVisual } from '@/src/utils/session-topic';

interface InsightStatProps {
  label: string;
  value: string;
  icon: AppIconName;
  tint: string;
  onPress?: () => void;
}

/** Compact metric tile for the home insights row. */
export function InsightStat({ label, value, icon, tint, onPress }: InsightStatProps) {
  const { colors, shadows } = useTheme();
  const body = (
    <>
      <View style={[styles.statIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={22} />
      </View>
      <Text style={[styles.statValue, { color: colors.ink }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={[styles.statLabel, { color: colors.inkMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </>
  );

  const shellStyle = [
    styles.stat,
    { backgroundColor: colors.surface, borderColor: colors.border },
    shadows.soft,
  ];

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          ...shellStyle,
          {
            opacity: pressed ? 0.88 : 1,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}`}
        accessibilityHint="Opens details"
      >
        {body}
      </Pressable>
    );
  }

  return (
    <View style={shellStyle} accessibilityLabel={`${label}: ${value}`}>
      {body}
    </View>
  );
}

interface ActionCardProps {
  label: string;
  hint: string;
  icon: AppIconName;
  tint: string;
  onPress: () => void;
}

/** Primary capture action on the home dashboard. */
export function HomeActionCard({ label, hint, icon, tint, onPress }: ActionCardProps) {
  const { colors, shadows } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.action,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
        shadows.soft,
      ]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <View style={[styles.actionIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={28} />
      </View>
      <Text style={[styles.actionLabel, { color: colors.ink }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[styles.actionHint, { color: colors.inkMuted }]} numberOfLines={2}>
        {hint}
      </Text>
    </Pressable>
  );
}

interface InsightSessionCardProps {
  session: Session;
  onPress: () => void;
  width?: number;
}

/** Larger session card for the home continue carousel. */
export function InsightSessionCard({ session, onPress, width = 200 }: InsightSessionCardProps) {
  const { colors, scheme, shadows } = useTheme();
  const topic = sessionTopicVisual(session);
  const markColor = session.status === 'failed'
    ? colors.actionRecord
    : scheme === 'dark'
      ? topic.dark
      : topic.light;
  const preview = session.description?.trim();
  const statusLabel = SESSION_STATUS_LABELS[session.status];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sessionCard,
        {
          width,
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
        shadows.soft,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${session.title}, ${SESSION_TYPE_LABELS[session.sessionType]}`}
    >
      <View style={[styles.sessionMark, { backgroundColor: markColor }]}>
        <Icon name={topic.icon} size={36} />
      </View>
      <Text style={[styles.sessionTitle, { color: colors.ink }]} numberOfLines={2}>
        {session.title}
      </Text>
      <Text style={[styles.sessionMeta, { color: colors.inkMuted }]} numberOfLines={1}>
        {formatRelativeSessionDate(session.recordedAt)} · {formatDurationHuman(session.durationSeconds)}
      </Text>
      <Text style={[styles.sessionType, { color: colors.tertiary }]} numberOfLines={1}>
        {SESSION_TYPE_LABELS[session.sessionType]}
      </Text>
      <Text
        style={[
          styles.sessionSnippet,
          {
            color:
              session.status === 'completed'
                ? colors.inkMuted
                : session.status === 'failed'
                  ? colors.danger
                  : colors.accent,
          },
        ]}
        numberOfLines={2}
      >
        {preview
          ? `“${preview}”`
          : session.status === 'completed'
            ? 'Ready to review'
            : statusLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  stat: {
    width: '47%',
    flexGrow: 1,
    minWidth: 140,
    borderWidth: 1,
    borderRadius: radii.lg,
    padding: spacing.smd,
    gap: spacing.xs,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: {
    ...typography.section,
  },
  statLabel: {
    ...typography.caption,
  },
  action: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: 120,
    maxHeight: 160,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    ...typography.section,
  },
  actionHint: {
    ...typography.meta,
  },
  sessionCard: {
    borderWidth: 1,
    borderRadius: radii.xl,
    padding: spacing.md,
    gap: spacing.sm,
    flexShrink: 0,
  },
  sessionMark: {
    width: 56,
    height: 56,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionTitle: {
    ...typography.body,
    fontWeight: '600',
    minHeight: 44,
  },
  sessionMeta: {
    ...typography.caption,
  },
  sessionType: {
    ...typography.caption,
  },
  sessionSnippet: {
    ...typography.meta,
    marginTop: spacing.xs,
  },
});
